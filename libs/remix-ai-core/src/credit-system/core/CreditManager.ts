import { CreditApiClient } from '../api/CreditApiClient';
import { CreditCalculator } from '../utils/CreditCalculator';
import { UserCredits, AIFeature, ValidationResult, UsageMetadata } from '../types/creditTypes';

export class CreditManager {
  private apiClient: CreditApiClient;
  private calculator: CreditCalculator;
  private usageCounter: Map<string, number>; // For weighted counting

  constructor(
    apiClient: CreditApiClient,
    calculator: CreditCalculator
  ) {
    this.apiClient = apiClient;
    this.calculator = calculator;
    this.usageCounter = new Map();
  }

  async getBalance(): Promise<UserCredits> {
    // Always fetch from API
    try {
      return await this.apiClient.getBalance();
    } catch (error) {
      console.error('[CreditManager] Failed to fetch balance:', error);
      // Return a default balance if API fails
      return {
        userId: 'unknown',
        balance: 0,
        totalEarned: 0,
        totalSpent: 0,
        lastUpdated: new Date().toISOString()
      };
    }
  }

  async checkBalance(feature: AIFeature): Promise<boolean> {
    const balance = await this.getBalance();

    // Check weighted counting
    const shouldCharge = this.shouldChargeThisTime(feature);
    if (!shouldCharge) {
      return true; // Don't need credits this time
    }

    const estimatedCost = this.calculator.calculate(
      feature,
      { isValid: true, score: 1.0, metrics: { hasContent: true, hasErrors: false } }
    );

    return balance.balance >= estimatedCost;
  }

  async deductCredits(
    feature: AIFeature,
    validationResult: ValidationResult,
    metadata: UsageMetadata
  ): Promise<{ charged: number; newBalance: number }> {

    // Check weighted counting
    const shouldCharge = this.shouldChargeThisTime(feature);
    if (!shouldCharge) {
      const balance = await this.getBalance();
      return { charged: 0, newBalance: balance.balance };
    }

    // Calculate actual cost
    const cost = this.calculator.calculate(
      feature,
      validationResult,
      metadata
    );

    if (cost === 0) {
      const balance = await this.getBalance();
      return { charged: 0, newBalance: balance.balance };
    }

    try {
      // Deduct from backend
      const reason = `${feature}_usage`;
      await this.apiClient.deductCredits(
        cost,
        reason,
        { feature, validationResult, ...metadata }
      );

      // Fetch new balance
      const newBalance = await this.getBalance();

      return { charged: cost, newBalance: newBalance.balance };
    } catch (error) {
      console.error('[CreditManager] Failed to deduct credits:', error);
      // Return without deduction if API fails
      const balance = await this.getBalance();
      return { charged: 0, newBalance: balance.balance };
    }
  }

  private shouldChargeThisTime(feature: AIFeature): boolean {
    const key = feature;
    const count = (this.usageCounter.get(key) || 0) + 1;
    this.usageCounter.set(key, count);

    return this.calculator.shouldChargeForWeightedFeature(
      feature,
      count
    );
  }
}
