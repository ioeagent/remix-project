/* eslint-disable @typescript-eslint/no-non-null-assertion */
import React, { useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Button, Card, Modal } from '@remix-ui/helper';

import { FormattedMessage, useIntl } from 'react-intl';
import { toPng } from 'html-to-image';
import { AppContext } from '../../contexts';
import ChatBox from '../ChatBox';
import DeployPanel from '../DeployPanel';
// remixClient removed - using plugin from context instead
import { InBrowserVite } from '../../InBrowserVite';

interface Pages {
  [key: string]: string
}

export const readDappFiles = async (
  plugin: any,
  currentPath: string,
  map: Map<string, string>,
  rootPathLength: number
) => {
  try {
    const files = await plugin.call('fileManager', 'readdir', currentPath);

    for (const [filePath, fileData] of Object.entries(files)) {
      // @ts-ignore
      if (fileData.isDirectory) {
        await readDappFiles(plugin, filePath, map, rootPathLength);
      } else {
        const content = await plugin.call('fileManager', 'readFile', filePath);
        let virtualPath = filePath.substring(rootPathLength);
        if (!virtualPath.startsWith('/')) virtualPath = '/' + virtualPath;
        map.set(virtualPath, content);
      }
    }
  } catch (e) {
    console.error(`[QuickDapp-LOG] Error reading '${currentPath}':`, e);
  }
}

