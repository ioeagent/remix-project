import { Plugin } from '@remixproject/engine'
import { ethers, isAddress } from 'ethers'
import { Sdk, type CirclesConfig } from '@circles-sdk/sdk'
import { normalizeEvmAddress } from '@circles-market/core'
import { type AvatarSigner } from '@circles-market/signers'
import { type ProfilesBindings } from '@circles-profile/core'
import { CirclesPluginConfig, CirclesSnippetPayload, CirclesSnippetSummary } from './types'
import { isRecord, toErrorMessage, sanitizePinApiBase, sanitizeChainConfig } from './utils'
import * as storage from './storage'
import { getCirclesSdk, getBindings, getSafeSigner } from './logic/sdk'
import { saveSnippet, listSnippets } from './logic/snippets'

const profile = {
  name: 'circles',
  description: 'Circles snippet manager',
  methods: [
    'addSnippet',
    'saveSnippet',
    'listSnippets',
    'getSnippet',
    'setConfig',
    'getConfig',
    'setAvatarAddress',
    'getAvatarAddress',
    'querySafesByOwner',
    'addSmartAccountToStorage'
  ],
  events: ['snippetSaved', 'configChanged'],
  version: '0.1.0'
}

export class Circles extends Plugin {
  private config: CirclesPluginConfig
  private sdkPromise: Promise<Sdk> | null = null
  private bindingsPromise: Promise<ProfilesBindings> | null = null
  private safeSignerPromise: Promise<AvatarSigner> | null = null

  constructor() {
    console.log(`circles: constructor()`)
    super(profile)
    this.config = storage.loadConfig()
  }

  async addSmartAccountToStorage(safeAddress: string, ownerEOA?: string, circlesMetadata?: any): Promise<string> {
    console.log(`circles: addSmartAccountToStorage(safeAddress: ${safeAddress}, ownerEOA: ${ownerEOA})`)
    try {
      const trimmed = (safeAddress ?? '').trim()
      const isEmpty = trimmed.length === 0
      if (isEmpty) {
        await this.call('notification', 'toast', 'Safe address is required')
        throw new Error('Safe address is required')
      }

      const isValid = isAddress(trimmed)
      if (!isValid) {
        await this.call('notification', 'toast', 'Invalid safe address')
        throw new Error('Invalid safe address')
      }

      const normalized = normalizeEvmAddress(trimmed)
      const smartAccountsObj = storage.getSmartAccountsFromStorage()

      const chainId = 100 // Circles currently only works on Gnosis Chain
      if (!smartAccountsObj[chainId]) {
        smartAccountsObj[chainId] = {}
      }

      // Check if account already exists
      if (smartAccountsObj[chainId][normalized]) {
        console.log(`circles: Safe ${normalized} already in storage for chain ${chainId}`)
        throw new Error('Account already exists')
      }

      // Add the new account with metadata compatible with run-tab
      smartAccountsObj[chainId][normalized] = {
        address: normalized,
        salt: 0, // We don't know the salt
        ownerEOA: ownerEOA || '',
        timestamp: Date.now(),
        circles: circlesMetadata || undefined
      }

      storage.saveSmartAccountsToStorage(smartAccountsObj)

      console.log(`circles: Stored safe ${normalized} in localStorage for chain ${chainId}`)
      await this.call('notification', 'toast', `Safe account ${normalized} stored`)

      return normalized
    } catch (err) {
      const message = toErrorMessage(err)
      const alreadyExists = message.toLowerCase().includes('already exists')
      if (!alreadyExists) {
        await this.call('notification', 'toast', `Failed to store smart account: ${message}`)
      }
      throw err
    }
  }

