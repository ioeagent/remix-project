import React, { useState, useEffect } from 'react'
import { extractEvents } from '../utils/solidityToGraphQL'
import { chainIdToGraphNetwork, generateSubgraphProject, SubgraphConfig } from '../utils/subgraphGenerator'

interface CreateSubgraphModalProps {
  plugin: any
  onClose: () => void
}

export const CreateSubgraphModal: React.FC<CreateSubgraphModalProps> = ({ plugin, onClose }) => {
  const [contractName, setContractName] = useState('')
  const [contractAddress, setContractAddress] = useState('')
  const [network, setNetwork] = useState('mainnet')
  const [startBlock, setStartBlock] = useState(0)
  const [subgraphName, setSubgraphName] = useState('')
  const [abi, setAbi] = useState<any[]>([])
  const [events, setEvents] = useState<string[]>([])
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error'; message: string }>({ type: 'idle', message: '' })
  const [compiledContracts, setCompiledContracts] = useState<string[]>([])

  useEffect(() => {
    loadContext()
  }, [])

  const loadContext = async () => {
    try {
      // Try to get recently compiled contracts
      const compilationResult = await plugin.call('compilerArtefacts', 'getAllContractDatas')
      if (compilationResult) {
        const names = Object.keys(compilationResult)
        setCompiledContracts(names)
        if (names.length > 0) {
          await selectContract(names[0], compilationResult)
        }
      }
    } catch {
      // Context not available yet — user will fill manually
    }
  }

  const selectContract = async (name: string, compilationData?: any) => {
    setContractName(name)
    setSubgraphName(name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-subgraph')
    try {
      const data = compilationData || await plugin.call('compilerArtefacts', 'getAllContractDatas')
      const contractData = data[name]
      if (contractData?.abi) {
        const contractAbi = contractData.abi
        setAbi(contractAbi)
        const evtNames = extractEvents(contractAbi).map(e => e.name)
        setEvents(evtNames)
        setSelectedEvents(evtNames)
      }
    } catch {
      // ignore
    }
  }

  const toggleEvent = (name: string) => {
    setSelectedEvents(prev =>
      prev.includes(name) ? prev.filter(e => e !== name) : [...prev, name]
    )
  }

  const handleCreate = async () => {
    if (!contractName || !subgraphName) {
      setStatus({ type: 'error', message: 'Contract name and subgraph name are required.' })
      return
    }
    if (selectedEvents.length === 0) {
      setStatus({ type: 'error', message: 'Select at least one event to index.' })
      return
    }

    setStatus({ type: 'loading', message: 'Generating subgraph project...' })

    const config: SubgraphConfig = {
      contractName,
      contractAddress: contractAddress || '0x0000000000000000000000000000000000000000',
      network,
      startBlock: startBlock || 0,
      abi,
      selectedEvents,
      subgraphName
    }

    const files = generateSubgraphProject(config)

    try {
      for (const [filePath, content] of Object.entries(files)) {
        await plugin.call('fileManager', 'writeFile', filePath, content)
      }
      setStatus({ type: 'success', message: `Subgraph project created at subgraphs/${subgraphName}/` })
    } catch (err: any) {
      setStatus({ type: 'error', message: `Failed to write files: ${err.message}` })
    }
  }

  return (
    <div style={{ padding: '16px', fontFamily: 'var(--font-family)', color: 'var(--text-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h5 style={{ margin: 0 }}>Create Subgraph</h5>
        <button className="btn-close" onClick={onClose} aria-label="Close" />
      </div>

      {/* Contract selector */}
      {compiledContracts.length > 0 && (
        <div className="mb-3">
          <label className="form-label small">Compiled Contract</label>
          <select
            className="form-select form-select-sm"
            value={contractName}
            onChange={e => selectContract(e.target.value)}
          >
            {compiledContracts.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="mb-3">
        <label className="form-label small">Contract Name</label>
        <input
          className="form-control form-control-sm"
          value={contractName}
          onChange={e => {
            setContractName(e.target.value)
            setSubgraphName(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-subgraph')
          }}
          placeholder="e.g. MyToken"
        />
      </div>

      <div className="mb-3">
        <label className="form-label small">Deployed Address <span className="text-muted">(optional)</span></label>
        <input
          className="form-control form-control-sm"
          value={contractAddress}
          onChange={e => setContractAddress(e.target.value)}
          placeholder="0x..."
        />
      </div>

      <div className="row mb-3">
        <div className="col-8">
          <label className="form-label small">Network</label>
          <select
            className="form-select form-select-sm"
            value={network}
            onChange={e => setNetwork(e.target.value)}
          >
            {['mainnet', 'sepolia', 'holesky', 'matic', 'arbitrum-one', 'optimism', 'base', 'gnosis', 'bsc', 'avalanche'].map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <div className="col-4">
          <label className="form-label small">Start Block</label>
          <input
            className="form-control form-control-sm"
            type="number"
            value={startBlock || ''}
            onChange={e => setStartBlock(parseInt(e.target.value) || 0)}
            placeholder="0"
          />
        </div>
      </div>

      <div className="mb-3">
        <label className="form-label small">Subgraph Name</label>
        <input
          className="form-control form-control-sm"
          value={subgraphName}
          onChange={e => setSubgraphName(e.target.value)}
          placeholder="my-token-subgraph"
        />
      </div>

      {events.length > 0 && (
        <div className="mb-3">
          <label className="form-label small">Events to Index</label>
          <div style={{ border: '1px solid var(--border)', borderRadius: '4px', padding: '8px', maxHeight: '150px', overflowY: 'auto' }}>
            {events.map(evt => (
              <div key={evt} className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id={`evt-${evt}`}
                  checked={selectedEvents.includes(evt)}
                  onChange={() => toggleEvent(evt)}
                />
                <label className="form-check-label small" htmlFor={`evt-${evt}`}>{evt}</label>
              </div>
            ))}
          </div>
        </div>
      )}

      {events.length === 0 && contractName && (
        <div className="alert alert-warning py-2 small mb-3">
          No events found in ABI. Paste your ABI or compile the contract first.
        </div>
      )}

      {status.type !== 'idle' && (
        <div className={`alert py-2 small mb-3 alert-${status.type === 'success' ? 'success' : status.type === 'error' ? 'danger' : 'info'}`}>
          {status.message}
          {status.type === 'success' && (
            <div className="mt-1">Open the Remix terminal and run <code>cd subgraphs/{subgraphName} && npm install</code></div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button className="btn btn-sm btn-secondary" onClick={onClose}>Cancel</button>
        <button
          className="btn btn-sm btn-primary"
          onClick={handleCreate}
          disabled={status.type === 'loading'}
        >
          {status.type === 'loading' ? 'Creating...' : 'Create Subgraph'}
        </button>
      </div>
    </div>
  )
}
