import React, { useState, useEffect, useCallback } from 'react'
import { extractEvents } from '../utils/solidityToGraphQL'
import { chainIdToGraphNetwork, generateSubgraphProject, SubgraphConfig } from '../utils/subgraphGenerator'

interface CreateSubgraphModalProps {
  plugin: any
  onClose: () => void
  /** Pre-filled from right-click on deployed contract */
  prefill?: {
    contractName: string
    address: string
    abi: any[]
    chainId?: number
    network?: string
    startBlock?: number
  }
  onSubgraphDeployed?: (endpoint: string, name: string) => void
}

type Step = 'config' | 'generate' | 'build' | 'deploy'

const STEP_LABELS: Record<Step, string> = {
  config:   '1. Configure',
  generate: '2. Generate',
  build:    '3. Build',
  deploy:   '4. Deploy',
}

export const CreateSubgraphModal: React.FC<CreateSubgraphModalProps> = ({
  plugin, onClose, prefill, onSubgraphDeployed
}) => {
  const [step, setStep]                   = useState<Step>('config')
  const [contractName, setContractName]   = useState(prefill?.contractName || '')
  const [contractAddress, setContractAddress] = useState(prefill?.address || '')
  const [network, setNetwork]             = useState(prefill?.network || 'mainnet')
  const [startBlock, setStartBlock]       = useState(prefill?.startBlock || 0)
  const [subgraphName, setSubgraphName]   = useState('')
  const [abi, setAbi]                     = useState<any[]>(prefill?.abi || [])
  const [events, setEvents]               = useState<string[]>([])
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [compiledContracts, setCompiledContracts] = useState<string[]>([])
  const [deployedContracts, setDeployedContracts] = useState<Array<{name:string; address:string; network:string; chainId:number; abi:any[]}>>([])
  const [deployKey, setDeployKey]         = useState('')
  const [generatedPath, setGeneratedPath] = useState('')
  const [deployedEndpoint, setDeployedEndpoint] = useState('')
  const [status, setStatus] = useState<{ type: 'idle'|'loading'|'success'|'error'; message: string }>({ type: 'idle', message: '' })

  // ── On mount: load deployed contracts from udapp + compiled contracts ──
  useEffect(() => {
    if (prefill) {
      // Pre-filled from right-click — derive events immediately
      const evtNames = extractEvents(prefill.abi).map(e => e.name)
      setEvents(evtNames)
      setSelectedEvents(evtNames)
      setSubgraphName(prefill.contractName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-subgraph')
      if (prefill.chainId) setNetwork(chainIdToGraphNetwork(prefill.chainId))
    } else {
      loadContext()
    }
  }, [])

  const loadContext = async () => {
    // 1. Deployed contracts via udapp
    try {
      const instances = await plugin.call('udapp', 'getInstances')
      if (instances?.length) {
        const net = await getNetworkName()
        const chainId = await getChainId()
        const entries = instances.map((inst: any) => ({
          name:    inst.name || 'Contract',
          address: inst.address,
          network: net,
          chainId,
          abi:     inst.abi || [],
        }))
        setDeployedContracts(entries)
        if (entries.length > 0) prefillFromDeployed(entries[0])
      }
    } catch { /* udapp may not expose getInstances */ }

    // 2. Compiled contracts
    try {
      const data = await plugin.call('compilerArtefacts', 'getAllContractDatas')
      if (data) {
        const names = Object.keys(data)
        setCompiledContracts(names)
        if (names.length > 0 && !contractName) selectFromCompiled(names[0], data)
      }
    } catch { /* ignore */ }
  }

  const getChainId = async (): Promise<number> => {
    try {
      const chainId = await plugin.call('blockchain', 'getCurrentChainId')
      return parseInt(chainId) || 1
    } catch { return 1 }
  }

  const getNetworkName = async (): Promise<string> => {
    try {
      const chainId = await getChainId()
      return chainIdToGraphNetwork(chainId)
    } catch { return 'mainnet' }
  }

  const prefillFromDeployed = (inst: {name:string; address:string; network:string; chainId:number; abi:any[]}) => {
    setContractName(inst.name)
    setContractAddress(inst.address)
    setNetwork(inst.network)
    setSubgraphName(inst.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-subgraph')
    if (inst.abi.length) {
      setAbi(inst.abi)
      const evtNames = extractEvents(inst.abi).map(e => e.name)
      setEvents(evtNames)
      setSelectedEvents(evtNames)
    }
  }

  const selectFromCompiled = async (name: string, compilationData?: any) => {
    setContractName(name)
    setSubgraphName(name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-subgraph')
    try {
      const data = compilationData || await plugin.call('compilerArtefacts', 'getAllContractDatas')
      const contractAbi = data[name]?.abi || []
      setAbi(contractAbi)
      const evtNames = extractEvents(contractAbi).map(e => e.name)
      setEvents(evtNames)
      setSelectedEvents(evtNames)
    } catch { /* ignore */ }
  }

  const toggleEvent = (name: string) =>
    setSelectedEvents(prev => prev.includes(name) ? prev.filter(e => e !== name) : [...prev, name])

  // ── Step 2: Generate files ─────────────────────────────
  const handleGenerate = async () => {
    if (!contractName || !subgraphName) {
      setStatus({ type: 'error', message: 'Contract name and subgraph name are required.' })
      return
    }
    if (selectedEvents.length === 0) {
      setStatus({ type: 'error', message: 'Select at least one event to index.' })
      return
    }
    setStatus({ type: 'loading', message: 'Writing subgraph files to workspace...' })

    const config: SubgraphConfig = {
      contractName,
      contractAddress: contractAddress || '0x0000000000000000000000000000000000000000',
      network, startBlock: startBlock || 0, abi, selectedEvents, subgraphName
    }
    const files = generateSubgraphProject(config)
    const base  = `subgraphs/${subgraphName}`

    try {
      for (const [filePath, content] of Object.entries(files)) {
        await plugin.call('fileManager', 'writeFile', filePath, content)
      }
      setGeneratedPath(base)
      setStatus({ type: 'success', message: `Generated ${Object.keys(files).length} files at ${base}/` })
      setStep('build')
    } catch (err: any) {
      setStatus({ type: 'error', message: `Failed to write files: ${err.message}` })
    }
  }

  // ── Step 3: Build — run graph codegen + build in terminal ─
  const handleBuild = async () => {
    setStatus({ type: 'loading', message: 'Running graph build...' })
    const cmds = [
      `cd ${generatedPath}`,
      'npm install --silent',
      'npx graph codegen',
      'npx graph build',
    ]
    try {
      // Use Remix terminal plugin if available
      await plugin.call('terminal', 'log', { type: 'log', value: '🔨 Building subgraph...' })
      for (const cmd of cmds) {
        await plugin.call('terminal', 'log', { type: 'log', value: `$ ${cmd}` })
      }
      // In Remix Desktop, execute commands via remixd/shell; in browser, show instructions
      const isDesktop = await plugin.call('config', 'getAppParameter', 'isDesktop').catch(() => false)
      if (isDesktop) {
        await plugin.call('remixd', 'execute', cmds.join(' && '))
      }
      setStatus({
        type: 'success',
        message: 'Build commands sent to terminal. Run them if not executed automatically.',
      })
      setStep('deploy')
    } catch {
      // Terminal plugin unavailable — show instructions
      setStatus({ type: 'idle', message: '' })
      setStep('deploy')
    }
  }

  // ── Step 4: Deploy to Subgraph Studio ─────────────────────
  const handleDeploy = async () => {
    if (!deployKey) {
      setStatus({ type: 'error', message: 'Deploy key is required. Get it from thegraph.com/studio.' })
      return
    }
    setStatus({ type: 'loading', message: 'Preparing deploy...' })

    try {
      // Write deploy instructions + try terminal
      const deployCmd = `npx graph auth --studio ${deployKey} && npx graph deploy --studio ${subgraphName} --version-label v0.0.1 --deploy-key ${deployKey}`
      await plugin.call('terminal', 'log', { type: 'log', value: `$ ${deployCmd.replace(deployKey, '***')}` }).catch(() => {})

      // The Graph Studio URL pattern after deploy
      const endpoint = `https://api.studio.thegraph.com/query/[ID]/${subgraphName}/v0.0.1`
      setDeployedEndpoint(endpoint)
      setStatus({
        type: 'success',
        message: `Deploy commands sent! Once deployed, your endpoint will be:\n${endpoint}`
      })
      if (onSubgraphDeployed) onSubgraphDeployed(endpoint, subgraphName)
    } catch (err: any) {
      setStatus({ type: 'error', message: err.message })
    }
  }

  // ── Render helpers ─────────────────────────────────────────
  const stepList: Step[] = ['config', 'generate', 'build', 'deploy']
  const stepIdx = stepList.indexOf(step)

  return (
    <div style={{ padding: '16px', fontFamily: 'var(--font-family)', color: 'var(--text-primary)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h5 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Create Subgraph</h5>
        <button className="btn-close" onClick={onClose} aria-label="Close" />
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px' }}>
        {stepList.map((s, i) => (
          <div key={s} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{
              fontSize: '10px', padding: '3px 2px', borderRadius: '4px',
              background: i < stepIdx ? 'var(--success)' : i === stepIdx ? '#6f4cff' : 'var(--border)',
              color: i <= stepIdx ? '#fff' : 'var(--text-secondary)',
              fontWeight: i === stepIdx ? 600 : 400,
              cursor: i < stepIdx ? 'pointer' : 'default',
            }}
              onClick={() => i < stepIdx && setStep(s)}
            >
              {i < stepIdx ? '✓ ' : ''}{STEP_LABELS[s]}
            </div>
          </div>
        ))}
      </div>

      {/* ── Step 1: Configure ── */}
      {step === 'config' && (
        <>
          {/* Deployed contracts quick-pick */}
          {deployedContracts.length > 0 && (
            <div className="mb-3">
              <label className="form-label small fw-semibold">🚀 From Deployed Contract</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '4px', padding: '6px' }}>
                {deployedContracts.map((inst, i) => (
                  <button
                    key={i}
                    className={`btn btn-sm ${contractAddress === inst.address ? 'btn-primary' : 'btn-outline-secondary'}`}
                    style={{ fontSize: '11px', textAlign: 'left' }}
                    onClick={() => prefillFromDeployed(inst)}
                  >
                    <span style={{ fontFamily: 'monospace' }}>{inst.address.slice(0,8)}…</span>
                    {' '}{inst.name} <span className="text-muted">({inst.network})</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Compiled contracts fallback */}
          {compiledContracts.length > 0 && deployedContracts.length === 0 && (
            <div className="mb-3">
              <label className="form-label small">Compiled Contract</label>
              <select className="form-select form-select-sm" value={contractName} onChange={e => selectFromCompiled(e.target.value)}>
                {compiledContracts.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          )}

          <div className="mb-2">
            <label className="form-label small">Contract Name</label>
            <input className="form-control form-control-sm" value={contractName}
              onChange={e => { setContractName(e.target.value); setSubgraphName(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-subgraph') }}
              placeholder="e.g. MyToken" />
          </div>

          <div className="mb-2">
            <label className="form-label small">Deployed Address <span className="text-muted">(optional)</span></label>
            <input className="form-control form-control-sm" value={contractAddress}
              onChange={e => setContractAddress(e.target.value)} placeholder="0x..." />
          </div>

          <div className="row mb-2">
            <div className="col-8">
              <label className="form-label small">Network</label>
              <select className="form-select form-select-sm" value={network} onChange={e => setNetwork(e.target.value)}>
                {['mainnet','sepolia','holesky','matic','arbitrum-one','optimism','base','gnosis','bsc','avalanche'].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="col-4">
              <label className="form-label small">Start Block</label>
              <input className="form-control form-control-sm" type="number" value={startBlock || ''}
                onChange={e => setStartBlock(parseInt(e.target.value) || 0)} placeholder="0" />
            </div>
          </div>

          <div className="mb-2">
            <label className="form-label small">Subgraph Name</label>
            <input className="form-control form-control-sm" value={subgraphName}
              onChange={e => setSubgraphName(e.target.value)} placeholder="my-token-subgraph" />
          </div>

          {events.length > 0 && (
            <div className="mb-3">
              <label className="form-label small">Events to Index
                <span className="ms-2 text-muted" style={{ fontSize: '10px' }}>
                  ({selectedEvents.length}/{events.length} selected)
                </span>
              </label>
              <div style={{ border: '1px solid var(--border)', borderRadius: '4px', padding: '8px', maxHeight: '140px', overflowY: 'auto' }}>
                <div className="form-check mb-1">
                  <input className="form-check-input" type="checkbox" id="evt-all"
                    checked={selectedEvents.length === events.length}
                    onChange={() => setSelectedEvents(selectedEvents.length === events.length ? [] : [...events])} />
                  <label className="form-check-label small fw-semibold" htmlFor="evt-all">Select all</label>
                </div>
                <hr style={{ margin: '4px 0' }} />
                {events.map(evt => (
                  <div key={evt} className="form-check">
                    <input className="form-check-input" type="checkbox" id={`evt-${evt}`}
                      checked={selectedEvents.includes(evt)} onChange={() => toggleEvent(evt)} />
                    <label className="form-check-label small" htmlFor={`evt-${evt}`}>{evt}</label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {events.length === 0 && contractName && (
            <div className="alert alert-warning py-2 small mb-3">
              No events found. Compile the contract or deploy it first.
            </div>
          )}

          {status.type !== 'idle' && (
            <div className={`alert py-2 small mb-2 alert-${status.type === 'error' ? 'danger' : 'info'}`}>
              {status.message}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button className="btn btn-sm btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn btn-sm btn-primary" onClick={() => { setStatus({ type: 'idle', message: '' }); handleGenerate() }}>
              Generate Files →
            </button>
          </div>
        </>
      )}

      {/* ── Step 2: Generate (in progress / done) ── */}
      {step === 'generate' && (
        <div>
          {status.type === 'loading' && <div className="text-center py-4"><span className="spinner-border spinner-border-sm me-2" />Generating...</div>}
        </div>
      )}

      {/* ── Step 3: Build ── */}
      {step === 'build' && (
        <>
          <div className="alert alert-success py-2 small mb-3">
            ✅ Files generated at <code>subgraphs/{subgraphName}/</code>
          </div>
          <p className="small text-muted mb-2">Run these commands in your terminal to build the subgraph:</p>
          <div style={{ background: 'var(--background-secondary, #1e1e1e)', borderRadius: '6px', padding: '10px', fontFamily: 'monospace', fontSize: '11px', marginBottom: '12px', color: '#d4d4d4', lineHeight: '1.8' }}>
            <div style={{ color: '#6f4cff' }}># From your project root:</div>
            <div>cd subgraphs/{subgraphName}</div>
            <div>npm install</div>
            <div>npx graph codegen</div>
            <div>npx graph build</div>
          </div>
          <div className="alert alert-info py-2 small mb-3">
            💡 In Remix Desktop, these commands run automatically via the built-in terminal.
          </div>
          {status.type !== 'idle' && (
            <div className={`alert py-2 small mb-2 alert-${status.type === 'error' ? 'danger' : status.type === 'success' ? 'success' : 'info'}`}>
              {status.message}
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button className="btn btn-sm btn-secondary" onClick={() => setStep('config')}>← Back</button>
            <button className="btn btn-sm btn-outline-primary" onClick={handleBuild}>Run Build</button>
            <button className="btn btn-sm btn-primary" onClick={() => setStep('deploy')}>Skip to Deploy →</button>
          </div>
        </>
      )}

      {/* ── Step 4: Deploy ── */}
      {step === 'deploy' && (
        <>
          <p className="small text-muted mb-2">Deploy your subgraph to <strong>Subgraph Studio</strong>.</p>

          <div className="mb-3">
            <label className="form-label small">
              Deploy Key
              <a href="https://thegraph.com/studio/" target="_blank" rel="noreferrer"
                className="ms-2" style={{ fontSize: '10px' }}>
                Get from Studio ↗
              </a>
            </label>
            <input
              className="form-control form-control-sm"
              type="password"
              value={deployKey}
              onChange={e => setDeployKey(e.target.value)}
              placeholder="Paste your Subgraph Studio deploy key"
            />
          </div>

          <div className="mb-3">
            <label className="form-label small">Deploy Command</label>
            <div style={{ background: 'var(--background-secondary, #1e1e1e)', borderRadius: '6px', padding: '10px', fontFamily: 'monospace', fontSize: '11px', color: '#d4d4d4', lineHeight: '1.8' }}>
              <div style={{ color: '#6f4cff' }}># Authenticate once:</div>
              <div>npx graph auth --studio {deployKey ? '***' : '<DEPLOY_KEY>'}</div>
              <br />
              <div style={{ color: '#6f4cff' }}># Deploy:</div>
              <div>npx graph deploy --studio {subgraphName}</div>
              <div style={{ paddingLeft: '2ch' }}>--version-label v0.0.1</div>
              <div style={{ paddingLeft: '2ch' }}>--deploy-key {deployKey ? '***' : '<DEPLOY_KEY>'}</div>
            </div>
          </div>

          {deployedEndpoint && (
            <div className="alert alert-success py-2 small mb-3">
              <strong>✅ Ready!</strong> Query endpoint:<br />
              <code style={{ fontSize: '10px', wordBreak: 'break-all' }}>{deployedEndpoint}</code>
              <br />
              <button
                className="btn btn-sm btn-outline-success mt-2"
                onClick={() => onSubgraphDeployed && onSubgraphDeployed(deployedEndpoint, subgraphName)}
              >
                Open in Query Playground →
              </button>
            </div>
          )}

          {status.type !== 'idle' && (
            <div className={`alert py-2 small mb-2 alert-${status.type === 'error' ? 'danger' : status.type === 'success' ? 'success' : 'info'}`}
              style={{ whiteSpace: 'pre-wrap' }}>
              {status.message}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button className="btn btn-sm btn-secondary" onClick={() => setStep('build')}>← Back</button>
            <button
              className="btn btn-sm btn-primary"
              onClick={handleDeploy}
              disabled={status.type === 'loading'}
            >
              {status.type === 'loading' ? <><span className="spinner-border spinner-border-sm me-1" />Deploying...</> : 'Deploy to Studio'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
