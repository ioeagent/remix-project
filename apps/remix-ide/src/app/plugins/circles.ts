import { Plugin } from '@remixproject/engine'
import { ethers } from 'ethers'
import { Sdk, type CirclesConfig } from '@circles-sdk/sdk'
import { SignersClientImpl, type WalletProvider, type AvatarSigner } from '@circles-market/signers'
import { normalizeEvmAddress } from '@circles-market/core'
import {
  createCirclesSdkProfilesBindings,
  buildLinkDraft,
  canonicaliseLink,
  insertIntoHead,
  loadIndex,
  loadProfileOrInit,
  rebaseAndSaveProfile,
  saveHeadAndIndex,
  type CustomDataLink,
  type ProfilesBindings,
  type Cid
} from '@circles-profile/core'

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
    'getAvatarAddress'
  ],
  events: ['snippetSaved', 'configChanged'],
  version: '0.1.0'
}

const STORAGE_KEY = 'remix:circles-plugin:config'

const DEFAULT_CHAIN_CONFIG: CirclesConfig = {
  circlesRpcUrl: 'http://localhost:8545',
  pathfinderUrl: 'https://pathfinder.aboutcircles.com',
  profileServiceUrl: 'https://rpc.aboutcircles.com/profiles/',
  v1HubAddress: '0x29b9a7fbb8995b2423a71cc17cf9810798f6c543',
  v2HubAddress: '0xc12C1E50ABB450d6205Ea2C3Fa861b3B834d13e8',
  nameRegistryAddress: '0xA27566fD89162cC3D40Cb59c87AAaA49B85F3474',
  migrationAddress: '0xD44B8dcFBaDfC78EA64c55B705BFc68199B56376',
  baseGroupMintPolicy: '0xcCa27c26CF7BAC2a9928f42201d48220F0e3a549',
  standardTreasury: '0x08F90aB73A515308f03A718257ff9887ED330C6e',
  coreMembersGroupDeployer: '0xFEca40Eb02FB1f4F5F795fC7a03c1A27819B1Ded',
  baseGroupFactory: '0xD0B5Bd9962197BEaC4cbA24244ec3587f19Bd06d',
}

const DEFAULT_CONFIG: CirclesPluginConfig = {
  chainId: 100,
  chainConfig: DEFAULT_CHAIN_CONFIG,
  pinApiBase: 'https://market-api.aboutcircles.com/',
  avatar: null,
  operatorNamespace: '0xde374ece6fa50e781e81aac78e811b33d16912c7',
  enforceChainId: true,
  listDefaultLimit: 50,
}

function isRecord(v: unknown): v is Record<string, unknown> {
  const isObject = typeof v === 'object'
  const isNotNull = v !== null
  const isArray = Array.isArray(v)
  return isObject && isNotNull && !isArray
}

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message || err.name
  }
  if (typeof err === 'string') {
    return err
  }
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

function sanitizePinApiBase(v: string): string {
  const trimmed = v.trim()
  const isHttp = /^https?:\/\//i.test(trimmed)
  if (!isHttp) {
    throw new Error('pinApiBase must start with http:// or https://')
  }
  return trimmed.replace(/\/+$/, '') + '/'
}

function sanitizeChainConfig(v: CirclesConfig): CirclesConfig {
  const cc = v as any
  const hasPathfinderUrl = typeof cc?.pathfinderUrl === 'string' && cc.pathfinderUrl.length > 0
  const hasCirclesRpcUrl = typeof cc?.circlesRpcUrl === 'string' && cc.circlesRpcUrl.length > 0
  const hasV1HubAddress = typeof cc?.v1HubAddress === 'string' && cc.v1HubAddress.length > 0
  const hasV2HubAddress = typeof cc?.v2HubAddress === 'string' && cc.v2HubAddress.length > 0
  const hasMigrationAddress = typeof cc?.migrationAddress === 'string' && cc.migrationAddress.length > 0

  const isValid = hasPathfinderUrl && hasCirclesRpcUrl && hasV1HubAddress && hasV2HubAddress && hasMigrationAddress

  if (!isValid) {
    throw new Error('chainConfig is missing required fields')
  }

  return {
    pathfinderUrl: String(cc.pathfinderUrl),
    circlesRpcUrl: String(cc.circlesRpcUrl),
    v1HubAddress: normalizeEvmAddress(cc.v1HubAddress) as `0x${string}`,
    v2HubAddress: normalizeEvmAddress(cc.v2HubAddress) as `0x${string}`,
    migrationAddress: normalizeEvmAddress(cc.migrationAddress) as `0x${string}`,
  }
}

export class Circles extends Plugin {
  private config: CirclesPluginConfig
  private readonly signers = new SignersClientImpl()

