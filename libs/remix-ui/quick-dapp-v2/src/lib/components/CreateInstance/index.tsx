import React, { useState, useRef, useEffect } from 'react';
import { Card } from 'react-bootstrap';

// Helper to get network name from chainId or provider name
function getNetworkLabel(chainId: string | number): string {
  const id = String(chainId);
  const map: Record<string, string> = {
    '1': 'Mainnet', '5': 'Goerli', '11155111': 'Sepolia',
    '137': 'Polygon', '80001': 'Mumbai', '8453': 'Base',
    '84532': 'Base Sepolia', '10': 'Optimism', '42161': 'Arbitrum One',
  };
  return map[id] || (id.startsWith('vm') ? 'Remix VM' : `Chain ${id}`);
}

function shortenAddress(addr: string): string {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

interface DeployedInstance {
  name: string;
  address: string;
  abi: any[];
  contractData?: any;
  filePath?: string;
}

interface CreateInstanceProps {
  isAiLoading: boolean;
  plugin: any;
  onCreateDapp: (payload: any) => void;
}

const CreateInstance: React.FC<CreateInstanceProps> = ({ isAiLoading, plugin, onCreateDapp }) => {
  // Contract list state
  const [instances, setInstances] = useState<DeployedInstance[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isLoadingInstances, setIsLoadingInstances] = useState(true);

  // Prompt form state
  const [mode, setMode] = useState<'text' | 'figma'>('text');
  const [description, setDescription] = useState('');
  const [isBaseMiniApp, setIsBaseMiniApp] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Figma state
  const [figmaUrl, setFigmaUrl] = useState('');
  const [figmaToken, setFigmaToken] = useState('');
  const [isTokenLocked, setIsTokenLocked] = useState(false);

  // Load figma token from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('quickdapp-figma-token');
    if (stored) {
      setFigmaToken(stored);
      setIsTokenLocked(true);
    }
  }, []);

  // Core sync function: mirrors the Deploy & Run tab's instance list
  // Uses getAllDeployedInstances() as primary source, filesystem pinned contracts as fallback
  const syncContractList = async () => {
    const merged: any[] = [];
    const seenAddresses = new Set<string>();

    // 1. Primary source: Deploy & Run tab's in-memory instance list
    try {
      const deployTabInstances = await plugin.call('udapp', 'getAllDeployedInstances') || [];
      if (Array.isArray(deployTabInstances)) {
        for (const inst of deployTabInstances) {
          if (inst?.address) {
            const key = inst.address.toLowerCase();
            if (!seenAddresses.has(key)) {
              seenAddresses.add(key);
              merged.push(inst);
            }
          }
        }
      }
    } catch (e) {
      // Deploy & Run tab might not be ready yet
    }

    // 2. Fallback: read pinned contracts from workspace filesystem
    //    These persist across refresh/workspace change, and should appear even if
    //    the Deploy & Run tab hasn't loaded them into memory yet
    try {
      const pinnedRoot = '.deploys/pinned-contracts';
      const rootExists = await plugin.call('fileManager', 'exists', pinnedRoot);

      if (rootExists) {
        const chainDirs = await plugin.call('fileManager', 'readdir', pinnedRoot);
        for (const chainDirPath of Object.keys(chainDirs)) {
          const chainId = chainDirPath.split('/').filter(Boolean).pop() || '';
          try {
            const contractFiles = await plugin.call('fileManager', 'readdir', chainDirPath);
            for (const filePath of Object.keys(contractFiles)) {
              try {
                const content = await plugin.call('fileManager', 'readFile', filePath);
                const contract = JSON.parse(content);
                const key = contract.address?.toLowerCase();
                if (key && !seenAddresses.has(key)) {
                  seenAddresses.add(key);
                  merged.push({
                    name: contract.name || 'Unknown',
                    address: contract.address,
                    abi: contract.abi || contract.contractData?.abi,
                    contractData: contract.contractData,
                    filePath: contract.filePath,
                    isPinned: true,
                    pinnedAt: contract.pinnedAt,
                    chainId,
                  });
                }
              } catch (e) { /* skip invalid files */ }
            }
          } catch (e) { /* skip unreadable dirs */ }
        }
      }
    } catch (e) {
      // Non-critical fallback
    }

    return merged;
  };

  // --- Safety refs for race condition protection ---
  const syncVersionRef = useRef(0);       // Version counter: only latest resync result is applied
  const debounceTimerRef = useRef<any>(null);  // Debounce timer for rapid events
  const isSwitchingWorkspaceRef = useRef(false); // Guard: pause polling during workspace transition

  // Initial load
  useEffect(() => {
    const doLoad = async () => {
      setIsLoadingInstances(true);
      const version = ++syncVersionRef.current;
      try {
        const list = await syncContractList();
        if (version === syncVersionRef.current) {
          setInstances(list);
          if (list.length > 0 && selectedIndex < 0) setSelectedIndex(0);
        }
      } catch (e) {
        if (version === syncVersionRef.current) {
          console.error('[CreateInstance] Failed to load instances:', e);
          setInstances([]);
        }
      } finally {
        // Always clear loading — even if stale, another resync will handle data
        setIsLoadingInstances(false);
      }
    };
    doLoad();
  }, [plugin]);

  // Real-time sync: events + polling to stay in sync with Deploy & Run tab
  useEffect(() => {
    if (!plugin) return;

    // Debounced re-sync: prevents rapid successive calls, ensures only latest result is used
    const debouncedResync = (delayMs = 300) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(async () => {
        const version = ++syncVersionRef.current;
        try {
          const list = await syncContractList();
          if (version !== syncVersionRef.current) return; // Stale — discard
          setInstances(list);
          if (list.length > 0) {
            setSelectedIndex((prev) => (prev < 0 || prev >= list.length) ? 0 : prev);
          } else {
            setSelectedIndex(-1);
          }
        } catch (e) {
          if (version === syncVersionRef.current) {
            console.error('[CreateInstance] Resync failed:', e);
          }
        } finally {
          if (version === syncVersionRef.current) setIsLoadingInstances(false);
        }
      }, delayMs);
    };

    // --- Event triggers ---

    // New contract deployment detected
    const onNewTransaction = (_tx: any, receipt: any) => {
      if (!receipt?.contractAddress) return;
      console.log('[CreateInstance] Contract deployment detected:', receipt.contractAddress);
      debouncedResync(1000); // Wait for Deploy & Run tab to update its state
    };

    // "Clear all" clicked in Deploy & Run
    const onClearAll = () => {
      if (isSwitchingWorkspaceRef.current) return; // Ignore during workspace transition
      console.log('[CreateInstance] All instances cleared');
      debouncedResync(300);
    };

    // Pin added/removed
    const onFileChange = (path: string) => {
      if (!path.includes('.deploys/pinned-contracts/')) return;
      if (isSwitchingWorkspaceRef.current) return; // Ignore during workspace transition
      console.log('[CreateInstance] Pinned contract file changed:', path);
      debouncedResync(300);
    };

    // Workspace switched — bypasses debounce, uses its own dedicated timer
    const onWorkspaceChanged = () => {
      console.log('[CreateInstance] Workspace changed, resyncing...');
      isSwitchingWorkspaceRef.current = true;
      // Immediately clear to avoid showing old workspace's contracts
      syncVersionRef.current++;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      setInstances([]);
      setSelectedIndex(-1);
      // Dedicated timer — not affected by debounce from other events
      setTimeout(async () => {
        const version = ++syncVersionRef.current;
        try {
          const list = await syncContractList();
          if (version !== syncVersionRef.current) return;
          setInstances(list);
          if (list.length > 0) setSelectedIndex(0);
        } catch (e) {
          // Will be caught by next poll
        } finally {
          if (version === syncVersionRef.current) setIsLoadingInstances(false);
          isSwitchingWorkspaceRef.current = false;
        }
      }, 300);
    };

    // --- Periodic polling (safety net) ---
    const pollInterval = setInterval(() => {
      // Skip polling during workspace transition to prevent stale reads
      if (isSwitchingWorkspaceRef.current) return;
      debouncedResync(0); // No extra delay for polling
    }, 5000);

    // Subscribe
    plugin.on('udapp', 'newTransaction', onNewTransaction);
    plugin.on('udapp', 'clearAllInstancesReducer', onClearAll);
    plugin.on('fileManager', 'fileAdded', onFileChange);
    plugin.on('fileManager', 'fileRemoved', onFileChange);
    plugin.on('fileManager', 'fileChanged', onFileChange);
    plugin.on('filePanel', 'setWorkspace', onWorkspaceChanged);

    return () => {
      clearInterval(pollInterval);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      plugin.off('udapp', 'newTransaction', onNewTransaction);
      plugin.off('udapp', 'clearAllInstancesReducer', onClearAll);
      plugin.off('fileManager', 'fileAdded', onFileChange);
      plugin.off('fileManager', 'fileRemoved', onFileChange);
      plugin.off('fileManager', 'fileChanged', onFileChange);
      plugin.off('filePanel', 'setWorkspace', onWorkspaceChanged);
    };
  }, [plugin]);

  // AI loading state
  if (isAiLoading) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center py-5">
        <div className="spinner-border text-primary mb-3" role="status" style={{ width: '3rem', height: '3rem' }}></div>
        <h5 className="text-primary">Creating Your DApp...</h5>
        <p className="text-muted">RemixAI Assistant is generating your DApp code.</p>
      </div>
    );
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError('');
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setFileError('File is too large (>10MB).');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleTokenChange = (val: string) => {
    setFigmaToken(val);
    localStorage.setItem('quickdapp-figma-token', val);
  };

  const handleDeleteToken = () => {
    setFigmaToken('');
    localStorage.removeItem('quickdapp-figma-token');
    setIsTokenLocked(false);
  };

  const handleGenerate = async () => {
    if (selectedIndex < 0 || !instances[selectedIndex]) return;

    const inst = instances[selectedIndex];

    // Determine chain ID
    const providerObject = await plugin.call('blockchain', 'getProviderObject');
    const providerName = providerObject?.name || 'vm-unknown';
    const isVM = providerName.startsWith('vm');

    let chainId: string;
    if (isVM) {
      chainId = providerName;
    } else {
      const network = await plugin.call('network', 'detectNetwork');
      chainId = network?.id?.toString() || providerName;
    }

    // Get compiler artifacts
    let compilerData: any;
    try {
      compilerData = await plugin.call('compilerArtefacts', 'getArtefactsByContractName', inst.name);
    } catch (e) {
      console.warn('[CreateInstance] Could not get compiler artifacts:', e);
    }

    const payload: any = {
      contractName: inst.name,
      address: inst.address,
      abi: inst.abi || inst.contractData?.abi,
      chainId,
      compilerData,
      isBaseMiniApp,
      sourceFilePath: inst.filePath || inst.contractData?.contract?.file || '',
    };

    if (mode === 'figma') {
      payload.figmaUrl = figmaUrl;
      payload.figmaToken = figmaToken;
      payload.description = description;
    } else {
      payload.description = description;
      payload.image = previewUrl || undefined;
    }

    onCreateDapp(payload);
  };

  const selectedInst = selectedIndex >= 0 ? instances[selectedIndex] : null;

  return (
    <div className="py-3 px-2">
      {/* Header */}
      <div className="d-flex align-items-center mb-3">
        <i className="fas fa-bolt me-2 text-warning" style={{ fontSize: '1.2rem' }}></i>
        <div>
          <h5 className="mb-0">Quickdapp</h5>
          <small className="text-muted">Transform your smart contracts with AI...</small>
        </div>
      </div>

      {/* Linked Contracts Section */}
      <Card className="mb-3 border-secondary">
        <Card.Body className="py-3">
          <h6 className="fw-bold mb-1">Linked contracts</h6>
          <small className="text-muted d-block mb-2">
            Select a deployed contract from the current workspace.
          </small>

          {isLoadingInstances ? (
            <div className="text-center py-2">
              <i className="fas fa-spinner fa-spin me-2"></i>Loading...
            </div>
          ) : instances.length === 0 ? (
            <div className="text-center py-3 border rounded bg-light">
              <i className="fas fa-info-circle text-muted mb-2 d-block" style={{ fontSize: '1.5rem' }}></i>
              <small className="text-muted">
                No deployed contracts found.<br />
                Deploy a contract in the <strong>Deploy &amp; Run</strong> tab first.
              </small>
            </div>
          ) : (
            <>
              <select
                className="form-select"
                value={selectedIndex}
                onChange={(e) => setSelectedIndex(parseInt(e.target.value))}
              >
                {instances.map((inst, idx) => (
                  <option key={idx} value={idx}>
                    {inst.name} — {shortenAddress(inst.address)}
                  </option>
                ))}
              </select>
              {selectedInst && (
                <div className="mt-2 d-flex justify-content-between align-items-center small text-muted">
                  <span>{shortenAddress(selectedInst.address)}</span>
                  <span className="badge bg-info bg-opacity-25 text-info">
                    {getNetworkLabel(
                      (() => {
                        try {
                          // We can't async here so just show what we know
                          return 'Current Network';
                        } catch { return ''; }
                      })()
                    )}
                  </span>
                </div>
              )}
            </>
          )}
        </Card.Body>
      </Card>

      {/* Write your prompt Section */}
      <Card className="mb-3 border-secondary">
        <Card.Body className="py-3">
          <h6 className="fw-bold mb-1">Write your prompt</h6>
          <small className="text-muted d-block mb-3">
            Describe the DApp front-end you want to generate.
          </small>

          {/* Mode Tabs */}
          <ul className="nav nav-tabs nav-sm mb-3" style={{ fontSize: '0.85rem' }}>
            <li className="nav-item">
              <button
                className={`nav-link py-1 px-2 ${mode === 'text' ? 'active' : ''}`}
                onClick={() => setMode('text')}
              >
                <i className="fas fa-magic me-1"></i>Text / Image
              </button>
            </li>
            <li className="nav-item">
              <button
                className={`nav-link py-1 px-2 ${mode === 'figma' ? 'active' : ''}`}
                onClick={() => setMode('figma')}
              >
                <i className="fab fa-figma me-1"></i>Figma Import
              </button>
            </li>
          </ul>

          {/* Text Mode */}
          {mode === 'text' && (
            <div>
              <textarea
                className="form-control mb-2"
                rows={3}
                placeholder='I would like a dark theme dapp with a minimalist style...'
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              ></textarea>

              <div className="mb-2">
                <div className="d-flex align-items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <button
                    className="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <i className="fas fa-paperclip"></i>
                    {previewUrl ? 'Change image' : 'Join file'}
                  </button>
                  <span className="text-muted small">Optional</span>
                </div>
                {fileError && <div className="text-danger small mt-1">{fileError}</div>}
                {previewUrl && (
                  <div className="mt-2 position-relative d-inline-block border rounded overflow-hidden">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      style={{ height: '60px', width: 'auto', display: 'block' }}
                    />
                    <button
                      onClick={handleRemoveImage}
                      className="position-absolute top-0 end-0 btn btn-danger btn-sm p-0 d-flex align-items-center justify-content-center"
                      style={{ width: '18px', height: '18px', borderRadius: '0 0 0 4px', fontSize: '0.7rem' }}
                      title="Remove image"
                    >
                      &times;
                    </button>
                  </div>
                )}
              </div>

              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="qdv2-base-miniapp"
                  checked={isBaseMiniApp}
                  onChange={(e) => setIsBaseMiniApp(e.target.checked)}
                />
                <label className="form-check-label small" htmlFor="qdv2-base-miniapp">
                  Create as Base Mini App (Farcaster Frame)
                </label>
              </div>
            </div>
          )}

          {/* Figma Mode */}
          {mode === 'figma' && (
            <div>
              <div className="alert alert-info py-1 px-2 small mb-2">
                <i className="fas fa-info-circle me-1"></i>
                Paste a link to a specific Figma layer
              </div>

              <div className="mb-2">
                <label className="form-label small fw-bold mb-1">Figma File URL</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="https://www.figma.com/design/.../?node-id=1:2"
                  value={figmaUrl}
                  onChange={(e) => setFigmaUrl(e.target.value)}
                />
                <div className="form-text text-muted" style={{ fontSize: '0.7rem' }}>
                  Must contain <code>?node-id=...</code>
                </div>
              </div>

              <div className="mb-2">
                <label className="form-label small fw-bold mb-1">Personal Access Token</label>
                <div className="input-group input-group-sm">
                  <input
                    type="password"
                    className="form-control"
                    placeholder="figd_..."
                    value={figmaToken}
                    onChange={(e) => handleTokenChange(e.target.value)}
                    disabled={isTokenLocked}
                  />
                  {isTokenLocked && figmaToken ? (
                    <>
                      <button className="btn btn-outline-secondary" type="button" onClick={() => setIsTokenLocked(false)} title="Edit">
                        <i className="fas fa-pen"></i>
                      </button>
                      <button className="btn btn-outline-secondary" type="button" onClick={handleDeleteToken} title="Delete">
                        <i className="fas fa-trash"></i>
                      </button>
                    </>
                  ) : (
                    figmaToken && (
                      <button className="btn btn-outline-secondary" type="button" onClick={() => setIsTokenLocked(true)} title="Save">
                        <i className="fas fa-check"></i>
                      </button>
                    )
                  )}
                </div>
                <div className="form-text text-muted" style={{ fontSize: '0.7rem' }}>
                  Saved locally in your browser.
                </div>
              </div>

              <div className="mb-2">
                <label className="form-label small fw-bold mb-1">Additional Instructions (Optional)</label>
                <textarea
                  className="form-control form-control-sm"
                  rows={2}
                  placeholder='E.g: "Make sure buttons are responsive..."'
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                ></textarea>
              </div>

              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="qdv2-base-miniapp-figma"
                  checked={isBaseMiniApp}
                  onChange={(e) => setIsBaseMiniApp(e.target.checked)}
                />
                <label className="form-check-label small" htmlFor="qdv2-base-miniapp-figma">
                  Create as Base Mini App (Farcaster Frame)
                </label>
              </div>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Generate Button */}
      <div className="d-flex justify-content-end">
        <button
          className="btn btn-primary btn-sm d-flex align-items-center gap-2"
          disabled={selectedIndex < 0 || instances.length === 0}
          onClick={handleGenerate}
          style={{
            background: 'linear-gradient(135deg, #00e5ff 0%, #00bcd4 100%)',
            border: 'none',
            fontWeight: 600,
            padding: '6px 16px',
          }}
        >
          Generate dapp <i className="fas fa-paper-plane"></i>
        </button>
      </div>

      <div className="mt-2 text-muted small text-end">
        This might take up to 2 minutes.
      </div>
    </div>
  );
};

export default CreateInstance;