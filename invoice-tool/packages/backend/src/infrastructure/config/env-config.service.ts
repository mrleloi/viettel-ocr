import { Injectable } from '@nestjs/common';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { CONFIG_DEFAULTS, REQUIRED_CONFIG_KEYS } from '@invoice-tool/shared';

/**
 * Configuration service that reads from config.env file.
 * Located at the monorepo root (../../config.env relative to backend package).
 */
@Injectable()
export class EnvConfigService {
  private readonly config: Record<string, string>;

  constructor() {
    const configPath = path.resolve(__dirname, '..', '..', '..', 'config.env');

    if (fs.existsSync(configPath)) {
      const parsed = dotenv.parse(fs.readFileSync(configPath, 'utf8'));
      this.config = { ...CONFIG_DEFAULTS, ...parsed };
    } else {
      console.warn(`⚠️  config.env not found at ${configPath}. Using defaults.`);
      this.config = { ...CONFIG_DEFAULTS };
    }
  }

  /**
   * Validate that all required config keys are present.
   * @throws Error if any required key is missing
   */
  validate(): void {
    const missing = REQUIRED_CONFIG_KEYS.filter(
      (key) => !this.config[key] || this.config[key] === `your_${key.toLowerCase()}_here`,
    );
    if (missing.length > 0) {
      throw new Error(
        `Missing required config keys in config.env: ${missing.join(', ')}`,
      );
    }
  }

  /**
   * Get a config value by key.
   * @param key - The config key
   * @param defaultValue - Optional default if key not found
   * @returns The config value
   */
  get(key: string, defaultValue?: string): string {
    const value = this.config[key] ?? defaultValue;
    if (value === undefined) {
      throw new Error(`Config key "${key}" not found and no default provided`);
    }
    return value;
  }

  /** @returns Gemini API key */
  get geminiApiKey(): string {
    return this.get('GEMINI_API_KEY');
  }

  /** @returns Gemini model id (e.g., 'gemini-2.5-flash-lite') */
  get geminiModel(): string {
    return this.get('GEMINI_MODEL', 'gemini-2.5-flash-lite');
  }

  /** @returns Server port */
  get port(): number {
    return parseInt(this.get('PORT', '8889'), 10);
  }

  /** @returns Data directory path */
  get dataDir(): string {
    return this.get('DATA_DIR', './data');
  }

  /** @returns Viettel Product API URL (empty string means use mock) */
  get viettelProductApiUrl(): string {
    return this.get('VIETTEL_PRODUCT_API_URL', '');
  }

  /** @returns Max concurrent API calls */
  get maxConcurrentApiCalls(): number {
    return parseInt(this.get('MAX_CONCURRENT_API_CALLS', '5'), 10);
  }

  /** @returns API retry count */
  get apiRetryCount(): number {
    return parseInt(this.get('API_RETRY_COUNT', '6'), 10);
  }

  /** @returns Dashboard refresh interval in seconds */
  get dashboardRefreshSeconds(): number {
    return parseInt(this.get('DASHBOARD_REFRESH_SECONDS', '30'), 10);
  }

  /** @returns Whether to use mock Viettel Product API */
  get useMockProductApi(): boolean {
    return !this.viettelProductApiUrl;
  }

  // ── Queue configuration ──

  /** @returns Queue backend: 'memory' (SQLite-backed in-proc) or 'redis' (BullMQ) */
  get queueBackend(): 'memory' | 'redis' {
    const v = this.get('QUEUE_BACKEND', 'memory').toLowerCase();
    return v === 'redis' ? 'redis' : 'memory';
  }

  /** @returns Max parallel jobs per worker (default 8) */
  get queueConcurrency(): number {
    return Math.max(1, parseInt(this.get('QUEUE_CONCURRENCY', '8'), 10));
  }

  /** @returns Worker poll interval in ms (memory backend only) */
  get queuePollIntervalMs(): number {
    return Math.max(100, parseInt(this.get('QUEUE_POLL_INTERVAL_MS', '500'), 10));
  }

  /** @returns Max retry attempts per job before permanent failure */
  get queueMaxAttempts(): number {
    return Math.max(1, parseInt(this.get('QUEUE_MAX_ATTEMPTS', '3'), 10));
  }

  /** @returns Rate limit: max Gemini API calls per minute (0 = unlimited) */
  get queueRateLimitPerMinute(): number {
    return Math.max(0, parseInt(this.get('QUEUE_RATE_LIMIT_PER_MINUTE', '60'), 10));
  }

  /** @returns Redis host (when queueBackend=redis) */
  get redisHost(): string {
    return this.get('REDIS_HOST', '127.0.0.1');
  }

  /** @returns Redis port */
  get redisPort(): number {
    return parseInt(this.get('REDIS_PORT', '6379'), 10);
  }

  /** @returns Redis password, or empty string if none */
  get redisPassword(): string {
    return this.get('REDIS_PASSWORD', '');
  }

  /** @returns Redis database number (0-15 typically) */
  get redisDb(): number {
    return parseInt(this.get('REDIS_DB', '0'), 10);
  }

  /** @returns Key prefix for BullMQ queues in Redis */
  get redisKeyPrefix(): string {
    return this.get('REDIS_KEY_PREFIX', 'viettel_ocr');
  }
}
