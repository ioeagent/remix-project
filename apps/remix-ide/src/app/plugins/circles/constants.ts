import { type CirclesConfig } from '@circles-sdk/sdk'
import { CirclesPluginConfig } from './types'

export const STORAGE_KEY = 'remix:circles-plugin:config'

export const DEFAULT_CHAIN_CONFIG: CirclesConfig = {
  circlesRpcUrl: 'https://rpc.aboutcircles.com',
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

export const DEFAULT_CONFIG: CirclesPluginConfig = {
  chainId: 100,
  chainConfig: DEFAULT_CHAIN_CONFIG,
  pinApiBase: 'https://market-api.aboutcircles.com/',
  avatar: null,
  operatorNamespace: '0xde374ece6fa50e781e81aac78e811b33d16912c7',
  enforceChainId: true,
  listDefaultLimit: 50,
}
