import dotenv from 'dotenv';

dotenv.config();

const requireEnv = (name, defaultValue) => {
  const value = process.env[name];
  if (value === undefined || value === '') {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

const env = {
  nodeEnv: requireEnv('NODE_ENV', 'development'),
  appName: requireEnv('APP_NAME', 'Career Intelligence Platform'),
  port: Number(requireEnv('API_PORT', '4000')),
  publicUrl: requireEnv('API_PUBLIC_URL', 'http://localhost:4000'),
  frontendUrl: requireEnv('FRONTEND_URL', 'http://localhost:5173'),
  dataServiceUrl: requireEnv('DATA_SERVICE_URL', 'http://localhost:8000'),
  dataServiceApiKey: requireEnv('DATA_SERVICE_API_KEY', 'change-me'),

  mongoUri: requireEnv(
    'MONGODB_URI',
    'mongodb://localhost:27017/career_intelligence',
  ),

  jwtSecret: requireEnv('JWT_SECRET', 'dev-insecure-secret-change-me'),
  jwtExpiresIn: requireEnv('JWT_EXPIRES_IN', '7d'),

  rateLimitWindowMs: Number(requireEnv('RATE_LIMIT_WINDOW_MS', '900000')),
  rateLimitMax: Number(requireEnv('RATE_LIMIT_MAX', '100')),

  maxUploadSizeMb: Number(requireEnv('MAX_UPLOAD_SIZE_MB', '10')),
  allowedUploadMimeTypes: requireEnv(
    'ALLOWED_UPLOAD_MIME_TYPES',
    'application/pdf,image/png,image/jpeg',
  ).split(','),

  logLevel: requireEnv('LOG_LEVEL', 'info'),

  llmApiUrl: requireEnv('LLM_API_URL', ''),
  llmApiKey: requireEnv('LLM_API_KEY', ''),
  llmModel: requireEnv('LLM_MODEL', 'gpt-4o-mini'),

  smtpHost: requireEnv('SMTP_HOST', ''),
  smtpPort: requireEnv('SMTP_PORT', ''),
  smtpSecure: requireEnv('SMTP_SECURE', ''),
  smtpUser: requireEnv('SMTP_USER', ''),
  smtpPassword: requireEnv('SMTP_PASSWORD', ''),
  smtpFrom: requireEnv('SMTP_FROM', 'no-reply@careerlens.example'),
  mailhookUrl: requireEnv('MAILHOOK_URL', ''),

  mlApiUrl: requireEnv('ML_API_URL', ''),
  mlApiKey: requireEnv('ML_API_KEY', ''),
};

export default env;