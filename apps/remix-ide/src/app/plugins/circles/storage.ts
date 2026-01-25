import { normalizeEvmAddress } from '@circles-market/core'
import { aaLocalStorageKey } from '@remix-project/remix-lib'
import { CirclesConfig } from '@circles-sdk/sdk'
import { CirclesPluginConfig } from './types'
import { STORAGE_KEY, DEFAULT_CONFIG } from './constants'
import { isRecord, sanitizePinApiBase, sanitizeChainConfig } from './utils'

export function loadConfig(): CirclesPluginConfig {
  console.log(`circles: loadConfig()`)
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

export function persistConfig(cfg: CirclesPluginConfig): void {
  console.log(`circles: persistConfig(cfg: ${cfg})`)
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
    listDefaultLimit: cfg.listDefaultLimit,
  }

  ls.setItem(STORAGE_KEY, JSON.stringify(payload))
}

export function getSmartAccountsFromStorage(): Record<number, any> {
  const ls = (globalThis as any)?.localStorage as Storage | undefined
  if (!ls || typeof ls.getItem !== 'function') return {}

  const existingRaw = ls.getItem(aaLocalStorageKey)
  if (existingRaw) {
    try {
      const parsed = JSON.parse(existingRaw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed
      }
    } catch (err) {
      console.error(`circles: Failed to parse existing data from localStorage for key ${aaLocalStorageKey}:`, err)
    }
  }
  return {}
}

export function saveSmartAccountsToStorage(smartAccountsObj: Record<number, any>): void {
  const ls = (globalThis as any)?.localStorage as Storage | undefined
  if (!ls || typeof ls.setItem !== 'function') return
  ls.setItem(aaLocalStorageKey, JSON.stringify(smartAccountsObj))
}
