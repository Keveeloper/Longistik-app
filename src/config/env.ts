/*
 * App environment, fixed at build time by VITE_APP_ENV (see .env.development,
 * .env.test and .env.production):
 * - `npm run dev` and `npm run build:test` -> test
 * - `npm run build` -> production
 * Anything other than "test" counts as production, so a misconfigured build
 * never shows test data to real users.
 */
export type AppEnv = 'test' | 'production';

export const APP_ENV: AppEnv = import.meta.env.VITE_APP_ENV === 'test' ? 'test' : 'production';

export const IS_TEST_ENV = APP_ENV === 'test';

/**
 * Companies that exist only for testing. There is a single panel for both
 * environments, so the app filters its directory: in test only these are
 * listed, and in production they are hidden.
 */
export const TEST_COMPANY_CODES = ['finaltest'];

export const isCompanyAllowed = (code: string, env: AppEnv = APP_ENV) =>
  TEST_COMPANY_CODES.includes(code) === (env === 'test');
