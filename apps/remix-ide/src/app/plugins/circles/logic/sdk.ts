import { ethers } from 'ethers'
import { Sdk } from '@circles-sdk/sdk'
import { SignersClientImpl, type WalletProvider, type AvatarSigner } from '@circles-market/signers'
import { normalizeEvmAddress } from '@circles-market/core'
import { createCirclesSdkProfilesBindings, type ProfilesBindings } from '@circles-profile/core'
import { CirclesPluginConfig } from '../types'

const signers = new SignersClientImpl()

export async function getEthereumOrThrow(call: (name: string, method: string, ...args: any[]) => Promise<any>): Promise<WalletProvider> {
  const providerObj = await call('blockchain', 'getProviderObject')
  if (!providerObj.provider) {
    throw new Error('No provider found')
  }
  return providerObj.provider
}

export async function getEthersSigner(ethereum: WalletProvider): Promise<ethers.Signer> {
  const provider = new ethers.BrowserProvider(ethereum as any)
  return await provider.getSigner()
}

export async function getCirclesSdk(config: CirclesPluginConfig, call: (name: string, method: string, ...args: any[]) => Promise<any>): Promise<Sdk> {
  const ethereum = await getEthereumOrThrow(call)
  const signer = await getEthersSigner(ethereum)
  return new Sdk(signer as any, config.chainConfig)
}

export async function getBindings(config: CirclesPluginConfig, call: (name: string, method: string, ...args: any[]) => Promise<any>): Promise<ProfilesBindings> {
  const circlesSdk = await getCirclesSdk(config, call)
  const pinApiBase = config.pinApiBase
  const { bindings } = createCirclesSdkProfilesBindings({ circlesSdk, pinApiBase })
  return bindings
}

export async function getSafeSigner(config: CirclesPluginConfig, avatar: string, call: (name: string, method: string, ...args: any[]) => Promise<any>): Promise<AvatarSigner> {
  const ethereum = await getEthereumOrThrow(call)

  const safeSigner = await signers.createSafeSignerForAvatar({
    avatar,
    ethereum,
    chainId: BigInt(config.chainId),
    enforceChainId: config.enforceChainId,
  })

  const signerAvatar = normalizeEvmAddress(safeSigner.avatar)
  const expectedAvatar = normalizeEvmAddress(avatar)
  const avatarMatches = signerAvatar === expectedAvatar
  if (!avatarMatches) {
    throw new Error(`Signer avatar mismatch. Expected ${expectedAvatar}, got ${signerAvatar}`)
  }

  return safeSigner
}
