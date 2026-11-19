'use strict';
const env = process.env;
module.exports = () => ({
  port: Number(env.PORT) || 3000,
  databaseUrl: env.DATABASE_URL || '',
  allowedOrigins: (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  tz: env.APP_TZ || 'Africa/Cairo',
  sessionDays: Number(env.SESSION_DAYS) || 30,
  nodeEnv: env.NODE_ENV || 'development',
  trustProxy: env.TRUST_PROXY === '1',
  now: () => new Date()
});
