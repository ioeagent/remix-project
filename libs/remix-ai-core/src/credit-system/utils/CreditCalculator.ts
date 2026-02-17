import { CreditConfig, AIFeature, FeaturePricing, DynamicPricing, ValidationResult } from '../types/creditTypes';

export class CreditCalculator {
  private config: CreditConfig;

  constructor(config: CreditConfig) {
    this.config = config;
  }

  updateConfig(config: CreditConfig): void {
    this.config = config;
  }

  calculate(
    feature: AIFeature,
    validationResult: ValidationResult,
    metadata?: any
  ): number {
    const pricing = this.getPricing(feature);
    if (!pricing) {
      console.warn(`[CreditCalculator] No pricing for feature: ${feature}`);
      return 0;
    }

    let cost = pricing.creditsPerUse;

    // Apply dynamic pricing if configured
    if (pricing.dynamicPricing) {
      cost = this.applyDynamicPricing(
        pricing.dynamicPricing,
        metadata
      );
    }

    // Apply quality score (partial credit)
    if (validationResult.score !== undefined) {
      cost = cost * validationResult.score;
    }

    return Math.max(0, cost);
  }

  shouldChargeForWeightedFeature(
    feature: AIFeature,
    usageCount: number
  ): boolean {
    const pricing = this.getPricing(feature);
    if (!pricing?.usesPerCredit) {
      return true; // Charge every time
    }

    // Charge every N uses
    return usageCount % pricing.usesPerCredit === 0;
  }

  private applyDynamicPricing(
    dynamic: DynamicPricing,
    metadata: any
  ): number {
    let cost = dynamic.baseCredits;

    switch (dynamic.type) {
      case 'token-based':
        if (metadata?.tokensUsed && dynamic.multiplier) {
          cost += metadata.tokensUsed * dynamic.multiplier;
        }
        break;

      case 'complexity-based':
        if (metadata?.complexity && dynamic.multiplier) {
          cost += metadata.complexity * dynamic.multiplier;
        }
        break;

      case 'time-based':
        if (metadata?.executionTime && dynamic.multiplier) {
          const seconds = metadata.executionTime / 1000;
          cost += seconds * dynamic.multiplier;
        }
        break;
    }

    return cost;
  }

  private getPricing(feature: AIFeature): FeaturePricing | null {
    for (const tier of Object.values(this.config.tiers)) {
      if (tier.features[feature]) {
        return tier.features[feature];
      }
    }
    return null;
  }
}
