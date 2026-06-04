// Maps Solidity ABI types to The Graph's GraphQL scalar types
export function solidityTypeToGraphQL(solidityType: string): string {
  const base = solidityType.replace(/\[.*\]$/, '') // strip array notation

  if (base === 'address') return 'Bytes'
  if (base === 'bool') return 'Boolean'
  if (base === 'string') return 'String'
  if (base.startsWith('bytes')) return 'Bytes'
  if (base.startsWith('uint') || base.startsWith('int')) return 'BigInt'
  if (base === 'tuple') return 'Bytes' // structs encoded as bytes for simplicity

  return 'Bytes' // safe fallback
}

// Maps Solidity ABI types to AssemblyScript access on event.params
export function solidityTypeToAS(solidityType: string): string {
  const base = solidityType.replace(/\[.*\]$/, '')

  if (base === 'address') return '' // Address is directly usable
  if (base === 'bool') return ''
  if (base === 'string') return ''
  if (base.startsWith('bytes')) return ''
  if (base.startsWith('uint') || base.startsWith('int')) return '' // BigInt directly

  return ''
}

export interface AbiEvent {
  name: string
  type: 'event'
  inputs: Array<{
    name: string
    type: string
    indexed?: boolean
  }>
}

export function extractEvents(abi: any[]): AbiEvent[] {
  return abi.filter((item: any) => item.type === 'event') as AbiEvent[]
}

// Generate a safe entity field name from an ABI input name
export function safeFieldName(name: string, index: number): string {
  if (!name || name.trim() === '') return `param${index}`
  // Remove leading underscores common in Solidity conventions
  return name.replace(/^_+/, '')
}
