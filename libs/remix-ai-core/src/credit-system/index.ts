import { CreditApiClient } from './api/CreditApiClient';
import { CreditConfigManager } from './config/CreditConfigManager';
import { CreditManager } from './core/CreditManager';
import { CreditMiddleware } from './core/CreditMiddleware';
import { UsageLogger } from './core/UsageLogger';
import { CreditCalculator } from './utils/CreditCalculator';
import { RateLimiter } from './utils/RateLimiter';
import { GroundTruthValidator } from './validation/GroundTruthValidator';

// Core
export { CreditManager } from './core/CreditManager';
export { CreditMiddleware } from './core/CreditMiddleware';
export { UsageLogger } from './core/UsageLogger';

// API
export { CreditApiClient } from './api/CreditApiClient';

// Validation
export { GroundTruthValidator } from './validation/GroundTruthValidator';
export { CompletionValidator } from './validation/validators/CompletionValidator';
export { GenerationValidator } from './validation/validators/GenerationValidator';
export { ExplanationValidator } from './validation/validators/ExplanationValidator';
export { SecurityValidator } from './validation/validators/SecurityValidator';

// Config
export { CreditConfigManager } from './config/CreditConfigManager';
export { defaultCreditConfig } from './config/defaultCreditConfig';

// Utils
export { CreditCalculator } from './utils/CreditCalculator';
export { RateLimiter } from './utils/RateLimiter';

// Types
export * from './types/creditTypes';
export * from './types/validationTypes';

/**
 * Initialize credit system
 */
export async function initializeCreditSystem(
  plugin: any,
  apiBaseUrl: string
): Promise<{
  creditManager: CreditManager;
  middleware: CreditMiddleware;
  configManager: CreditConfigManager;
  usageLogger: UsageLogger;
}> {
  // Load config
  const configManager = new CreditConfigManager();
  await configManager.loadConfig();

  // Initialize components
  const apiClient = new CreditApiClient(apiBaseUrl);
  const calculator = new CreditCalculator(configManager.getConfig());
  const rateLimiter = new RateLimiter(configManager.getConfig());

  const creditManager = new CreditManager(apiClient, calculator);
  const validator = new GroundTruthValidator(plugin);
  const usageLogger = new UsageLogger(apiClient);

  const middleware = new CreditMiddleware(
    creditManager,
    validator,
    usageLogger,
    configManager,
    rateLimiter
  );

  // Update components when config changes
  configManager.onChange((newConfig) => {
    calculator.updateConfig(newConfig);
    rateLimiter.updateConfig(newConfig);
  });

  console.log('[CreditSystem] Initialized successfully');

  return { creditManager, middleware, configManager, usageLogger };
}
