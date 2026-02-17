export enum AIFeature {
  CODE_COMPLETION = 'code_completion',
  CODE_INSERTION = 'code_insertion',
  ERROR_EXPLANATION = 'error_explaining',
  CODE_EXPLANATION = 'code_explaining',
  GENERAL_CHAT = 'answer',
  VULNERABILITY_CHECK = 'vulnerability_check',
  WORKSPACE_GENERATION = 'generateWorkspace',
  DAPP_GENERATION = 'generate'
}

export interface FeaturePricing {
  creditsPerUse: number;
  usesPerCredit?: number;         // For weighted counting
  dynamicPricing?: DynamicPricing;
}

export interface DynamicPricing {
  type: 'token-based' | 'complexity-based' | 'time-based';
  baseCredits: number;
  multiplier?: number;
}

export interface CreditTier {
  name: string;
  features: Record<AIFeature, FeaturePricing>;
}

export interface CreditConfig {
  version: string;
  enabled: boolean;
  tiers: {
    tier1: CreditTier;  // High-frequency, low-cost
    tier2: CreditTier;  // Medium
    tier3: CreditTier;  // Premium
  };
  rateLimiting: {
    enabled: boolean;
    maxRequestsPerMinute: number;
    maxCreditsPerHour: number;
  };
  validation: {
    enabled: boolean;
    strictMode: boolean;
  };
}

export interface UserCredits {
  userId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  lastUpdated: string;
}

export interface UsageMetadata {
  endpoint: string;
  provider?: string;
  model?: string;
  tokensUsed?: number;
  executionTime: number;
  success: boolean;
  errorMessage?: string;
  promptLength?: number;
  responseLength?: number;
}

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  score?: number;  // 0-1 quality score for partial credit
  metrics: ValidationMetrics;
}

export interface ValidationMetrics {
  hasContent: boolean;
  hasErrors: boolean;
  compilationSucceeded?: boolean;
  contentLength?: number;
  tokenCount?: number;
  semanticQuality?: number;
  specificChecks?: Record<string, boolean>;
}

export interface UsageRecord {
  id: string;
  timestamp: string;
  userId: string;
  feature: AIFeature;
  creditsConsumed: number;
  creditsRefunded?: number;
  balanceBefore: number;
  balanceAfter: number;
  validationResult: ValidationResult;
  metadata: UsageMetadata;
}

export interface CreditTransaction {
  type: 'deduct' | 'add' | 'refund';
  amount: number;
  userId: string;
  reason: string;
  timestamp: string;
  relatedUsageId?: string;
}