  private sdkPromise: Promise<Sdk> | null = null
  private bindingsPromise: Promise<ProfilesBindings> | null = null
  private safeSignerPromise: Promise<AvatarSigner> | null = null

  constructor() {
    super(profile)
    this.config = this.loadConfig()
  }

  onActivation(): void {
    void this.call('terminal', 'log', { type: 'log', value: 'Circles plugin activated' })
    this.on('udapp', 'accountChanged', (account, safeInformation) => {
      console.log('account changed to ', account, safeInformation)
    })
  }

  getConfig(): CirclesPluginConfig {
    return { ...this.config, chainConfig: { ...this.config.chainConfig } }
  }

  async setConfig(next: Partial<CirclesPluginConfig>): Promise<CirclesPluginConfig> {
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
    this.persistConfig(updated)

    this.resetCachedClients()
    this.emit('configChanged', this.getConfig())

    await this.call('notification', 'toast', 'Circles config updated')
    return this.getConfig()
  }

  async setAvatarAddress(avatar: string): Promise<string> {
    const normalized = normalizeEvmAddress(avatar)
    await this.setConfig({ avatar: normalized })
    return normalized
  }

  getAvatarAddress(): string | null {
    return this.config.avatar
  }

  async addSnippet(text: string): Promise<{ snippetCid: string; linkName: string; txHash?: string }> {
    return await this.saveSnippet(text, {})
  }

  async saveSnippet(
    text: string,
    opts: {
      title?: string
      language?: string
      file?: string
      workspace?: string
    } = {}
  ): Promise<{ snippetCid: string; linkName: string; txHash?: string }> {
    try {
      const isEmpty = !text || text.trim().length === 0
      if (isEmpty) {
        await this.call('notification', 'toast', 'No code selected')
        throw new Error('No code selected')
      }

      const avatar = this.ensureAvatarConfigured()

      const bindings = await this.getBindings()
      const signer = await this.getSafeSigner()

      const activeFile = await this.call('fileManager', 'getCurrentFile')
      const file =
        typeof opts.file === 'string'
          ? opts.file
          : typeof activeFile === 'string'
            ? activeFile
            : undefined

      const nowSec = Math.floor(Date.now() / 1000)
      const snippet: CirclesSnippetPayload = {
        '@context': 'https://aboutcircles.com/contexts/circles-gist/',
        '@type': 'Snippet',
        content: text,
        createdAt: nowSec,
        title: opts.title,
        language: opts.language,
        source: {
          file,
          workspace: opts.workspace
        }
      }

      await this.call('notification', 'toast', 'Saving snippet to Circles…')

      const snippetCid = await bindings.putJsonLd(snippet)
      const linkName = `snippet/${Date.now()}`

      const linkDraft: CustomDataLink = await buildLinkDraft({
        name: linkName,
        cid: snippetCid,
        chainId: this.config.chainId,
        signerAddress: avatar
      })

      const preimage = canonicaliseLink(linkDraft)
      const signature = await signer.signBytes(preimage)
      linkDraft.signature = signature

      const { profile: prof } = await loadProfileOrInit(bindings, avatar)
      const namespaces = isRecord(prof.namespaces) ? prof.namespaces : {}
      const currentIndexCid = (namespaces[this.config.operatorNamespace] as string | null | undefined) ?? null

      const { index, head } = await loadIndex(bindings, currentIndexCid)
      const { closedHead } = insertIntoHead(head, linkDraft)
      const { indexCid } = await saveHeadAndIndex(bindings, head, index, closedHead)

      const profileCid = await rebaseAndSaveProfile(bindings, avatar, (p) => {
        if (!isRecord(p.namespaces)) {
          p.namespaces = {}
        }
        p.namespaces[this.config.operatorNamespace] = indexCid
      })

      const txHashRaw = await bindings.updateAvatarProfileDigest(avatar, profileCid)
      const txHash = typeof txHashRaw === 'string' && txHashRaw.trim().length > 0 ? txHashRaw.trim() : undefined

      await this.call('terminal', 'log', { type: 'log', value: `Circles snippet saved: ${snippetCid}` })
      if (txHash) {
        await this.call('terminal', 'log', { type: 'log', value: `Profile update tx: ${txHash}` })
      }

      await this.call('notification', 'toast', 'Snippet saved to Circles profile')
      this.emit('snippetSaved', { snippetCid, linkName, txHash })

      return { snippetCid, linkName, txHash }
    } catch (err) {
      const message = toErrorMessage(err)
      await this.call('notification', 'toast', `Circles snippet save failed: ${message}`)
      throw err
    }
  }

