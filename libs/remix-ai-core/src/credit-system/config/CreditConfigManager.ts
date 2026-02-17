import { CreditConfig } from '../types/creditTypes';
import { defaultCreditConfig } from './defaultCreditConfig';

export class CreditConfigManager {
  private config: CreditConfig;
  private listeners: Array<(config: CreditConfig) => void>;

  constructor() {
    this.config = defaultCreditConfig;
    this.listeners = [];
  }

  async loadConfig(): Promise<CreditConfig> {
    // Simply return the default config
    console.log('[CreditSystem] Using default credit config');
    return this.config;
  }

  getConfig(): CreditConfig {
    return this.config;
  }

  async updateConfig(
    updates: Partial<CreditConfig>
  ): Promise<CreditConfig> {
    this.config = this.mergeConfig(this.config, updates);
    this.notifyListeners();
    return this.config;
  }

  onChange(listener: (config: CreditConfig) => void): void {
    this.listeners.push(listener);
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.config);
      } catch (error) {
        console.error('[CreditSystem] Listener error:', error);
      }
    }
  }

  private mergeConfig(
    base: CreditConfig,
    updates: any
  ): CreditConfig {
    return {
      ...base,
      ...updates,
      tiers: {
        ...base.tiers,
        ...updates.tiers
      },
      rateLimiting: {
        ...base.rateLimiting,
        ...(updates.rateLimiting || {})
      },
      validation: {
        ...base.validation,
        ...(updates.validation || {})
      }
    };
  }
}
