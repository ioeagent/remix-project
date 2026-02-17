import { CreditConfig, AIFeature } from '../types/creditTypes';

export class RateLimiter {
  private requestCounts: Map<string, number[]>;
  private creditUsage: Map<string, number[]>;
  private config: CreditConfig;

  constructor(config: CreditConfig) {
    this.config = config;
    this.requestCounts = new Map();
    this.creditUsage = new Map();
  }

  updateConfig(config: CreditConfig): void {
    this.config = config;
  }

  async checkLimit(
    userId: string,
    feature: AIFeature
  ): Promise<boolean> {
    const now = Date.now();

    // Check request rate
    const requestKey = `${userId}:requests`;
    const requests = this.getTimestamps(requestKey, now, 60 * 1000);

    if (requests.length >= this.config.rateLimiting.maxRequestsPerMinute) {
      return false;
    }

    // Record this request
    this.recordTimestamp(requestKey, now);

    // Check credit usage rate
    const creditKey = `${userId}:credits`;
    const creditTimestamps = this.getTimestamps(
      creditKey,
      now,
      60 * 60 * 1000
    );

    // Calculate total credits used in last hour
    // (This is approximate; actual tracking done by CreditManager)
    if (creditTimestamps.length >= this.config.rateLimiting.maxCreditsPerHour) {
      return false;
    }

    return true;
  }

  recordCreditUsage(userId: string, credits: number): void {
    if (credits === 0) return;

    const key = `${userId}:credits`;
    const now = Date.now();

    // Record N timestamps for N credits
    for (let i = 0; i < credits; i++) {
      this.recordTimestamp(key, now);
    }
  }

  private getTimestamps(
    key: string,
    now: number,
    windowMs: number
  ): number[] {
    const timestamps = this.requestCounts.get(key) || [];
    return timestamps.filter(ts => now - ts < windowMs);
  }

  private recordTimestamp(key: string, timestamp: number): void {
    const timestamps = this.requestCounts.get(key) || [];
    timestamps.push(timestamp);
    this.requestCounts.set(key, timestamps);

    // Clean old timestamps periodically
    if (timestamps.length % 100 === 0) {
      this.cleanup();
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour

    for (const [key, timestamps] of this.requestCounts.entries()) {
      const filtered = timestamps.filter(ts => now - ts < maxAge);
      if (filtered.length === 0) {
        this.requestCounts.delete(key);
      } else {
        this.requestCounts.set(key, filtered);
      }
    }
  }
}