  async listSnippets(opts: { limit?: number; includePayload?: boolean } = {}): Promise<CirclesSnippetSummary[]> {
    try {
      const avatar = this.ensureAvatarConfigured()
      const bindings = await this.getBindings()

      const { profile: prof } = await loadProfileOrInit(bindings, avatar)
      const namespaces = isRecord(prof.namespaces) ? prof.namespaces : {}
      const indexCid = (namespaces[this.config.operatorNamespace] as string | null | undefined) ?? null

      const hasIndex = typeof indexCid === 'string' && indexCid.length > 0
      if (!hasIndex) {
        return []
      }

      const allLinksNewestFirst = await this.loadLinksNewestFirst(bindings, indexCid)

      const limit =
        typeof opts.limit === 'number' && Number.isFinite(opts.limit)
          ? Math.max(1, Math.trunc(opts.limit))
          : this.config.listDefaultLimit

      const sliced = allLinksNewestFirst.slice(0, limit)

      const includePayload = opts.includePayload === true
      if (!includePayload) {
        return sliced.map((l) => ({ name: l.name, cid: l.cid }))
      }

      const payloads = await Promise.all(
        sliced.map(async (l) => {
          const raw = await bindings.getJsonLd(l.cid).catch(() => null)
          if (!raw || !isRecord(raw)) {
            return { link: l, payload: null as CirclesSnippetPayload | null }
          }
          const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : undefined
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
            createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0,
            title,
            language,
            source: { file }
          }
          return {
            link: l,
            payload
          }
        })
      )

      return payloads.map((x) => ({
        name: x.link.name,
        cid: x.link.cid,
        createdAt: x.payload?.createdAt,
        title: x.payload?.title,
        language: x.payload?.language,
        file: x.payload?.source?.file
      }))
    } catch (err) {
      const message = toErrorMessage(err)
      await this.call('notification', 'toast', `Circles listSnippets failed: ${message}`)
      throw err
    }
  }

  async getSnippet(cid: string): Promise<CirclesSnippetPayload> {
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
        source: { file }
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
    const avatar = this.config.avatar
    const hasAvatar = typeof avatar === 'string' && avatar.trim().length > 0
    if (!hasAvatar) {
      throw new Error('Circles avatar address not set. Call circles.setAvatarAddress(0x...) first.')
    }
    return normalizeEvmAddress(avatar)
  }

  private resetCachedClients(): void {
    this.sdkPromise = null
    this.bindingsPromise = null
    this.safeSignerPromise = null
  }

  private async getEthereumOrThrow(): Promise<WalletProvider> {
    const providerObj = await this.call('blockchain', 'getProviderObject')
    if (!providerObj.provider) {
      throw new Error('No provider found')
    }
    return providerObj.provider
  }

  private async getEthersSigner(ethereum: WalletProvider): Promise<ethers.Signer> {
    const provider = new ethers.BrowserProvider(ethereum as any)
    return await provider.getSigner()
  }

  private async getCirclesSdk(): Promise<Sdk> {
    const existing = this.sdkPromise
    if (existing) {
      return existing
    }

    const sdkPromise = (async () => {
      const ethereum = await this.getEthereumOrThrow()
      const signer = await this.getEthersSigner(ethereum)
      return new Sdk(signer as any, this.config.chainConfig)
    })()

    this.sdkPromise = sdkPromise
    return sdkPromise
  }

  private async getBindings(): Promise<ProfilesBindings> {
    const existing = this.bindingsPromise
    if (existing) {
      return existing
    }

    const bindingsPromise = (async () => {
      const circlesSdk = await this.getCirclesSdk()
      const pinApiBase = this.config.pinApiBase
      const { bindings } = createCirclesSdkProfilesBindings({ circlesSdk, pinApiBase })
      return bindings
    })()

    this.bindingsPromise = bindingsPromise
    return bindingsPromise
  }

  private async getSafeSigner(): Promise<AvatarSigner> {
    const existing = this.safeSignerPromise
    if (existing) {
      return existing
    }

    const signerPromise = (async () => {
      const avatar = this.ensureAvatarConfigured()
      const ethereum = await this.getEthereumOrThrow()

      const safeSigner = await this.signers.createSafeSignerForAvatar({
        avatar,
        ethereum,
        chainId: BigInt(this.config.chainId),
        enforceChainId: this.config.enforceChainId
      })

      const signerAvatar = normalizeEvmAddress(safeSigner.avatar)
      const expectedAvatar = normalizeEvmAddress(avatar)
      const avatarMatches = signerAvatar === expectedAvatar
      if (!avatarMatches) {
        throw new Error(`Signer avatar mismatch. Expected ${expectedAvatar}, got ${signerAvatar}`)
      }

      return safeSigner
    })()

    this.safeSignerPromise = signerPromise
    return signerPromise
  }

  private loadConfig(): CirclesPluginConfig {
    try {
      const ls = (globalThis as any)?.localStorage as Storage | undefined
      const hasStorage = !!ls && typeof ls.getItem === 'function'
      if (!hasStorage) {
        return { ...DEFAULT_CONFIG, chainConfig: { ...DEFAULT_CONFIG.chainConfig } }
      }

      const raw = ls.getItem(STORAGE_KEY)
      const hasRaw = typeof raw === 'string' && raw.trim().length > 0
      if (!hasRaw) {
        return { ...DEFAULT_CONFIG, chainConfig: { ...DEFAULT_CONFIG.chainConfig } }
      }

      const parsed = JSON.parse(raw) as unknown
      if (!isRecord(parsed)) {
        return { ...DEFAULT_CONFIG, chainConfig: { ...DEFAULT_CONFIG.chainConfig } }
      }

      const next: CirclesPluginConfig = { ...DEFAULT_CONFIG, chainConfig: { ...DEFAULT_CONFIG.chainConfig } }

      const chainId = parsed.chainId
      if (typeof chainId === 'number' && Number.isFinite(chainId) && chainId > 0 && Number.isInteger(chainId)) {
        next.chainId = chainId
      }

      const pinApiBase = parsed.pinApiBase
      if (typeof pinApiBase === 'string') {
        next.pinApiBase = sanitizePinApiBase(pinApiBase)
      }

      const avatar = parsed.avatar
      if (typeof avatar === 'string' && avatar.trim().length > 0) {
        next.avatar = normalizeEvmAddress(avatar)
      }

      const operatorNamespace = parsed.operatorNamespace
      if (typeof operatorNamespace === 'string' && operatorNamespace.trim().length > 0) {
        next.operatorNamespace = operatorNamespace.trim()
      }

      const enforceChainId = parsed.enforceChainId
      if (typeof enforceChainId === 'boolean') {
        next.enforceChainId = enforceChainId
      }

      const listDefaultLimit = parsed.listDefaultLimit
      if (typeof listDefaultLimit === 'number' && Number.isFinite(listDefaultLimit) && listDefaultLimit > 0 && Number.isInteger(listDefaultLimit)) {
        next.listDefaultLimit = listDefaultLimit
      }

      const chainConfig = parsed.chainConfig
      if (isRecord(chainConfig)) {
        next.chainConfig = sanitizeChainConfig(chainConfig as unknown as CirclesConfig)
      }

      return next
    } catch {
      return { ...DEFAULT_CONFIG, chainConfig: { ...DEFAULT_CONFIG.chainConfig } }
    }
  }

  private persistConfig(cfg: CirclesPluginConfig): void {
    const ls = (globalThis as any)?.localStorage as Storage | undefined
    const hasStorage = !!ls && typeof ls.setItem === 'function'
    if (!hasStorage) {
      return
    }

    const payload = {
      chainId: cfg.chainId,
      chainConfig: cfg.chainConfig,
      pinApiBase: cfg.pinApiBase,
      avatar: cfg.avatar,
      operatorNamespace: cfg.operatorNamespace,
      enforceChainId: cfg.enforceChainId,
      listDefaultLimit: cfg.listDefaultLimit
    }

    ls.setItem(STORAGE_KEY, JSON.stringify(payload))
  }

  private async loadLinksNewestFirst(bindings: ProfilesBindings, indexCid: Cid): Promise<CustomDataLink[]> {
    const { head, headCid } = await loadIndex(bindings, indexCid)

    const links: CustomDataLink[] = []
    const seenChunkCids = new Set<string>()

    let currentChunk: any = head
    let currentChunkCid: string | null = headCid

    const hasHeadCid = typeof currentChunkCid === 'string' && currentChunkCid.length > 0
    if (hasHeadCid) {
      seenChunkCids.add(currentChunkCid as string)
    }

    const t = true;
    while (t) {
      const chunkLinks = Array.isArray(currentChunk?.links) ? (currentChunk.links as CustomDataLink[]) : []
      for (let i = chunkLinks.length - 1; i >= 0; i--) {
        const l = chunkLinks[i]
        const hasName = typeof l?.name === 'string' && l.name.length > 0
        const hasCid = typeof l?.cid === 'string' && l.cid.length > 0
        if (hasName && hasCid) {
          links.push(l)
        }
      }

      const prev = currentChunk?.prev
      const hasPrev = typeof prev === 'string' && prev.length > 0
      if (!hasPrev) {
        break
      }

      const prevCid = prev as string
      const alreadySeen = seenChunkCids.has(prevCid)
      if (alreadySeen) {
        break
      }

      seenChunkCids.add(prevCid)
      currentChunkCid = prevCid
      currentChunk = await bindings.getJsonLd(prevCid)
    }

    return links
  }
}
