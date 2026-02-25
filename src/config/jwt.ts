function parseExpiry(value: string | undefined, defaultSeconds: number): number {
  if (!value) return defaultSeconds;
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) return defaultSeconds;
  const num = parseInt(match[1], 10);
  switch (match[2]) {
    case 's': return num;
    case 'm': return num * 60;
    case 'h': return num * 3600;
    case 'd': return num * 86400;
    default: return defaultSeconds;
  }
}

export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'default-jwt-secret',
  expiresIn: parseExpiry(process.env.JWT_EXPIRES_IN, 86400),
};