  async querySafesByOwner(ownerAddress: string): Promise<string[]> {
    console.log(`circles: querySafesByOwner(ownerAddress: ${ownerAddress})`)
    try {
      const sdk = await this.getCirclesSdk()
      const ownerLc = ownerAddress.toLowerCase()

      const result = await sdk.data.rpc.call<{
        columns: string[]
        rows: any[][]
      }>('circles_query', [
        {
          Namespace: 'V_Safe',
          Table: 'Owners',
          Columns: ['safeAddress'],
          Filter: [
            {
              Type: 'FilterPredicate',
              FilterType: 'Equals',
              Column: 'owner',
              Value: ownerLc,
            },
          ],
          Order: [],
          Limit: 1000,
        },
      ])

      // Find index of safeAddress column just in case ordering differs
      const colIdx = result.result.columns.findIndex(
        (c) => c.toLowerCase() === 'safeaddress'
      )

      const safesRaw: string[] = (colIdx >= 0
        ? result.result.rows.map((r) => r[colIdx])
        : result.result.rows.map((r) => r[0]) // fallback if columns missing
      ).filter(Boolean)

      // Normalize, checksum and deduplicate
      const unique = Array.from(
        new Set(
          safesRaw.map((s) => ethers.getAddress(s).toLowerCase())
        )
      )

      return unique
    } catch (err) {
      console.error(`circles: Failed to query safes for owner ${ownerAddress}:`, err)
      return []
    }
  }

  async getAvatarInfoBatch(addresses: string[]): Promise<any[]> {
    console.log(`circles: getAvatarInfoBatch(addresses: ${addresses})`)
    try {
      const sdk = await this.getCirclesSdk()
      const result = await sdk.data.rpc.call<any[]>('circles_getAvatarInfoBatch', [addresses])
      return result.result
    } catch (err) {
      console.error('circles: Failed to get avatar info batch:', err)
      return new Array(addresses.length).fill(null)
    }
  }

  onGnosisChain(eoa: string, safeInformation?: any): void {
    if (!safeInformation) {
      console.log(`circles: Switched to Gnosis Chain account ${eoa}. Right now we only support Safes. Please switch to an existing Safe this account owns, or create a new one.`)

      void this.querySafesByOwner(eoa).then(async (safes) => {
        if (safes.length === 0) {
          console.log(`circles: No Safes found for owner ${eoa}`)
          return
        }

        console.log(`circles: Found ${safes.length} Safes owned by ${eoa}:`, safes)
        void this.call('terminal', 'log', {
          type: 'log',
          value: `Circles: Found ${safes.length} Safes owned by ${eoa}: ${safes.join(', ')}. Please switch to one of them.`
        })

        // Store all safes to localStorage
        console.log(`circles: Storing ${safes.length} Safe(s) to localStorage...`)
        let storedCount = 0
        let skippedCount = 0

        const avatarInfos = await this.getAvatarInfoBatch(safes)

        for (let i = 0; i < safes.length; i++) {
          const safe = safes[i]
          const info = avatarInfos[i]
          try {
            await this.addSmartAccountToStorage(safe, eoa, info)
            storedCount++
          } catch (err) {
            const message = toErrorMessage(err)
            const alreadyExists = message.toLowerCase().includes('already')
            if (alreadyExists) {
              skippedCount++
            }
          }
        }

        console.log(`circles: Storage complete - Stored: ${storedCount}, Skipped (duplicate): ${skippedCount}`)
        void this.call('terminal', 'log', {
          type: 'log',
          value: `Circles: Stored ${storedCount} Safe(s) to localStorage (${skippedCount} were already present).`
        })
      })

      return
    }

    const owner = safeInformation.ownerEOA
    const safe = safeInformation.address

    // Update configuration with the new Safe address as the avatar
    this.setAvatarAddress(safe).then(() => {
      this.resetCachedClients()

      // Prime the SDK and Bindings
      void this.getCirclesSdk()
      void this.getBindings()

      console.log(`circles: Initialized SDK and Bindings for Safe: ${safe} (Owner: ${owner})`)
    }).catch(err => {
      console.error(`circles: Failed to initialize for Safe ${safe}:`, err)
    })
  }

  onOtherChain(): void {
    console.log('circles: Tearing down SDK and bindings as we are no longer on Gnosis Chain.')
    this.resetCachedClients()
  }

