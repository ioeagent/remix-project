import React, { useState, useEffect, useCallback } from 'react'
import { CreateSubgraphModal } from './components/CreateSubgraphModal'
import { SubgraphDiscovery } from './components/SubgraphDiscovery'
import { QueryPlayground } from './components/QueryPlayground'

interface TheGraphProps {
  plugin: any
}

type Tab = 'create' | 'discover' | 'playground'

export const TheGraph: React.FC<TheGraphProps> = ({ plugin }) => {
  const [activeTab, setActiveTab] = useState<Tab>('discover')
  const [apiKey, setApiKey] = useState('')
  const [playgroundEndpoint, setPlaygroundEndpoint] = useState('')
  const [playgroundName, setPlaygroundName] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Load API key from Remix settings on mount
  useEffect(() => {
    loadApiKey()
  }, [])

  const loadApiKey = async () => {
    try {
      const key = await plugin.call('config', 'getAppParameter', 'thegraph-api-key')
      if (key) setApiKey(key)
    } catch {
      // config plugin may not be available in all contexts
    }
  }

  const handleUseSubgraph = useCallback((endpoint: string, name: string) => {
    setPlaygroundEndpoint(endpoint)
    setPlaygroundName(name)
    setActiveTab('playground')
  }, [])

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'discover', label: 'Discover' },
    { id: 'playground', label: 'Playground' },
    { id: 'create', label: 'Create Subgraph' }
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '12px', fontFamily: 'var(--font-family)', color: 'var(--text-primary)' }}>
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
        >
          ⚙ Settings
        </button>
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs nav-fill mb-3" style={{ fontSize: '12px' }}>
        {tabs.map(tab => (
          <li key={tab.id} className="nav-item">
            <button
              className={`nav-link ${activeTab === tab.id ? 'active' : ''}`}
              style={{ fontSize: '12px', padding: '6px 4px' }}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
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
            <p className="text-muted small mb-3">
              Generate a complete subgraph project from your compiled contract — schema, mappings, manifest and ABI pre-filled.
            </p>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setShowCreateModal(true)}
            >
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
          paddingTop: '20px', overflow: 'auto'
        }}>
          <div style={{
            background: 'var(--background-primary)',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '480px',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 4px 24px rgba(0,0,0,0.4)'
          }}>
            <CreateSubgraphModal
              plugin={plugin}
              onClose={() => setShowCreateModal(false)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
