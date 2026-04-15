/**
 * Configuration key constants.
 */

export const CONFIG_KEYS = {
  GEMINI_API_KEY: 'GEMINI_API_KEY',
  PORT: 'PORT',
  DATA_DIR: 'DATA_DIR',
  VIETTEL_PRODUCT_API_URL: 'VIETTEL_PRODUCT_API_URL',
  MAX_CONCURRENT_API_CALLS: 'MAX_CONCURRENT_API_CALLS',
  API_RETRY_COUNT: 'API_RETRY_COUNT',
  DASHBOARD_REFRESH_SECONDS: 'DASHBOARD_REFRESH_SECONDS',
} as const;

export type ConfigKey = keyof typeof CONFIG_KEYS;

/** Config keys that are required (must be set by user) */
export const REQUIRED_CONFIG_KEYS: ReadonlyArray<string> = [
  CONFIG_KEYS.GEMINI_API_KEY,
] as const;

/** Default config values */
export const CONFIG_DEFAULTS: Record<string, string> = {
  [CONFIG_KEYS.PORT]: '8889',
  [CONFIG_KEYS.DATA_DIR]: './data',
  [CONFIG_KEYS.VIETTEL_PRODUCT_API_URL]: '',
  [CONFIG_KEYS.MAX_CONCURRENT_API_CALLS]: '5',
  [CONFIG_KEYS.API_RETRY_COUNT]: '3',
  [CONFIG_KEYS.DASHBOARD_REFRESH_SECONDS]: '30',
} as const;