  onActivation(): void {
    console.log(`circles: onActivation()`)
    void this.call('terminal', 'log', { type: 'log', value: 'Circles plugin activated' })
    this.on('udapp', 'accountChanged', (account, safeInformation, networkName) => {
      if (isAddress(account) && networkName === 'Gnosis (100) network') {
        console.log('circles: Switched to Gnosis Chain account: ', account, safeInformation, networkName)
        this.onGnosisChain(account, safeInformation);
      } else {
        console.log('circles: Switched to other account: ', account, safeInformation, networkName)
        this.onOtherChain()
      }
    })
  }

  getConfig(): CirclesPluginConfig {
    console.log(`circles: getConfig()`)
    return { ...this.config, chainConfig: { ...this.config.chainConfig } }
  }

  async setConfig(next: Partial<CirclesPluginConfig>): Promise<CirclesPluginConfig> {
    console.log(`circles: setConfig(next: ${next})`)
    const updated = { ...this.config }

    const hasChainId = typeof next.chainId === 'number' && Number.isFinite(next.chainId)
    if (hasChainId) {
      const chainIdOk = next.chainId > 0 && Number.isInteger(next.chainId)
      if (!chainIdOk) {
        throw new Error('chainId must be a positive integer')
      }
      updated.chainId = next.chainId
    }

    const hasPinApiBase = typeof next.pinApiBase === 'string'
    if (hasPinApiBase) {
      updated.pinApiBase = sanitizePinApiBase(next.pinApiBase)
    }

    const hasAvatar = typeof next.avatar === 'string' || next.avatar === null
    if (hasAvatar) {
      updated.avatar = next.avatar ? normalizeEvmAddress(next.avatar) : null
    }

    const hasOperatorNamespace = typeof next.operatorNamespace === 'string'
    if (hasOperatorNamespace) {
      const trimmed = next.operatorNamespace.trim()
      const isEmpty = trimmed.length === 0
      if (isEmpty) {
        throw new Error('operatorNamespace cannot be empty')
      }
      updated.operatorNamespace = trimmed
    }

    const hasEnforceChainId = typeof next.enforceChainId === 'boolean'
    if (hasEnforceChainId) {
      updated.enforceChainId = next.enforceChainId
    }

    const hasListDefaultLimit = typeof next.listDefaultLimit === 'number' && Number.isFinite(next.listDefaultLimit)
    if (hasListDefaultLimit) {
      const limitOk = next.listDefaultLimit > 0 && Number.isInteger(next.listDefaultLimit)
      if (!limitOk) {
        throw new Error('listDefaultLimit must be a positive integer')
      }
      updated.listDefaultLimit = next.listDefaultLimit
    }

    const hasChainConfig = typeof next.chainConfig !== 'undefined'
    if (hasChainConfig) {
      updated.chainConfig = sanitizeChainConfig(next.chainConfig as CirclesConfig)
    }

    this.config = updated
    storage.persistConfig(updated)

    this.resetCachedClients()
    this.emit('configChanged', this.getConfig())

    await this.call('notification', 'toast', 'Circles config updated')
    return this.getConfig()
  }

  async setAvatarAddress(avatar: string): Promise<string> {
    console.log(`circles: setAvatarAddress(avatar: ${avatar})`)
    const normalized = normalizeEvmAddress(avatar)
    await this.setConfig({ avatar: normalized })
    return normalized
  }

  getAvatarAddress(): string | null {
    console.log(`circles: getAvatarAddress()`)
    return this.config.avatar
  }

  async addSnippet(text: string): Promise<{ snippetCid: string; linkName: string; txHash?: string }> {
    console.log(`circles: addSnippet(text: ${text})`)
    return await this.saveSnippet(text, {})
  }

