import { getNetworkSubgraphEndpoint } from './featuredSubgraphs'

export interface SubgraphResult {
  id: string
  displayName: string
  description: string
  network: string
  health: string
  synced: boolean
  queryFeesAmount: string
  stakedTokens: string
  endpointPath: string
  explorerUrl: string
}

const SEARCH_QUERY = `
  query SearchSubgraphs($text: String!, $first: Int!) {
    subgraphSearch(text: $text, first: $first) {
      id
      displayName
      description
      currentVersion {
        subgraphDeployment {
          network { id }
          stakedTokens
          queryFeesAmount
          indexingStatuses(first: 1) {
            health
            synced
          }
        }
      }
    }
  }
`

const TOP_SUBGRAPHS_QUERY = `
  query TopSubgraphs($first: Int!, $network: String) {
    subgraphs(
      first: $first
      orderBy: signalledTokens
      orderDirection: desc
      where: { currentVersion_not: null }
    ) {
      id
      displayName
      description
      currentVersion {
        subgraphDeployment {
          network { id }
          stakedTokens
          queryFeesAmount
          indexingStatuses(first: 1) {
            health
            synced
          }
        }
      }
    }
  }
`

async function queryGraphNetwork(apiKey: string, query: string, variables: Record<string, any>): Promise<any> {
  const endpoint = getNetworkSubgraphEndpoint(apiKey)
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables })
  })
  if (!res.ok) throw new Error(`Graph Network API error: ${res.status}`)
  const json = await res.json()
  if (json.errors) throw new Error(json.errors[0]?.message || 'GraphQL error')
  return json.data
}

function normalizeSubgraph(raw: any): SubgraphResult {
  const deployment = raw.currentVersion?.subgraphDeployment
  const status = deployment?.indexingStatuses?.[0]
  const network = deployment?.network?.id || 'unknown'
  return {
    id: raw.id,
    displayName: raw.displayName || raw.id,
    description: raw.description || '',
    network,
    health: status?.health || 'unknown',
    synced: status?.synced ?? false,
    queryFeesAmount: deployment?.queryFeesAmount || '0',
    stakedTokens: deployment?.stakedTokens || '0',
    endpointPath: `subgraphs/id/${raw.id}`,
    explorerUrl: `https://thegraph.com/explorer/subgraphs/${raw.id}`
  }
}

export async function searchSubgraphs(apiKey: string, query: string): Promise<SubgraphResult[]> {
  const data = await queryGraphNetwork(apiKey, SEARCH_QUERY, { text: query, first: 20 })
  return (data.subgraphSearch || []).map(normalizeSubgraph)
}

export async function getTopSubgraphs(apiKey: string, network?: string): Promise<SubgraphResult[]> {
  const data = await queryGraphNetwork(apiKey, TOP_SUBGRAPHS_QUERY, { first: 20, network: network || null })
  return (data.subgraphs || []).map(normalizeSubgraph)
}

// Introspect a subgraph schema to get entity names for the query playground hint
export async function fetchSubgraphSchema(endpoint: string): Promise<string[]> {
  const introspectQuery = `{ __schema { types { name kind fields { name } } } }`
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: introspectQuery })
    })
    const json = await res.json()
    const types: any[] = json.data?.__schema?.types || []
    // Return non-internal object type names (entities)
    return types
      .filter(t => t.kind === 'OBJECT' && !t.name.startsWith('_') && !t.name.startsWith('Query') && !t.name.startsWith('Subscription'))
      .map(t => t.name)
  } catch {
    return []
  }
}
