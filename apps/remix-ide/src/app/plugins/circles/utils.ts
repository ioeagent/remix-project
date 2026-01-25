import { normalizeEvmAddress } from '@circles-market/core'
import { type CirclesConfig } from '@circles-sdk/sdk'

export function isRecord(v: unknown): v is Record<string, unknown> {
  const isObject = typeof v === 'object'
  const isNotNull = v !== null
  const isArray = Array.isArray(v)
  return isObject && isNotNull && !isArray
}

export function toErrorMessage(err: unknown): string {
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

export function sanitizePinApiBase(v: string): string {
  const trimmed = v.trim()
  const isHttp = /^https?:\/\//i.test(trimmed)
  if (!isHttp) {
    throw new Error('pinApiBase must start with http:// or https://')
  }
  return trimmed.replace(/\/+$/, '') + '/'
}

export function sanitizeChainConfig(v: CirclesConfig): CirclesConfig {
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
