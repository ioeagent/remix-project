import { type CirclesConfig } from '@circles-sdk/sdk'

export type CirclesSnippetPayload = {
  '@context': string
  '@type': 'Snippet'
  content: string
  createdAt: number
  title?: string
  language?: string
  source?: {
    file?: string
    workspace?: string
  }
}

export type CirclesSnippetSummary = {
  name: string
  cid: string
  createdAt?: number
  title?: string
  language?: string
  file?: string
}

export type CirclesAvatarInfo = {
  version: number
  type: string
  avatar: string
  tokenId: string
  name?: string
  cidV0Digest?: string
}

export type SmartAccountCirclesMetadata = {
  address: string
  salt: number
  ownerEOA: string
  timestamp: number
  circles?: CirclesAvatarInfo
}

export type CirclesPluginConfig = {
  chainId: number
  chainConfig: CirclesConfig
  pinApiBase: string
  avatar: string | null
  operatorNamespace: string
  enforceChainId: boolean
  listDefaultLimit: number
}
