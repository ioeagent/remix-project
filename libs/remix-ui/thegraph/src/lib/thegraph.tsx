import React, { useState, useEffect, useCallback } from 'react'
import { CreateSubgraphModal } from './components/CreateSubgraphModal'
import { SubgraphDiscovery } from './components/SubgraphDiscovery'
import { QueryPlayground } from './components/QueryPlayground'
import { chainIdToGraphNetwork } from './utils/subgraphGenerator'

interface TheGraphProps {
  plugin: any
}

type Tab = 'create' | 'discover' | 'playground'

interface DeployedContractPrefill {
  contractName: string
  address: string
  abi: any[]
  chainId?: number
  network?: string
  startBlock?: number
}

export const TheGraph: React.FC<TheGraphProps> = ({ plugin }) => {
  const [activeTab, setActiveTab]                 = useState<Tab>('discover')
  const [apiKey, setApiKey]                       = useState('')
  const [playgroundEndpoint, setPlaygroundEndpoint] = useState('')
  const [playgroundName, setPlaygroundName]       = useState('')
  const [showCreateModal, setShowCreateModal]     = useState(false)
  const [createPrefill, setCreatePrefill]         = useState<DeployedContractPrefill | undefined>()
  const [deployedContracts, setDeployedContracts] = useState<any[]>([])

  // Load API key + hook into udapp events
  useEffect(() => {
    loadApiKey()
    listenForDeployedContracts()
    // Register trigger so TheGraphPlugin.createSubgraphFromContract() can open modal
    if (plugin.registerCreateTrigger) {
      plugin.registerCreateTrigger((prefill: any) => {
        setCreatePrefill(prefill)
        setActiveTab('create')
        setShowCreateModal(true)
      })
    }
    return () => {
      // Cleanup listeners on unmount
      try { plugin.off('udapp', 'newTransaction') } catch {}
      try { plugin.off('blockchain', 'contextChanged') } catch {}
    }
  }, [])

  const loadApiKey = async () => {
    try {
      const key = await plugin.call('config', 'getAppParameter', 'thegraph-api-key')
      if (key) setApiKey(key)
    } catch {}
  }

  const getChainId = async (): Promise<number> => {
    try {
      const id = await plugin.call('blockchain', 'getCurrentChainId')
      return parseInt(id) || 1
    } catch { return 1 }
  }

  /** Listen to udapp contract deployment events and refresh the list */
  const listenForDeployedContracts = async () => {
    await refreshDeployedContracts()
    // Listen for new deployments
    try {
      plugin.on('udapp', 'newTransaction', async () => {
        await refreshDeployedContracts()
      })
    } catch {}
    // Also refresh on network change
    try {
      plugin.on('blockchain', 'contextChanged', async () => {
        await refreshDeployedContracts()
      })
    } catch {}
  }

  const refreshDeployedContracts = async () => {
    try {
      const instances = await plugin.call('udapp', 'getInstances')
      if (instances?.length) {
        const chainId = await getChainId()
        const net = chainIdToGraphNetwork(chainId)
        setDeployedContracts(instances.map((inst: any) => ({
          name: inst.name || 'Contract',
          address: inst.address,
          abi: inst.abi || [],
          chainId,
          network: net,
        })))
      }
    } catch {}
  }

  /** Called when user clicks "Create Subgraph" on a deployed contract */
  const handleCreateFromDeployed = useCallback((inst: any) => {
    setCreatePrefill({
      contractName: inst.name || 'Contract',
      address:      inst.address,
      abi:          inst.abi || [],
      chainId:      inst.chainId,
      network:      inst.network,
    })
    setShowCreateModal(true)
  }, [])

  const handleUseSubgraph = useCallback((endpoint: string, name: string) => {
    setPlaygroundEndpoint(endpoint)
    setPlaygroundName(name)
    setActiveTab('playground')
  }, [])

  /** Called when subgraph is deployed — auto-navigate to playground */
  const handleSubgraphDeployed = useCallback((endpoint: string, name: string) => {
    setPlaygroundEndpoint(endpoint)
    setPlaygroundName(name)
    setShowCreateModal(false)
    setActiveTab('playground')
  }, [])

  const openCreate = () => {
    setCreatePrefill(undefined)
    setShowCreateModal(true)
  }

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'discover',   label: 'Discover' },
    { id: 'playground', label: 'Playground' },
    { id: 'create',     label: 'Create' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '12px', fontFamily: 'var(--font-family)', color: 'var(--text-primary)', position: 'relative' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="#6f4cff" strokeWidth="2"/>
          <circle cx="12" cy="5" r="2" fill="#6f4cff"/>
          <circle cx="19" cy="16" r="2" fill="#6f4cff"/>
          <circle cx="5" cy="16" r="2" fill="#6f4cff"/>
          <line x1="12" y1="7" x2="17.5" y2="14.5" stroke="#6f4cff" strokeWidth="1.5"/>
          <line x1="12" y1="7" x2="6.5" y2="14.5" stroke="#6f4cff" strokeWidth="1.5"/>
          <line x1="7" y1="16" x2="17" y2="16" stroke="#6f4cff" strokeWidth="1.5"/>
        </svg>
        <span style={{ fontWeight: 600, fontSize: '14px' }}>The Graph</span>
        <button
          className="btn btn-sm btn-outline-secondary ms-auto"
          style={{ fontSize: '11px', padding: '2px 8px' }}
          onClick={() => plugin.call('manager', 'activatePlugin', 'settings')}
          title="Configure API key in Settings"
        >⚙</button>
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs nav-fill mb-2" style={{ fontSize: '12px' }}>
        {tabs.map(tab => (
          <li key={tab.id} className="nav-item">
            <button
              className={`nav-link ${activeTab === tab.id ? 'active' : ''}`}
              style={{ fontSize: '12px', padding: '6px 4px' }}
              onClick={() => setActiveTab(tab.id)}
            >{tab.label}</button>
          </li>
        ))}
      </ul>

      {/* Tab content */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {activeTab === 'discover' && (
          <SubgraphDiscovery apiKey={apiKey} onUseSubgraph={handleUseSubgraph} />
        )}

        {activeTab === 'playground' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <QueryPlayground
              initialEndpoint={playgroundEndpoint}
              initialName={playgroundName}
              apiKey={apiKey}
            />
          </div>
        )}

        {activeTab === 'create' && (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Deployed contracts quick-launch */}
            {deployedContracts.length > 0 && (
              <div className="mb-3">
                <div className="small fw-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                  DEPLOYED CONTRACTS
                </div>
                {deployedContracts.map((inst, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 10px', marginBottom: '4px',
                    border: '1px solid var(--border)', borderRadius: '6px',
                    background: 'var(--background-secondary)',
                  }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600 }}>{inst.name}</div>
                      <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {inst.address?.slice(0, 10)}…{inst.address?.slice(-6)}
                        <span className="ms-2 badge bg-secondary" style={{ fontSize: '9px' }}>{inst.network}</span>
                      </div>
                    </div>
                    <button
                      className="btn btn-sm btn-primary"
                      style={{ fontSize: '11px', padding: '3px 10px' }}
                      onClick={() => handleCreateFromDeployed(inst)}
                    >
                      Create Subgraph
                    </button>
                  </div>
                ))}
                <hr style={{ margin: '12px 0 8px' }} />
              </div>
            )}

            <p className="text-muted small mb-3">
              Generate a complete subgraph — schema, mappings, manifest, ABI — then build and deploy to Subgraph Studio.
            </p>
            <button className="btn btn-primary btn-sm" onClick={openCreate}>
              + New Subgraph from Contract
            </button>
          </div>
        )}
      </div>

      {/* Create modal overlay */}
      {showCreateModal && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          paddingTop: '12px', overflow: 'auto'
        }}>
          <div style={{
            background: 'var(--background-primary)',
            borderRadius: '8px',
            width: '92%',
            maxWidth: '500px',
            maxHeight: '92vh',
            overflow: 'auto',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          }}>
            <CreateSubgraphModal
              plugin={plugin}
              onClose={() => { setShowCreateModal(false); setCreatePrefill(undefined) }}
              prefill={createPrefill}
              onSubgraphDeployed={handleSubgraphDeployed}
            />
          </div>
        </div>
      )}
    </div>
  )
}
