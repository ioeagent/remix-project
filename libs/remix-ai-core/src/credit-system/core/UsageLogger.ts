import { CreditApiClient } from '../api/CreditApiClient';
import { UsageRecord } from '../types/creditTypes';

export class UsageLogger {
  private apiClient: CreditApiClient;

  constructor(apiClient: CreditApiClient) {
    this.apiClient = apiClient;
  }

  async getHistory(limit?: number): Promise<UsageRecord[]> {
    // Always fetch from API
    try {
      return await this.apiClient.getUsageHistory(limit);
    } catch (error) {
      console.error('[UsageLogger] Failed to fetch history from API:', error);
      return [];
    }
  }
}
