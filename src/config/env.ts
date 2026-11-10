/**
 * Centralized Environment Configuration
 * 
 * In Expo SDK 49+, environment variables starting with EXPO_PUBLIC_ 
 * are automatically available in JavaScript/TypeScript via process.env.
 */

export interface EnvConfig {
  readonly API_URL: string;
  readonly IS_DEV: boolean;
  readonly IS_API_CONFIGURED: boolean;
  readonly DEFAULT_ORG_SLUG: string;
}

// Single source of truth: .env via process.env.EXPO_PUBLIC_*
const DEFAULT_API_URL = 'https://launchpaad.tech/macslearnbackend/api/v1';
const configuredApiUrl = (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_API_URL).trim().replace(/\/+$/, '');
const orgSlug = (process.env.EXPO_PUBLIC_ORG_SLUG ?? 'org1').trim() || 'org1';

export const ENV: EnvConfig = Object.freeze({
  /**
   * Base URL for the backend API directly from .env (EXPO_PUBLIC_API_URL).
   * Production URL: https://launchpaad.tech/macslearnbackend/api/v1
   */
  API_URL: configuredApiUrl,

  /**
   * Indicates whether the application is running in development mode.
   */
  IS_DEV: typeof __DEV__ !== 'undefined' ? __DEV__ : true,

  /**
   * Indicates whether the API base URL has been configured in the environment.
   */
  IS_API_CONFIGURED: configuredApiUrl.length > 0,

  /**
   * Organization slug from .env (EXPO_PUBLIC_ORG_SLUG).
   * Default: org1 (Cotr Global Online)
   */
  DEFAULT_ORG_SLUG: orgSlug,
});

export default ENV;
