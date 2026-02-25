const REQUIRED_IN_PRODUCTION = [
  'DB_PASSWORD',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
];

const RECOMMENDED = [
  'DB_HOST',
  'DB_USER',
  'DB_NAME',
];

export function validateEnv(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const key of REQUIRED_IN_PRODUCTION) {
    if (!process.env[key]) {
      if (isProduction) {
        missing.push(key);
      } else {
        warnings.push(key);
      }
    }
  }

  for (const key of RECOMMENDED) {
    if (!process.env[key]) {
      warnings.push(key);
    }
  }

  if (warnings.length > 0) {
    console.warn(`Missing env vars (using defaults): ${warnings.join(', ')}`);
  }

  if (missing.length > 0) {
    console.error(`Missing REQUIRED env vars for production: ${missing.join(', ')}`);
    console.error('Set these in your .env file or environment. Run: bash backend/setup.sh');
    process.exit(1);
  }
}
