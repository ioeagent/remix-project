import { buildDappContextPrompt } from '../helpers/dapp-system-prompt'

const LOG_PREFIX = '[DappAgent]'

export class DappAgent {
  plugin: any
  static instance: DappAgent

  /**
   * Keywords that indicate a DApp-related request.
   * Kept broad to catch natural language variations.
   * Ordered from most specific to most general.
   */
  private static readonly DAPP_KEYWORDS = [
    // Direct DApp commands
    'dapp_create', 'dapp_update', 'dapp_list', 'dapp_open', 'dapp_get_status', 'dapp_navigate',
    'quickdapp', 'quick dapp', 'quick-dapp',

    // Creation intent
    'create a dapp', 'create dapp', 'make a dapp', 'build a dapp', 'generate a dapp',
    'create a frontend', 'generate frontend', 'build frontend',
    'web interface for my contract', 'ui for my contract',
    'dapp for my contract', 'frontend for my contract',

    // Modification intent
    'modify the dapp', 'update the dapp', 'change the dapp', 'edit the dapp',
    'modify my dapp', 'update my dapp', 'change my dapp',

    // Navigation / status
    'show my dapp', 'open my dapp', 'list dapps', 'list my dapps',
    'show the dapp', 'open the dapp',

    // Deployment related
    'deploy to ipfs', 'publish to ipfs',
    'ens registration', 'ens domain', 'register ens',

    // Platform specific
    'base mini app', 'coinbase sdk', 'onchainkit',

    // Design source
    'figma design', 'figma url', 'figma token',

    // General DApp keyword (least specific — last)
    'dapp',
  ]

  private constructor(props: any) {
    this.plugin = props
    console.log(`${LOG_PREFIX} Initialized`)
  }

  public static getInstance(props: any): DappAgent {
    if (DappAgent.instance) return DappAgent.instance
    DappAgent.instance = new DappAgent(props)
    return DappAgent.instance
  }

  /**
   * Determine whether a user prompt is DApp-related.
   * Uses simple keyword matching (same approach as CodeExplainAgent.chatCommand).
   */
  isDappRelated(prompt: string): boolean {
    const lower = prompt.toLowerCase()
    const matched = DappAgent.DAPP_KEYWORDS.some(kw => lower.includes(kw))
    console.log(`${LOG_PREFIX} isDappRelated=${matched} prompt="${prompt.substring(0, 80)}${prompt.length > 80 ? '...' : ''}"`)
    return matched
  }

  /**
   * Enrich the prompt with DApp context if the request is DApp-related.
   * Returns the original prompt unchanged if not DApp-related.
   */
  async enrichPrompt(prompt: string): Promise<string> {
    if (!this.isDappRelated(prompt)) {
      console.log(`${LOG_PREFIX} Skipping — not DApp-related`)
      return prompt
    }

    console.log(`${LOG_PREFIX} DApp-related request detected, enriching prompt...`)

    // Try to get active DApp info for context-specific guidance
    let activeDapp: any = null
    try {
      const dapps = await this.plugin.call('quick-dapp-v2', 'listDapps')
      if (dapps?.length > 0) {
        // Use the most recently updated DApp
        activeDapp = dapps.sort((a: any, b: any) => {
          const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime()
          const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime()
          return bTime - aTime
        })[0]
        console.log(`${LOG_PREFIX} Active DApp context: slug=${activeDapp.slug}, name=${activeDapp.name}`)
      } else {
        console.log(`${LOG_PREFIX} No existing DApps found`)
      }
    } catch (e) {
      // QuickDapp plugin not active or not available — proceed without active DApp context
      console.log(`${LOG_PREFIX} Could not fetch DApp list (plugin may not be active): ${e.message}`)
    }

    const dappContext = buildDappContextPrompt(activeDapp)
    const enrichedPrompt = `${dappContext}\n\n${prompt}`

    console.log(`${LOG_PREFIX} Prompt enriched: +${dappContext.length} chars of DApp context`)
    return enrichedPrompt
  }
}