  async saveSnippet(
    text: string,
    opts: {
      title?: string
      language?: string
      file?: string
      workspace?: string
    } = {},
  ): Promise<{ snippetCid: string; linkName: string; txHash?: string }> {
    console.log(`circles: saveSnippet(text: ${text}, opts: ${opts})`)
    const avatar = this.ensureAvatarConfigured()
    const bindings = await this.getBindings()
    return await saveSnippet(this.config, text, opts, avatar, bindings, this.call.bind(this), this.emit.bind(this))
  }

  async listSnippets(opts: { limit?: number; includePayload?: boolean } = {}): Promise<CirclesSnippetSummary[]> {
    console.log(`circles: listSnippets(opts: ${opts})`)
    const avatar = this.ensureAvatarConfigured()
    const bindings = await this.getBindings()
    return await listSnippets(this.config, opts, avatar, bindings, this.call.bind(this))
  }

  async getSnippet(cid: string): Promise<CirclesSnippetPayload> {
    console.log(`circles: getSnippet(cid: ${cid})`)
    try {
      const trimmed = (cid ?? '').trim()
      const isEmpty = trimmed.length === 0
      if (isEmpty) {
        throw new Error('cid is required')
      }

      const avatar = this.ensureAvatarConfigured()
      const bindings = await this.getBindings()

      const raw = await bindings.getJsonLd(trimmed)
      if (!isRecord(raw)) {
        throw new Error('Snippet payload is not an object')
      }

      const isSnippet = raw['@type'] === 'Snippet'
      if (!isSnippet) {
        await this.call('terminal', 'log', { type: 'warn', value: `CID ${trimmed} is not a Snippet payload` })
      }

      const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : 0
      const title = typeof raw.title === 'string' ? raw.title : undefined
      const language = typeof raw.language === 'string' ? raw.language : undefined

      let file: string | undefined
      const source = raw.source
      const sourceOk = isRecord(source)
      if (sourceOk) {
        const fileField = source.file
        file = typeof fileField === 'string' ? fileField : undefined
      }

      const payload: CirclesSnippetPayload = {
        '@context': String(raw['@context'] ?? 'https://aboutcircles.com/contexts/circles-gist/'),
        '@type': 'Snippet',
        content: typeof raw.content === 'string' ? raw.content : '',
        createdAt,
        title,
        language,
        source: { file },
      }

      await this.call('terminal', 'log', { type: 'log', value: `Loaded snippet ${trimmed} for avatar ${avatar}` })
      return payload
    } catch (err) {
      const message = toErrorMessage(err)
      await this.call('notification', 'toast', `Circles getSnippet failed: ${message}`)
      throw err
    }
  }

  private ensureAvatarConfigured(): string {
    console.log(`circles: ensureAvatarConfigured()`)
    const avatar = this.config.avatar
    const hasAvatar = typeof avatar === 'string' && avatar.trim().length > 0
    if (!hasAvatar) {
      throw new Error('Circles avatar address not set. Call circles.setAvatarAddress(0x...) first.')
    }
    return normalizeEvmAddress(avatar)
  }

  private resetCachedClients(): void {
    console.log(`circles: resetCachedClients()`)
    this.sdkPromise = null
    this.bindingsPromise = null
    this.safeSignerPromise = null
  }

  private async getCirclesSdk(): Promise<Sdk> {
    console.log(`circles: getCirclesSdk()`)
    if (this.sdkPromise) return this.sdkPromise
    this.sdkPromise = getCirclesSdk(this.config, this.call.bind(this))
    return this.sdkPromise
  }

  private async getBindings(): Promise<ProfilesBindings> {
    console.log(`circles: getBindings()`)
    if (this.bindingsPromise) return this.bindingsPromise
    this.bindingsPromise = getBindings(this.config, this.call.bind(this))
    return this.bindingsPromise
  }

  private async getSafeSigner(): Promise<AvatarSigner> {
    console.log(`circles: getSafeSigner()`)
    if (this.safeSignerPromise) return this.safeSignerPromise
    const avatar = this.ensureAvatarConfigured()
    this.safeSignerPromise = getSafeSigner(this.config, avatar, this.call.bind(this))
    return this.safeSignerPromise
  }
}
