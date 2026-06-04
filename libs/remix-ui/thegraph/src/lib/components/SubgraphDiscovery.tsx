import React, { useState, useEffect, useCallback } from 'react'
import { FEATURED_SUBGRAPHS, CATEGORIES, FeaturedSubgraph, getSubgraphEndpoint } from '../utils/featuredSubgraphs'
import { searchSubgraphs, SubgraphResult } from '../utils/graphNetworkApi'

interface SubgraphDiscoveryProps {
  apiKey: string
  onUseSubgraph: (endpoint: string, name: string) => void
}

type DisplaySubgraph = FeaturedSubgraph | SubgraphResult

function isFeatured(s: DisplaySubgraph): s is FeaturedSubgraph {
  return 'endpointPath' in s && 'category' in s
}

export const SubgraphDiscovery: React.FC<SubgraphDiscoveryProps> = ({ apiKey, onUseSubgraph }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [results, setResults] = useState<DisplaySubgraph[]>([])
  const [selected, setSelected] = useState<DisplaySubgraph | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState('')

  // Populate with featured list on load
  useEffect(() => {
    showFeatured('All')
  }, [])

  const showFeatured = (category: string) => {
    const filtered = category === 'All'
      ? FEATURED_SUBGRAPHS
      : FEATURED_SUBGRAPHS.filter(s => s.category === category)
    setResults(filtered)
    setSelected(null)
  }

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat)
    if (!searchQuery) showFeatured(cat)
  }

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      showFeatured(selectedCategory)
      return
    }
    if (!apiKey) {
      // Fall back to filtering featured list by name
      const filtered = FEATURED_SUBGRAPHS.filter(s =>
        s.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setResults(filtered)
      setSelected(null)
      return
    }
    setSearching(true)
    setSearchError('')
    try {
      const found = await searchSubgraphs(apiKey, searchQuery)
      setResults(found)
      setSelected(null)
    } catch (err: any) {
      setSearchError(err.message || 'Search failed')
      // Fallback to featured filter
      const filtered = FEATURED_SUBGRAPHS.filter(s =>
        s.displayName.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setResults(filtered)
    } finally {
      setSearching(false)
    }
  }, [searchQuery, apiKey, selectedCategory])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const getEndpoint = (subgraph: DisplaySubgraph): string => {
    if (!apiKey) return ''
    const path = isFeatured(subgraph) ? subgraph.endpointPath : `subgraphs/id/${subgraph.id}`
    return getSubgraphEndpoint(apiKey, path)
  }

  const getExplorerUrl = (subgraph: DisplaySubgraph): string => {
    return subgraph.explorerUrl || `https://thegraph.com/explorer/subgraphs/${subgraph.id}`
  }

  const getHealth = (subgraph: DisplaySubgraph): { label: string; color: string } => {
    if (isFeatured(subgraph)) return { label: 'Featured', color: '#6c757d' }
    const h = (subgraph as SubgraphResult).health
    if (h === 'healthy') return { label: '✓ Healthy', color: '#28a745' }
    if (h === 'unhealthy') return { label: '⚠ Unhealthy', color: '#ffc107' }
    return { label: h || 'Unknown', color: '#6c757d' }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '8px' }}>
      {/* Search bar */}
      <div style={{ display: 'flex', gap: '6px' }}>
        <input
          className="form-control form-control-sm"
          placeholder={apiKey ? 'Search all subgraphs...' : 'Search featured subgraphs...'}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ flex: 1 }}
        />
        <button
          className="btn btn-sm btn-primary"
          onClick={handleSearch}
          disabled={searching}
          style={{ whiteSpace: 'nowrap' }}
        >
          {searching ? '...' : 'Search'}
        </button>
      </div>

      {!apiKey && (
        <div className="alert alert-secondary py-1 small mb-0" style={{ fontSize: '11px' }}>
          Add a free API key in Settings → Services → The Graph to search all published subgraphs.
        </div>
      )}

      {searchError && (
        <div className="alert alert-warning py-1 small mb-0" style={{ fontSize: '11px' }}>
          {searchError} — showing featured results instead.
        </div>
      )}

      {/* Category tabs */}
      {!searchQuery && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-outline-secondary'}`}
              style={{ fontSize: '11px', padding: '2px 8px' }}
              onClick={() => handleCategoryChange(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Results list + detail pane */}
      <div style={{ display: 'flex', gap: '8px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* List */}
        <div style={{ flex: '0 0 45%', overflowY: 'auto', borderRight: '1px solid var(--border)', paddingRight: '8px' }}>
          {results.length === 0 && (
            <div className="text-muted small" style={{ padding: '8px' }}>No results found.</div>
          )}
          {results.map((subgraph, i) => {
            const health = getHealth(subgraph)
            const isSelected = selected?.id === subgraph.id
            return (
              <div
                key={subgraph.id || i}
                onClick={() => setSelected(subgraph)}
                style={{
                  padding: '8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  backgroundColor: isSelected ? 'var(--secondary)' : 'transparent',
                  border: isSelected ? '1px solid var(--primary)' : '1px solid transparent'
                }}
              >
                <div style={{ fontWeight: 500, fontSize: '12px', marginBottom: '2px' }}>
                  {subgraph.displayName}
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', background: 'var(--tertiary)', padding: '1px 5px', borderRadius: '3px' }}>
                    {subgraph.network}
                  </span>
                  {isFeatured(subgraph) && (
                    <span style={{ fontSize: '10px', color: '#6c757d', background: 'var(--tertiary)', padding: '1px 5px', borderRadius: '3px' }}>
                      {subgraph.category}
                    </span>
                  )}
                  <span style={{ fontSize: '10px', color: health.color }}>{health.label}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Detail pane */}
        <div style={{ flex: 1, overflowY: 'auto', paddingLeft: '4px' }}>
          {selected ? (
            <SubgraphDetail
              subgraph={selected}
              apiKey={apiKey}
              endpoint={getEndpoint(selected)}
              explorerUrl={getExplorerUrl(selected)}
              onUseSubgraph={onUseSubgraph}
            />
          ) : (
            <div className="text-muted small" style={{ padding: '8px' }}>
              Select a subgraph to see details.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface SubgraphDetailProps {
  subgraph: DisplaySubgraph
  apiKey: string
  endpoint: string
  explorerUrl: string
  onUseSubgraph: (endpoint: string, name: string) => void
}

const SubgraphDetail: React.FC<SubgraphDetailProps> = ({ subgraph, apiKey, endpoint, explorerUrl, onUseSubgraph }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!endpoint) return
    navigator.clipboard.writeText(endpoint).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div style={{ fontSize: '12px' }}>
      <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>{subgraph.displayName}</div>
      <div style={{ color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.4 }}>
        {subgraph.description || 'No description available.'}
      </div>

      <div style={{ marginBottom: '10px' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Network: </span>
        <span style={{ fontFamily: 'monospace' }}>{subgraph.network}</span>
      </div>

      {!isFeatured(subgraph) && (
        <div style={{ marginBottom: '10px' }}>
          <span style={{ color: 'var(--text-secondary)' }}>Status: </span>
          <span style={{ color: (subgraph as SubgraphResult).health === 'healthy' ? '#28a745' : '#ffc107' }}>
            {(subgraph as SubgraphResult).health}
            {(subgraph as SubgraphResult).synced ? ' · synced' : ' · syncing'}
          </span>
        </div>
      )}

      {apiKey ? (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ color: 'var(--text-secondary)', marginBottom: '4px' }}>Endpoint:</div>
          <div style={{
            fontFamily: 'monospace',
            fontSize: '10px',
            background: 'var(--tertiary)',
            padding: '4px 6px',
            borderRadius: '4px',
            wordBreak: 'break-all',
            marginBottom: '4px'
          }}>
            {endpoint}
          </div>
          <button className="btn btn-sm btn-outline-secondary" style={{ fontSize: '11px' }} onClick={handleCopy}>
            {copied ? '✓ Copied' : 'Copy Endpoint'}
          </button>
        </div>
      ) : (
        <div className="alert alert-secondary py-1 mb-2" style={{ fontSize: '11px' }}>
          Add an API key in Settings to get the query endpoint.
        </div>
      )}

      <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
        {apiKey && (
          <button
            className="btn btn-sm btn-primary"
            onClick={() => onUseSubgraph(endpoint, subgraph.displayName)}
          >
            Use in Playground →
          </button>
        )}
        <button
          className="btn btn-sm btn-outline-secondary"
          onClick={() => window.open(explorerUrl, '_blank')}
        >
          View on Explorer ↗
        </button>
      </div>
    </div>
  )
}
