import React, { useState, useEffect } from 'react'
import { fetchSubgraphSchema } from '../utils/graphNetworkApi'

interface QueryPlaygroundProps {
  initialEndpoint?: string
  initialName?: string
  apiKey: string
}

const DEFAULT_QUERY = `{
  # Replace with your entity name and fields
  # Example: transfers(first: 5) { id from to value }
}`

export const QueryPlayground: React.FC<QueryPlaygroundProps> = ({ initialEndpoint = '', initialName = '', apiKey }) => {
  const [endpoint, setEndpoint] = useState(initialEndpoint)
  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [variables, setVariables] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [schemaHints, setSchemaHints] = useState<string[]>([])
  const [history, setHistory] = useState<Array<{ endpoint: string; name: string; query: string }>>([])
  const [activeEndpointName, setActiveEndpointName] = useState(initialName)

  useEffect(() => {
    if (initialEndpoint) {
      setEndpoint(initialEndpoint)
      setActiveEndpointName(initialName)
      loadSchemaHints(initialEndpoint)
    }
  }, [initialEndpoint, initialName])

  const loadSchemaHints = async (url: string) => {
    if (!url) return
    const entities = await fetchSubgraphSchema(url)
    setSchemaHints(entities)
    if (entities.length > 0) {
      // Pre-fill a helpful default query
      const firstEntity = entities[0]
      setQuery(`{\n  ${firstEntity.charAt(0).toLowerCase() + firstEntity.slice(1)}s(first: 5) {\n    id\n  }\n}`)
    }
  }

  const handleEndpointChange = async (url: string) => {
    setEndpoint(url)
    setSchemaHints([])
    if (url.startsWith('http')) {
      await loadSchemaHints(url)
    }
  }

  const runQuery = async () => {
    if (!endpoint) {
      setError('Enter a subgraph endpoint URL.')
      return
    }
    setRunning(true)
    setError('')
    setResult(null)

    let vars: Record<string, any> = {}
    if (variables.trim()) {
      try {
        vars = JSON.parse(variables)
      } catch {
        setError('Variables must be valid JSON.')
        setRunning(false)
        return
      }
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: vars })
      })
      const json = await res.json()

      if (json.errors) {
        setError(json.errors.map((e: any) => e.message).join('\n'))
        if (json.data) setResult(JSON.stringify(json.data, null, 2))
      } else {
        setResult(JSON.stringify(json.data, null, 2))
        // Save to history
        const entry = { endpoint, name: activeEndpointName || endpoint, query }
        setHistory(prev => [entry, ...prev.filter(h => h.query !== query || h.endpoint !== endpoint)].slice(0, 5))
      }
    } catch (err: any) {
      setError(err.message || 'Request failed')
    } finally {
      setRunning(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      runQuery()
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '8px' }}>
      {/* Endpoint input */}
      <div>
        <label className="form-label small mb-1">
          Subgraph Endpoint
          {activeEndpointName && <span className="text-muted ms-2" style={{ fontSize: '11px' }}>({activeEndpointName})</span>}
        </label>
        <input
          className="form-control form-control-sm"
          value={endpoint}
          onChange={e => handleEndpointChange(e.target.value)}
          placeholder="https://gateway.thegraph.com/api/{API_KEY}/subgraphs/id/..."
          style={{ fontFamily: 'monospace', fontSize: '11px' }}
        />
      </div>

      {/* Schema hints */}
      {schemaHints.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          <span className="text-muted" style={{ fontSize: '10px', alignSelf: 'center' }}>Entities:</span>
          {schemaHints.slice(0, 8).map(hint => (
            <button
              key={hint}
              className="btn btn-outline-secondary"
              style={{ fontSize: '10px', padding: '1px 6px' }}
              onClick={() => setQuery(`{\n  ${hint.charAt(0).toLowerCase() + hint.slice(1)}s(first: 5) {\n    id\n  }\n}`)}
            >
              {hint}
            </button>
          ))}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="text-muted" style={{ fontSize: '10px' }}>Recent:</span>
          {history.slice(0, 3).map((h, i) => (
            <button
              key={i}
              className="btn btn-outline-secondary"
              style={{ fontSize: '10px', padding: '1px 6px', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={h.name}
              onClick={() => { setEndpoint(h.endpoint); setQuery(h.query); setActiveEndpointName(h.name) }}
            >
              {h.name}
            </button>
          ))}
        </div>
      )}

      {/* Query editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minHeight: 0 }}>
        <div style={{ flex: '0 0 55%', display: 'flex', flexDirection: 'column' }}>
          <label className="form-label small mb-1">
            Query <span className="text-muted" style={{ fontSize: '10px' }}>(Ctrl+Enter to run)</span>
          </label>
          <textarea
            className="form-control"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              fontFamily: 'monospace',
              fontSize: '12px',
              resize: 'none',
              minHeight: '120px'
            }}
          />
        </div>

        <div style={{ flex: '0 0 25%', display: 'flex', flexDirection: 'column' }}>
          <label className="form-label small mb-1">Variables <span className="text-muted" style={{ fontSize: '10px' }}>(JSON)</span></label>
          <textarea
            className="form-control"
            value={variables}
            onChange={e => setVariables(e.target.value)}
            placeholder='{}'
            style={{
              flex: 1,
              fontFamily: 'monospace',
              fontSize: '11px',
              resize: 'none',
              minHeight: '50px'
            }}
          />
        </div>
      </div>

      <button
        className="btn btn-sm btn-primary"
        onClick={runQuery}
        disabled={running || !endpoint}
      >
        {running ? 'Running...' : '▶ Run Query'}
      </button>

      {error && (
        <div className="alert alert-danger py-1 small mb-0" style={{ fontFamily: 'monospace', fontSize: '11px', whiteSpace: 'pre-wrap' }}>
          {error}
        </div>
      )}

      {result !== null && (
        <div style={{ flex: '0 0 auto' }}>
          <label className="form-label small mb-1">Result</label>
          <pre style={{
            background: 'var(--tertiary)',
            borderRadius: '4px',
            padding: '8px',
            fontSize: '11px',
            maxHeight: '200px',
            overflowY: 'auto',
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {result}
          </pre>
        </div>
      )}
    </div>
  )
}