function EditHtmlTemplate(): JSX.Element {
  const intl = useIntl();
  const { appState, dispatch, dappManager, plugin } = useContext(AppContext);
  const { activeDapp } = appState;

  const [iframeError, setIframeError] = useState<string>('');
  const [showIframe, setShowIframe] = useState(true);
  const [isBuilderReady, setIsBuilderReady] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  const isAiUpdating = activeDapp ? (appState.dappProcessing[activeDapp.slug] || false) : false;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const builderRef = useRef<InBrowserVite | null>(null);

  const [notificationModal, setNotificationModal] = useState({
    show: false,
    title: '',
    message: '' as React.ReactNode,
    variant: 'primary'
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showTips, setShowTips] = useState(false);

  useEffect(() => {
    if (!plugin) return;

    const onDappUpdated = (data: any) => {
      if (activeDapp && data.slug === activeDapp.slug) {
        dispatch({
          type: 'SET_DAPP_PROCESSING',
          payload: { slug: activeDapp.slug, isProcessing: false }
        });

        if (activeDapp.status === 'deployed') {
          setNotificationModal({
            show: true,
            title: 'Code Updated',
            message: (
              <div>
                <p>The AI has successfully updated your dapp code.</p>
                <div className="alert alert-warning mb-0">
                  <i className="fas fa-exclamation-triangle me-2"></i>
                  <strong>Action Required:</strong> The live IPFS deployment is outdated.
                  Please <strong>"Deploy to IPFS"</strong> again.
                </div>
              </div>
            ),
            variant: 'warning'
          });
        } else {
          setNotificationModal({
            show: true,
            title: 'Update Successful',
            message: 'The AI has successfully updated your dapp code.',
            variant: 'success'
          });
        }

        setTimeout(() => runBuild(true), 500);
      }
    };

    const onDappError = (errorData: any) => {
      const errorSlug = errorData?.slug;
      // Only handle errors for this DApp
      if (activeDapp && (!errorSlug || errorSlug === activeDapp.slug)) {
        const errorMessage = errorData?.error || errorData || 'Unknown Error';
        dispatch({
          type: 'SET_DAPP_PROCESSING',
          payload: { slug: activeDapp.slug, isProcessing: false }
        });
        setNotificationModal({
          show: true,
          title: 'Update Failed',
          message: (
            <div>
              <p>An error occurred while generating the code:</p>
              <div className="alert alert-danger mb-0" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {errorMessage}
              </div>
            </div>
          ),
          variant: 'danger'
        });
      }
    };

    plugin.event.on('dappGenerated', onDappUpdated);
    plugin.event.on('dappGenerationError', onDappError);

    return () => {
      plugin.event.off('dappGenerated', onDappUpdated);
      plugin.event.off('dappGenerationError', onDappError);
    };
  }, [activeDapp, dispatch, plugin]);

  const handleDeleteDapp = async () => {
    if (!activeDapp || !dappManager) return;
    try {
      await dappManager.deleteDapp(activeDapp.slug);
      let updatedDapps = await dappManager.getDapps();
      if (!updatedDapps) updatedDapps = [];

      dispatch({ type: 'SET_DAPPS', payload: updatedDapps });
      dispatch({ type: 'SET_ACTIVE_DAPP', payload: null });
      setShowDeleteModal(false);

      if (updatedDapps.length === 0) {
        dispatch({ type: 'SET_VIEW', payload: 'create' });
      } else {
        dispatch({ type: 'SET_VIEW', payload: 'dashboard' });
      }

    } catch (e: any) {
      console.error('Delete failed:', e);
      setShowDeleteModal(false);
    }
  };

  const closeNotificationModal = () => {
    setNotificationModal(prev => ({ ...prev, show: false }));
  };

  const handleBack = async () => {
    if (!isAiUpdating && !isBuilding) {
      await captureAndSaveThumbnail();
    }

    if (dappManager && activeDapp) {
      try {
        const updatedConfig = await dappManager.getDappConfig(activeDapp.workspaceName);
        if (updatedConfig) {
          const updatedDapps = appState.dapps.map((d: any) =>
            d.slug === activeDapp.slug ? updatedConfig : d
          );
          dispatch({ type: 'SET_DAPPS', payload: updatedDapps });
        }
      } catch (e) {
        console.warn('[EditHtmlTemplate] Failed to update single dapp config', e);
      }
    }

    dispatch({ type: 'SET_ACTIVE_DAPP', payload: null });
    dispatch({ type: 'SET_VIEW', payload: 'dashboard' });
  };

  const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

  const captureAndSaveThumbnail = async () => {
    if (!activeDapp || !iframeRef.current) return;
    const iframe = iframeRef.current;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;

    if (!doc || !doc.body || doc.body.innerHTML === '') return;

    try {
      setIsCapturing(true);
      const dataUrl = await toPng(doc.body, {
        quality: 0.8,
        width: 640,
        height: 360,
        backgroundColor: '#ffffff',
        cacheBust: true,
        skipAutoScale: true,
        pixelRatio: 1,
        imagePlaceholder: TRANSPARENT_PIXEL,
        fetchRequestInit: {
          cache: 'no-cache',
        }
      });

      const previewPath = 'preview.png';
      await plugin.call('fileManager', 'writeFile', previewPath, dataUrl);
    } catch (error) {
      console.error('[Capture] Failed:', error);
    } finally {
      setIsCapturing(false);
    }
  };

  const runBuild = async (showNotification: boolean = false) => {
    console.log('[QuickDapp][runBuild] START', { slug: activeDapp?.slug, showNotification });
    if (!iframeRef.current || !activeDapp) return;
    if (isBuilding) return;

    if (!builderRef.current || !builderRef.current.isReady()) {
      setIframeError('Builder is initializing...');
      return;
    }

    setIsBuilding(true);
    setIframeError('');
    setShowIframe(true);

    try {
      const currentWs = await plugin.call('filePanel', 'getCurrentWorkspace');
      if (currentWs?.name && currentWs.name !== activeDapp.workspaceName) {
        console.log(`[QuickDapp] Switching from "${currentWs.name}" to DApp workspace "${activeDapp.workspaceName}"`);
        await plugin.call('filePanel', 'switchToWorkspace', {
          name: activeDapp.workspaceName,
          isLocalhost: false,
        });
        await new Promise(r => setTimeout(r, 800));
      }
    } catch (e) {
      console.warn('[QuickDapp] Failed to auto-switch workspace:', e);
    }

    const { title, details, logo } = appState.instance;

    const builder = builderRef.current;
    const mapFiles = new Map<string, string>();
    let hasBuildableFiles = false;
    let indexHtmlContent = '';

    try {
      const dappRootPath = '/';
      await readDappFiles(plugin, dappRootPath, mapFiles, 0);
      console.log('[QuickDapp][runBuild] Files read:', mapFiles.size);

      if (mapFiles.size === 0) {
        setIframeError(`No files found in workspace root. Make sure you are in the DApp workspace "${activeDapp.workspaceName}".`);
        setIsBuilding(false);
        return;
      }

      for (const [path] of mapFiles.entries()) {
        if (path.match(/\.(js|jsx|ts|tsx)$/)) {
          hasBuildableFiles = true;
        }
        if (path === '/index.html' || path === 'index.html') {
          indexHtmlContent = mapFiles.get(path)!;
        }
      }

    } catch (e: any) {
      setIframeError(`Failed to read DApp files: ${e.message}`);
      setIsBuilding(false);
      return;
    }

    const doc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
    if (!doc) {
      setIsBuilding(false);
      return;
    }

    let logoDataUrl = '';
    if (logo && typeof logo === 'string' && logo.startsWith('data:image')) {
      logoDataUrl = logo;
    }

    const injectionScript = `
      <script>
        window.__QUICK_DAPP_CONFIG__ = {
          logo: "${logoDataUrl}",
          title: ${JSON.stringify(title || '')},
          details: ${JSON.stringify(details || '')}
        };
      </script>
    `;
    const debugScript = `<script>
window.onerror = function(msg, url, line, col, error) {
  try { parent.console.error('[DApp-iframe] Error:', msg, 'at', url, 'line', line); } catch(e) {}
};
window.addEventListener('unhandledrejection', function(e) {
  try { parent.console.error('[DApp-iframe] Unhandled rejection:', e.reason); } catch(e2) {}
});
</script>`;
    const ext = `<script>
(function() {
  if (parent.__remixVMBridge) {
    console.log('[DApp] Using Remix VM Bridge');
    var _listeners = {};
    window.ethereum = {
      isMetaMask: false,
      isRemixVM: true,
      _events: {},
      request: function(args) {
        return parent.__remixVMBridge.request(args);
      },
      send: function(method, params) {
        if (typeof method === 'object') {
          return parent.__remixVMBridge.request(method);
        }
        return parent.__remixVMBridge.request({ method: method, params: params || [] });
      },
      on: function(event, cb) {
        if (!_listeners[event]) _listeners[event] = [];
        _listeners[event].push(cb);
        return this;
      },
      removeListener: function(event, cb) {
        if (_listeners[event]) {
          _listeners[event] = _listeners[event].filter(function(l) { return l !== cb; });
        }
        return this;
      },
      removeAllListeners: function() { _listeners = {}; return this; }
    };
    // Set static defaults — ethers.js will call eth_chainId / eth_requestAccounts
    // itself during connection, so async pre-fetching is unnecessary and
    // causes timeout errors during workspace switches.
    window.ethereum.chainId = '0x539'; // 1337 (standard local dev chain ID)
    window.ethereum.selectedAddress = null;
  } else if (parent.window && parent.window.ethereum) {
    console.log('[DApp] Using parent window.ethereum (MetaMask)');
    window.ethereum = parent.window.ethereum;
  } else {
    console.warn('[DApp] No provider available');
  }
})();
</script>`;

    try {
      if (hasBuildableFiles) {
        const result = await builder.build(mapFiles, '/src/main.jsx');
        if (!result.success) {
          doc.open();
          doc.write(`<pre style="color: red; white-space: pre-wrap;">${result.error || 'Unknown build error'}</pre>`);
          doc.close();
          setIsBuilding(false);
          return;
        }

        let finalHtml = indexHtmlContent || '<html><body><div id="root"></div></body></html>';

        if (finalHtml.includes('</head>')) {
          finalHtml = finalHtml.replace('</head>', `${debugScript}\n${injectionScript}\n${ext}\n</head>`);
        } else {
          finalHtml = `<html><head>${debugScript}${injectionScript}${ext}</head>${finalHtml}</html>`;
        }

        const scriptTag = `\n<script type="module">\n${result.js}\n</script>\n`;
        finalHtml = finalHtml.replace(
          /<script type="module"[^>]*src="(?:\/|\.\/)?src\/main\.jsx"[^>]*><\/script>/,
          scriptTag
        );
        finalHtml = finalHtml.replace(
          /<link rel="stylesheet"[^>]*href="(?:\/|\.\/)?src\/index\.css"[^>]*>/,
          ''
        );

        doc.open();
        doc.write(finalHtml);
        doc.close();
        console.log('[QuickDapp][runBuild] doc.write() completed (buildable)');

      } else {
        let finalHtml = indexHtmlContent;
        finalHtml = finalHtml.replace('</head>', `${debugScript}\n${injectionScript}\n${ext}\n</head>`);
        doc.open();
        doc.write(finalHtml);
        doc.close();
        console.log('[QuickDapp][runBuild] doc.write() completed (static HTML)');
      }

      if (showNotification) {
        setNotificationModal({
          show: true,
          title: 'Preview Updated',
          message: 'Preview refreshed successfully.',
          variant: 'success'
        });
      }

    } catch (e: any) {
      setIframeError(`Preview Error: ${e.message}`);
      setShowIframe(false);
    }

    setIsBuilding(false);
  }

  const handleChatMessage = async (message: string, imageBase64?: string) => {
    if (!activeDapp || !plugin) return;

    dispatch({
      type: 'SET_DAPP_PROCESSING',
      payload: { slug: activeDapp.slug, isProcessing: true }
    });

    try {
      const mapFiles = new Map<string, string>();
      const dappRootPath = '/';
      await readDappFiles(plugin, dappRootPath, mapFiles, 0);

      const currentFilesObject: Pages = {};
      for (const [path, content] of mapFiles.entries()) {
        if (!path.match(/\.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/i)) {
          currentFilesObject[path] = content;
        }
      }

      let userPrompt: any = message;
      if (imageBase64) {
        userPrompt = [{ type: 'text', text: message }, { type: 'image_url', image_url: { url: imageBase64 } }];
      }

      // Call updateDapp through plugin API
      await plugin.updateDapp(
        activeDapp.slug,
        activeDapp.contract.address,
        userPrompt,
        currentFilesObject,
        imageBase64 || null
      );

    } catch (error: any) {
      console.error('Update setup failed:', error);
      dispatch({ type: 'SET_DAPP_PROCESSING', payload: { slug: activeDapp.slug, isProcessing: false } });
    }
  };

  useEffect(() => {
    let mounted = true;
    async function initBuilder() {
      if (builderRef.current) return;
      try {
        const builder = new InBrowserVite();
        await builder.initialize();
        if (mounted) {
          builderRef.current = builder;
          setIsBuilderReady(true);
        }
      } catch (err: any) {
        console.error('Failed to initialize InBrowserVite:', err);
        if (mounted) setIframeError(`Failed to initialize builder: ${err.message}`);
      }
    }
    initBuilder();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (isBuilderReady && activeDapp && !isAiUpdating) {
      setTimeout(() => {
        runBuild(false);
      }, 100);
    }
  }, [isBuilderReady, isAiUpdating, activeDapp?.slug]);

  const isVM = !!activeDapp?.contract?.chainId && activeDapp.contract.chainId.toString().startsWith('vm');

  const [isCurrentProviderVM, setIsCurrentProviderVM] = useState(false);
  const [vmContractStatus, setVmContractStatus] = useState<'checking' | 'deployed' | 'not-found'>('checking');

  useEffect(() => {
    if (!plugin) return;
    const checkVM = async () => {
      try {
        const provider = await plugin.call('blockchain', 'getProvider');
        setIsCurrentProviderVM(!!provider && provider.startsWith('vm-'));
      } catch (e) {
        setIsCurrentProviderVM(false);
      }
    };
    checkVM();
  }, [plugin, activeDapp]);

  useEffect(() => {
    if (!isVM || !isCurrentProviderVM || !plugin || !activeDapp?.contract?.address) {
      setVmContractStatus('checking');
      return;
    }

    let cancelled = false;

    const tryCallContract = async (): Promise<boolean> => {
      const abi = activeDapp.contract.abi;
      if (!abi || !Array.isArray(abi)) return false;

      const viewFn = abi.find((item: any) =>
        item.type === 'function' &&
        (item.stateMutability === 'view' || item.stateMutability === 'pure') &&
        (!item.inputs || item.inputs.length === 0)
      );
      if (!viewFn) return false;

      const inputTypes = (viewFn.inputs || []).map((i: any) => i.type).join(',');
      const sig = `${viewFn.name}(${inputTypes})`;
      const hexSig = '0x' + Array.from(new TextEncoder().encode(sig))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const selectorHex = await plugin.call('blockchain', 'sendRpc', 'web3_sha3', [hexSig]);
      const selector = typeof selectorHex === 'string' ? selectorHex.substring(0, 10) : '0x';

      const callResult = await plugin.call('blockchain', 'sendRpc', 'eth_call', [{
        to: activeDapp.contract.address,
        data: selector
      }, 'latest']);

      return typeof callResult === 'string' && callResult.length > 2;
    };

    const checkWithRetry = async () => {
      // Log getCode for reference — Remix VM returns 0x even when contract is functional
      try {
        const code = await plugin.call('blockchain', 'getCode', activeDapp.contract.address);
        console.log(`[QuickDapp] getCode(${activeDapp.contract.address}):`, code);
      } catch (_) {}

      // getCode is unreliable in Remix VM, so we use eth_call with a view function instead.
      // The VM also needs time to load state after workspace switch, so we retry.
      const MAX_RETRIES = 3;
      const RETRY_DELAY_MS = 2000;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (cancelled) return;
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
          if (cancelled) return;
        }

        try {
          if (await tryCallContract()) {
            setVmContractStatus('deployed');
            return;
          }
        } catch (e) {
          const errStr = String(e);
          if (errStr.includes('revert') || errStr.includes('execution reverted')) {
            setVmContractStatus('deployed');
            return;
          }
        }
      }

      if (!cancelled) {
        setVmContractStatus('not-found');
      }
    };

    checkWithRetry();
    return () => { cancelled = true; };
  }, [isVM, isCurrentProviderVM, plugin, activeDapp?.contract?.address]);

  useEffect(() => {
    let isMounted = true;

    if (!isVM || !isCurrentProviderVM || !plugin) {
      delete (window as any).__remixVMBridge;
      return;
    }

    const bridge = {
      request: async ({ method, params }: { method: string; params?: any[] }) => {
        try {
          if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain') {
            return null;
          }

          const result = await plugin.call('blockchain', 'sendRpc', method, params || []);

          if (!isMounted) return;
          return result;
        } catch (error: any) {
          if (!isMounted) return;
          console.error(`[VM-Bridge] ${method} failed:`, error);
          throw error;
        }
      }
    };

    (window as any).__remixVMBridge = bridge;
    console.log('[VM-Bridge] Remix VM bridge activated');

    return () => {
      isMounted = false;
      delete (window as any).__remixVMBridge;
      console.log('[VM-Bridge] Remix VM bridge deactivated');
    };
  }, [isVM, isCurrentProviderVM, plugin]);

  if (!activeDapp) return <div className="p-4">No active dapp selected.</div>;

  return (
    <div className="flex flex-col h-full">
      <div className="py-2 px-4 border-bottom flex items-center shrink-0">
        <button
          className="btn btn-sm btn-secondary me-4"
          onClick={handleBack}
          disabled={isCapturing}
          data-id="back-to-dashboard-btn"
        >
          {isCapturing ? <><i className="fas fa-spinner fa-spin me-1"></i> Saving...</> : <><i className="fas fa-arrow-left me-1"></i> Back</>}
        </button>
        <div className="flex items-center flex-wrap gap-2">
          <span className="font-bold text-body" style={{ fontSize: '1.1rem' }} data-id="editor-dapp-title">
            {activeDapp.config.title || activeDapp.name}
          </span>
          <span className="badge bg-secondary opacity-75">
            {activeDapp.contract.networkName}
          </span>
          <div className="vr mx-1 text-secondary opacity-50" style={{ height: '1.2rem' }}></div>
          <div className="flex items-center text-muted" title="Location in File Explorer">
            <i className="far fa-folder-open me-2 opacity-75"></i>
            <span className="font-monospace small opacity-75" data-id="editor-workspace-name">
              {activeDapp.workspaceName}
            </span>
          </div>
        </div>
      </div>

      <div className="grow position-relative" style={{ overflow: 'hidden' }}>
        <div className="w-full pt-4 h-full">
          <div className="flex flex-wrap m-0 h-full">
            <div className="w-full lg:w-2/3 pe-lg-3 flex flex-col qd-main-col">
              <div className="flex flex-wrap">
                <div className="grow mb-4" style={{ minHeight: '30px' }}>
                  <ChatBox onSendMessage={handleChatMessage} isLoading={isAiUpdating}/>
                </div>
              </div>
              <div className="flex flex-wrap grow mb-4">
                <div className="w-full flex flex-col h-full">
                  <div className="flex justify-between items-center mb-2 shrink-0">
                    <h5 className="mb-0 text-body">
                      <FormattedMessage id="quickDapp.preview" defaultMessage="Preview" />
                      <button
                        className="btn btn-link text-muted p-0 ms-2 no-underline"
                        onClick={() => setShowTips(!showTips)}
                        style={{ fontSize: '0.85rem' }}
                      >
                        <i className="far fa-question-circle me-1"></i>
                        {showTips ? 'Hide Tips' : 'Help & Tips'}
                      </button>
                    </h5>
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => runBuild(true)}
                        disabled={isBuilding || isAiUpdating}
                        data-id="refresh-preview-btn"
                      >
                        {isBuilding ? <><i className="fas fa-spinner fa-spin me-1"></i> Building...</> : <><i className="fas fa-play me-1"></i> Refresh Preview</>}
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        onClick={() => setShowDeleteModal(true)}
                        disabled={isBuilding || isCapturing}
                        data-id="delete-dapp-editor-btn"
                      >
                        <i className="fas fa-trash me-1"></i> Delete Dapp
                      </Button>
                    </div>
                  </div>

                  {showTips && (
                    <div className="alert alert-info py-2 px-4 mb-2 small shadow-sm fade-in border-info bg-opacity-10">
                      <div className="font-bold mb-1"><i className="fas fa-robot me-1"></i>AI Code Generation Tips</div>
                      <ul className="mb-0 ps-4">
                        <li>AI code might not be perfect. If the preview is broken:</li>
                        <li><strong>Option 1:</strong> Edit code manually in the <strong>File Explorer</strong> (left panel), then click <strong>Refresh Preview</strong>.</li>
                        <li><strong>Option 2:</strong> Ask the AI to fix it in the <strong>Chat Box</strong> above.</li>
                      </ul>
                    </div>
                  )}

                  {isVM && (
                    <div className={`alert py-2 px-4 mb-2 small shadow-sm flex items-start ${vmContractStatus === 'not-found' ? 'alert-danger border-danger' : 'alert-warning border-warning'}`} data-id="vm-warning-banner">
                      <i className={`fas ${vmContractStatus === 'not-found' ? 'fa-times-circle text-danger' : 'fa-exclamation-triangle text-warning'} me-2 mt-1`}></i>
                      <div>
                        <div className="font-bold mb-1">Remix VM — Local Only</div>
                        {vmContractStatus === 'not-found' && (
                          <div className="text-danger mb-1">
                            <i className="fas fa-exclamation-circle me-1"></i>
                            No contract found at <code>{activeDapp.contract.address}</code>. The VM state may have been reset. Please redeploy the contract.
                          </div>
                        )}
                        {vmContractStatus === 'checking' && isCurrentProviderVM && (
                          <div className="mb-1">
                            <i className="fas fa-spinner fa-spin me-1"></i>
                            Checking contract status...
                          </div>
                        )}
                        <div className="mt-1 text-danger">
                          <i className="fas fa-ban me-1"></i>
                          IPFS deployment will not work — Remix VM is local to this browser only.
                        </div>
                      </div>
                    </div>
                  )}

                  <Card className="border grow flex position-relative">
                    <Card.Body className="p-0 flex flex-col position-relative" style={{ overflow: 'hidden' }}>
                      {isAiUpdating && (
                        <div className="position-absolute w-full h-full flex flex-col items-center justify-center bg-white" style={{ zIndex: 10, opacity: 0.9 }} data-id="ai-updating-overlay">
                          <i className="fas fa-spinner fa-spin fa-2x mb-4 text-primary"></i>
                          <h6 className="text-muted">Your dapp is being updated by RemixAI Assistant.</h6>
                        </div>
                      )}
                      <iframe
                        ref={iframeRef}
                        style={{ width: '100%', height: '100%', minHeight: '800px', border: 'none', backgroundColor: 'white', display: iframeError ? 'none' : 'block' }}
                        title="dApp Preview"
                        sandbox="allow-popups allow-scripts allow-same-origin allow-forms allow-top-navigation"
                        data-id="dapp-preview-iframe"
                      />
                      {iframeError && (
                        <div className="flex items-center justify-center h-full text-center p-6">
                          <div>
                            <i className="fas fa-exclamation-triangle text-warning mb-2" style={{ fontSize: '2rem' }}></i>
                            <h6 className="text-muted mb-2">Preview Error</h6>
                            <p className="text-muted small">{iframeError}</p>
                          </div>
                        </div>
                      )}
                    </Card.Body>
                  </Card>
                </div>
              </div>
            </div>
            <div className="w-full lg:w-1/3 flex flex-col qd-side-col">
              <div className="shrink-0">
                <DeployPanel />
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal show={notificationModal.show} onHide={closeNotificationModal} centered data-id="notification-modal">
        <Modal.Header closeButton>
          <Modal.Title className={notificationModal.variant === 'danger' ? 'text-danger' : notificationModal.variant === 'warning' ? 'text-warning' : 'text-success'}>
            {notificationModal.title}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>{notificationModal.message}</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeNotificationModal} data-id="notification-modal-close-btn">Close</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton><Modal.Title>Delete Dapp?</Modal.Title></Modal.Header>
        <Modal.Body>Are you sure you want to delete this dapp? This action cannot be undone.</Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDeleteDapp} data-id="confirm-delete-dapp-btn">Yes, Delete</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default EditHtmlTemplate;
