import { CreditConfig, AIFeature } from '../types/creditTypes';

export const defaultCreditConfig: CreditConfig = {
  version: '1.0.0',
  enabled: true,
  tiers: {
    tier1: {
      name: 'High-frequency, Low-cost',
      features: {
        [AIFeature.CODE_COMPLETION]: {
          creditsPerUse: 1,
          usesPerCredit: 10 // 10 completions = 1 credit
        },
        [AIFeature.CODE_INSERTION]: {
          creditsPerUse: 1,
          usesPerCredit: 10
        },
        [AIFeature.ERROR_EXPLANATION]: {
          creditsPerUse: 2
        },
        [AIFeature.CODE_EXPLANATION]: {
          creditsPerUse: 0
        },
        [AIFeature.GENERAL_CHAT]: {
          creditsPerUse: 0
        },
        [AIFeature.VULNERABILITY_CHECK]: {
          creditsPerUse: 0
        },
        [AIFeature.WORKSPACE_GENERATION]: {
          creditsPerUse: 0
        },
        [AIFeature.DAPP_GENERATION]: {
          creditsPerUse: 0
        }
      }
    },
    tier2: {
      name: 'Medium',
      features: {
        [AIFeature.CODE_COMPLETION]: {
          creditsPerUse: 0
        },
        [AIFeature.CODE_INSERTION]: {
          creditsPerUse: 0
        },
        [AIFeature.ERROR_EXPLANATION]: {
          creditsPerUse: 0
        },
        [AIFeature.CODE_EXPLANATION]: {
          creditsPerUse: 5
        },
        [AIFeature.GENERAL_CHAT]: {
          creditsPerUse: 5,
          dynamicPricing: {
            type: 'token-based',
            baseCredits: 5,
            multiplier: 0.001 // +0.001 per token
          }
        },
        [AIFeature.VULNERABILITY_CHECK]: {
          creditsPerUse: 15
        },
        [AIFeature.WORKSPACE_GENERATION]: {
          creditsPerUse: 0
        },
        [AIFeature.DAPP_GENERATION]: {
          creditsPerUse: 0
        }
      }
    },
    tier3: {
      name: 'Premium',
      features: {
        [AIFeature.CODE_COMPLETION]: {
          creditsPerUse: 0
        },
        [AIFeature.CODE_INSERTION]: {
          creditsPerUse: 0
        },
        [AIFeature.ERROR_EXPLANATION]: {
          creditsPerUse: 0
        },
        [AIFeature.CODE_EXPLANATION]: {
          creditsPerUse: 0
        },
        [AIFeature.GENERAL_CHAT]: {
          creditsPerUse: 0
        },
        [AIFeature.VULNERABILITY_CHECK]: {
          creditsPerUse: 0
        },
        [AIFeature.WORKSPACE_GENERATION]: {
          creditsPerUse: 100,
          dynamicPricing: {
            type: 'complexity-based',
            baseCredits: 100,
            multiplier: 10 // +10 per file
          }
        },
        [AIFeature.DAPP_GENERATION]: {
          creditsPerUse: 150,
          dynamicPricing: {
            type: 'complexity-based',
            baseCredits: 150,
            multiplier: 15
          }
        }
      }
    }
  },
  rateLimiting: {
    enabled: true,
    maxRequestsPerMinute: 30,
    maxCreditsPerHour: 1000
  },
  validation: {
    enabled: true,
    strictMode: false
  }
};
