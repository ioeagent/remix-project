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

export type CirclesPluginConfig = {
  chainId: number
  chainConfig: CirclesConfig
  pinApiBase: string
  avatar: string | null
  operatorNamespace: string
  enforceChainId: boolean
  listDefaultLimit: number
}
