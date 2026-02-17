import { UserCredits, CreditTransaction, UsageRecord } from '../types/creditTypes';

export class CreditApiClient {
  private baseUrl: string;
  private getAuthToken: () => string | null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.getAuthToken = () =>
      typeof window !== 'undefined'
        ? window.localStorage?.getItem('remix_access_token')
        : null;
  }

  async getBalance(): Promise<UserCredits> {
    const response = await this.request('GET', '/balance');
    // Backend returns { userId, balance, free_credits, paid_credits }
    // Convert to our UserCredits format
    return {
      userId: response.userId,
      balance: response.balance,
      totalEarned: 0, // Backend doesn't provide this
      totalSpent: 0, // Backend doesn't provide this
      lastUpdated: new Date().toISOString()
    };
  }

  async deductCredits(
    amount: number,
    reason: string,
    metadata: any
  ): Promise<CreditTransaction> {
    const response = await this.request('POST', '/use', {
      amount,
      reason,
      metadata
    });

    // Backend returns { success, balance, free_credits, paid_credits }
    // Convert to our CreditTransaction format
    return {
      type: 'deduct',
      amount,
      userId: '', // Backend doesn't return this, will be set by caller
      reason,
      timestamp: new Date().toISOString()
    };
  }

  async getUsageHistory(limit?: number): Promise<UsageRecord[]> {
    const query = limit ? `?limit=${limit}` : '';
    const response = await this.request('GET', `/transactions${query}`);

    // Backend returns { transactions: [...] }
    // Each transaction has: id, group_id, user_id, amount, type, reason, metadata, created_at
    return response.transactions.map((tx: any) => ({
      id: String(tx.id),
      timestamp: tx.created_at,
      userId: String(tx.user_id),
      feature: this.parseFeatureFromMetadata(tx.metadata),
      creditsConsumed: Math.abs(tx.amount),
      creditsRefunded: tx.type === 'credit' ? tx.amount : undefined,
      balanceBefore: 0, // Backend doesn't provide this
      balanceAfter: 0, // Backend doesn't provide this
      validationResult: {
        isValid: true,
        metrics: { hasContent: true, hasErrors: false }
      },
      metadata: {
        endpoint: this.parseEndpointFromMetadata(tx.metadata),
        executionTime: 0,
        success: true
      }
    }));
  }

  private parseFeatureFromMetadata(metadata: string | null): string {
    if (!metadata) return 'unknown';
    try {
      const parsed = JSON.parse(metadata);
      return parsed.feature || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private parseEndpointFromMetadata(metadata: string | null): string {
    if (!metadata) return 'unknown';
    try {
      const parsed = JSON.parse(metadata);
      return parsed.endpoint || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  private async request(
    method: string,
    endpoint: string,
    body?: any
  ): Promise<any> {
    const token = this.getAuthToken();
    if (!token) {
      throw new Error('No authentication token available');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include', // Include cookies for CSRF
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: response.statusText };
      }

      // Handle insufficient credits error
      if (response.status === 402 && errorData.code === 'INSUFFICIENT_CREDITS') {
        throw new Error('Insufficient credits');
      }

      throw new Error(errorData.error || `API request failed: ${response.statusText}`);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return;
    }

    return response.json();
  }
}
