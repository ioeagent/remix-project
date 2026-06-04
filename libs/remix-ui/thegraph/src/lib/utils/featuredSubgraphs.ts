export interface FeaturedSubgraph {
  id: string
  displayName: string
  description: string
  network: string
  category: string
  endpointPath: string // relative to gateway base, requires API key
  studioSlug?: string // for Subgraph Studio links
  explorerUrl: string
}

export const FEATURED_SUBGRAPHS: FeaturedSubgraph[] = [
  {
    id: '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV',
    displayName: 'Uniswap V3',
    description: 'Uniswap V3 pools, swaps, positions, and liquidity on Ethereum mainnet',
    network: 'mainnet',
    category: 'DeFi',
    endpointPath: 'subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV',
    explorerUrl: 'https://thegraph.com/explorer/subgraphs/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV'
  },
  {
    id: 'Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g',
    displayName: 'Uniswap V3 (Arbitrum)',
    description: 'Uniswap V3 on Arbitrum One — pools, swaps, positions',
    network: 'arbitrum-one',
    category: 'DeFi',
    endpointPath: 'subgraphs/id/Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g',
    explorerUrl: 'https://thegraph.com/explorer/subgraphs/Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g'
  },
  {
    id: 'C2zniPn45RnLDGzVeGZCx2Sw3GXrbc9gL4ZfL8B8Em2P',
    displayName: 'Aave V3',
    description: 'Aave V3 lending protocol — deposits, borrows, liquidations on Ethereum',
    network: 'mainnet',
    category: 'DeFi',
    endpointPath: 'subgraphs/id/C2zniPn45RnLDGzVeGZCx2Sw3GXrbc9gL4ZfL8B8Em2P',
    explorerUrl: 'https://thegraph.com/explorer/subgraphs/C2zniPn45RnLDGzVeGZCx2Sw3GXrbc9gL4ZfL8B8Em2P'
  },
  {
    id: '5czhKZWDCqnNnmNnkCCMEA1DQgLaFfhA8oJb3pSzHhHG',
    displayName: 'ENS',
    description: 'Ethereum Name Service — domain registrations, transfers, and resolver data',
    network: 'mainnet',
    category: 'Identity',
    endpointPath: 'subgraphs/id/5czhKZWDCqnNnmNnkCCMEA1DQgLaFfhA8oJb3pSzHhHG',
    explorerUrl: 'https://thegraph.com/explorer/subgraphs/5czhKZWDCqnNnmNnkCCMEA1DQgLaFfhA8oJb3pSzHhHG'
  },
  {
    id: 'GqzP4Xaehti8KSfQmv3ZctFSjnSUYZ4En5NRsiTbvZpz',
    displayName: 'Compound V3',
    description: 'Compound V3 (Comet) markets, accounts, and liquidation data',
    network: 'mainnet',
    category: 'DeFi',
    endpointPath: 'subgraphs/id/GqzP4Xaehti8KSfQmv3ZctFSjnSUYZ4En5NRsiTbvZpz',
    explorerUrl: 'https://thegraph.com/explorer/subgraphs/GqzP4Xaehti8KSfQmv3ZctFSjnSUYZ4En5NRsiTbvZpz'
  },
  {
    id: 'AvWnEmhk3HyBwWJWmMEBthnBZkjBPgeuKoFDH4zme7yJ',
    displayName: 'Lido',
    description: 'Lido liquid staking — stETH submissions, transfers, and oracle data',
    network: 'mainnet',
    category: 'Staking',
    endpointPath: 'subgraphs/id/AvWnEmhk3HyBwWJWmMEBthnBZkjBPgeuKoFDH4zme7yJ',
    explorerUrl: 'https://thegraph.com/explorer/subgraphs/AvWnEmhk3HyBwWJWmMEBthnBZkjBPgeuKoFDH4zme7yJ'
  },
  {
    id: 'ELUcwgpm15LZJxLVQ9nQ3LvDEiXKKJDHhxnPwNa8Rstw',
    displayName: 'Curve Finance',
    description: 'Curve stableswap pools — liquidity, swaps, and gauge data',
    network: 'mainnet',
    category: 'DeFi',
    endpointPath: 'subgraphs/id/ELUcwgpm15LZJxLVQ9nQ3LvDEiXKKJDHhxnPwNa8Rstw',
    explorerUrl: 'https://thegraph.com/explorer/subgraphs/ELUcwgpm15LZJxLVQ9nQ3LvDEiXKKJDHhxnPwNa8Rstw'
  },
  {
    id: 'Bx9NL2LXqeEBTHGnCq5aYAkRKFGTQUHHxHcSDvJkAGGD',
    displayName: 'Nouns DAO',
    description: 'Nouns DAO governance — proposals, votes, auctions, and transfers',
    network: 'mainnet',
    category: 'Governance',
    endpointPath: 'subgraphs/id/Bx9NL2LXqeEBTHGnCq5aYAkRKFGTQUHHxHcSDvJkAGGD',
    explorerUrl: 'https://thegraph.com/explorer/subgraphs/Bx9NL2LXqeEBTHGnCq5aYAkRKFGTQUHHxHcSDvJkAGGD'
  }
]

export const CATEGORIES = ['All', 'DeFi', 'Identity', 'Staking', 'Governance', 'NFT']

export const GRAPH_GATEWAY_BASE = 'https://gateway.thegraph.com/api'
export const GRAPH_NETWORK_SUBGRAPH_ID = 'DZz4kDTdmzWLWsV373w2bSmoar3umKKH9y82SUKr5qmp'

export function getSubgraphEndpoint(apiKey: string, endpointPath: string): string {
  return `${GRAPH_GATEWAY_BASE}/${apiKey}/${endpointPath}`
}

export function getNetworkSubgraphEndpoint(apiKey: string): string {
  return `${GRAPH_GATEWAY_BASE}/${apiKey}/subgraphs/id/${GRAPH_NETWORK_SUBGRAPH_ID}`
}
