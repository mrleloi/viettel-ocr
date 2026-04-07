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

  /** @returns Server port */
  get port(): number {
    return parseInt(this.get('PORT', '3000'), 10);
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
    return parseInt(this.get('API_RETRY_COUNT', '3'), 10);
  }

  /** @returns Dashboard refresh interval in seconds */
  get dashboardRefreshSeconds(): number {
    return parseInt(this.get('DASHBOARD_REFRESH_SECONDS', '30'), 10);
  }

  /** @returns Whether to use mock Viettel Product API */
  get useMockProductApi(): boolean {
    return !this.viettelProductApiUrl;
  }
}
