import { CreditManager } from './CreditManager';
import { GroundTruthValidator } from '../validation/GroundTruthValidator';
import { UsageLogger } from './UsageLogger';
import { CreditConfigManager } from '../config/CreditConfigManager';
import { RateLimiter } from '../utils/RateLimiter';
import { AIFeature, UsageRecord } from '../types/creditTypes';

export class CreditMiddleware {
  private creditManager: CreditManager;
  private validator: GroundTruthValidator;
  private usageLogger: UsageLogger;
  private configManager: CreditConfigManager;
  private rateLimiter: RateLimiter;

  constructor(
    creditManager: CreditManager,
    validator: GroundTruthValidator,
    usageLogger: UsageLogger,
    configManager: CreditConfigManager,
    rateLimiter: RateLimiter
  ) {
    this.creditManager = creditManager;
    this.validator = validator;
    this.usageLogger = usageLogger;
    this.configManager = configManager;
    this.rateLimiter = rateLimiter;
  }

  /**
   * Wrap an inferencer with credit tracking
   */
  wrapInferencer(inferencer: any): any {
    return new Proxy(inferencer, {
      get: (target, prop: string) => {
        const originalMethod = target[prop];

        if (typeof originalMethod !== 'function') {
          return originalMethod;
        }

        // Map method name to feature
        const feature = this.mapMethodToFeature(prop);
        if (!feature) {
          return originalMethod.bind(target);
        }

        // Return wrapped method
        return async (...args: any[]) => {
          return this.executeWithTracking(
            feature,
            () => originalMethod.apply(target, args),
            args
          );
        };
      }
    });
  }

  private async executeWithTracking(
    feature: AIFeature,
    execute: () => Promise<any>,
    args: any[]
  ): Promise<any> {
    const config = this.configManager.getConfig();

    // Skip if credit system disabled
    if (!config.enabled) {
      return execute();
    }

    const startTime = Date.now();
    const userId = this.getUserId();
    const usageId = this.generateUsageId();

    // Skip if not authenticated
    if (!userId) {
      console.warn('[CreditSystem] No user ID, skipping tracking');
      return execute();
    }

    // PRE-EXECUTION CHECKS
    try {
      await this.preExecutionCheck(userId, feature);
    } catch (error: any) {
      throw new Error(`Credit check failed: ${error.message}`);
    }

    // EXECUTE
    let response: any;
    let error: Error | undefined;
    let success = true;

    try {
      response = await execute();
    } catch (e: any) {
      error = e;
      success = false;
    }

    // POST-EXECUTION TRACKING
    const executionTime = Date.now() - startTime;

    if (success && response) {
      await this.postExecutionTracking(
        usageId,
        userId,
        feature,
        args,
        response,
        executionTime
      );
    }

    if (error) throw error;
    return response;
  }

  private async preExecutionCheck(
    userId: string,
    feature: AIFeature
  ): Promise<void> {
    const config = this.configManager.getConfig();

    // Check rate limiting (uses userId for local cache key)
    if (config.rateLimiting.enabled) {
      const allowed = await this.rateLimiter.checkLimit(
        userId,
        feature
      );
      if (!allowed) {
        throw new Error('Rate limit exceeded');
      }
    }

    // Check balance (backend gets userId from auth token)
    const hasBalance = await this.creditManager.checkBalance(feature);
    if (!hasBalance) {
      throw new Error('Insufficient credits');
    }
  }

  private async postExecutionTracking(
    usageId: string,
    userId: string,
    feature: AIFeature,
    args: any[],
    response: any,
    executionTime: number
  ): Promise<void> {
    const config = this.configManager.getConfig();

    // Validate ground truth
    const validationResult = config.validation.enabled
      ? await this.validator.validate(
          feature,
          args[0], // prompt
          response
        )
      : { isValid: true, score: 1.0, metrics: { hasContent: true, hasErrors: false } };

    if (!validationResult.isValid && config.validation.strictMode) {
      console.warn(
        `[CreditSystem] Validation failed for ${feature}:`,
        validationResult.reason
      );
      // Don't charge for invalid responses in strict mode
      return;
    }

    // Get current balance before deduction
    const currentBalance = await this.creditManager.getBalance();

    // Deduct credits (backend gets userId from auth token and logs transaction automatically)
    const { charged, newBalance } = await this.creditManager.deductCredits(
      feature,
      validationResult,
      {
        endpoint: this.getEndpoint(feature),
        executionTime,
        success: true,
        promptLength: args[0]?.length || 0,
        responseLength: typeof response === 'string'
          ? response.length
          : JSON.stringify(response).length
      }
    );

    // Record credit usage for rate limiting (uses userId for local cache key)
    if (charged > 0) {
      this.rateLimiter.recordCreditUsage(userId, charged);
    }

    // Note: Backend automatically logs the transaction in credit_transactions table
    // No need to call usageLogger.log() separately
  }

  private mapMethodToFeature(methodName: string): AIFeature | null {
    const mapping: Record<string, AIFeature> = {
      'code_completion': AIFeature.CODE_COMPLETION,
      'code_insertion': AIFeature.CODE_INSERTION,
      'error_explaining': AIFeature.ERROR_EXPLANATION,
      'code_explaining': AIFeature.CODE_EXPLANATION,
      'answer': AIFeature.GENERAL_CHAT,
      'vulnerability_check': AIFeature.VULNERABILITY_CHECK,
      'generateWorkspace': AIFeature.WORKSPACE_GENERATION,
      'generate': AIFeature.DAPP_GENERATION
    };

    return mapping[methodName] || null;
  }

  private getUserId(): string | null {
    if (typeof window === 'undefined') return null;

    const token = window.localStorage?.getItem('remix_access_token');
    if (!token) return null;

    // Extract user ID from JWT token
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.sub || payload.userId || payload.id;
    } catch {
      return null;
    }
  }

  private getEndpoint(feature: AIFeature): string {
    // Map features to their endpoints
    const endpointMap: Record<string, string> = {
      [AIFeature.CODE_COMPLETION]: 'completion',
      [AIFeature.CODE_INSERTION]: 'completion',
      [AIFeature.CODE_EXPLANATION]: 'solcoder',
      [AIFeature.GENERAL_CHAT]: 'solcoder',
      [AIFeature.VULNERABILITY_CHECK]: 'solcoder',
      [AIFeature.WORKSPACE_GENERATION]: 'solcoder',
      [AIFeature.DAPP_GENERATION]: 'solcoder',
      [AIFeature.ERROR_EXPLANATION]: 'solcoder'
    };

    return endpointMap[feature] || 'unknown';
  }

  private generateUsageId(): string {
    return `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
