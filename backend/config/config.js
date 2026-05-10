const dotenv = require('dotenv');
const path = require('path');
const Joi = require('joi');

dotenv.config({ path: path.join(__dirname, '../.env') });

const envVarsSchema = Joi.object()
  .keys({
    NODE_ENV: Joi.string().valid('production', 'development', 'test').required(),
    PORT: Joi.number().default(3000),
    // MySQL
    DB_HOST: Joi.string().required().description('MySQL host'),
    DB_PORT: Joi.number().default(3306),
    DB_USER: Joi.string().required().description('MySQL username'),
    DB_PASSWORD: Joi.string().allow('').required().description('MySQL password'),
    DB_NAME: Joi.string().required().description('MySQL database name'),
    // JWT
    JWT_SECRET: Joi.string().required().description('JWT secret key'),
    JWT_ACCESS_EXPIRATION_MINUTES: Joi.number().default(30),
    JWT_REFRESH_EXPIRATION_DAYS: Joi.number().default(30),
    JWT_RESET_PASSWORD_EXPIRATION_MINUTES: Joi.number().default(10),
    JWT_VERIFY_EMAIL_EXPIRATION_MINUTES: Joi.number().default(10),
    // Email
    SMTP_HOST: Joi.string().description('SMTP host'),
    SMTP_PORT: Joi.number().description('SMTP port'),
    SMTP_USERNAME: Joi.string().description('SMTP username'),
    SMTP_PASSWORD: Joi.string().description('SMTP password'),
    EMAIL_FROM: Joi.string().description('Email from address'),
    // BrandBox SMS
    BRANDBOX_API_KEY:     Joi.string().description('BrandBox API key'),
    BRANDBOX_API_SECRET:  Joi.string().description('BrandBox API secret'),
    BRANDBOX_SENDER_NAME: Joi.string().default('TPFCS'),
    // OTP
    OTP_EXPIRY_MINUTES:   Joi.number().default(10),
    // File Upload
    UPLOAD_DIR: Joi.string().default('uploads'),
    MAX_FILE_SIZE: Joi.number().default(10485760), // 10MB
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

module.exports = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,
  db: {
    host: envVars.DB_HOST,
    port: envVars.DB_PORT,
    user: envVars.DB_USER,
    password: envVars.DB_PASSWORD,
    database: envVars.DB_NAME,
  },
  jwt: {
    secret: envVars.JWT_SECRET,
    accessExpirationMinutes: envVars.JWT_ACCESS_EXPIRATION_MINUTES,
    refreshExpirationDays: envVars.JWT_REFRESH_EXPIRATION_DAYS,
    resetPasswordExpirationMinutes: envVars.JWT_RESET_PASSWORD_EXPIRATION_MINUTES,
    verifyEmailExpirationMinutes: envVars.JWT_VERIFY_EMAIL_EXPIRATION_MINUTES,
  },
  email: {
    smtp: {
      host: envVars.SMTP_HOST,
      port: envVars.SMTP_PORT,
      auth: {
        user: envVars.SMTP_USERNAME,
        pass: envVars.SMTP_PASSWORD,
      },
    },
    from: envVars.EMAIL_FROM,
  },
  sms: {
    brandbox: {
      apiKey:     envVars.BRANDBOX_API_KEY,
      apiSecret:  envVars.BRANDBOX_API_SECRET,
      senderName: envVars.BRANDBOX_SENDER_NAME,
    },
  },
  otp: {
    expiryMinutes: envVars.OTP_EXPIRY_MINUTES,
  },
  upload: {
    dir: envVars.UPLOAD_DIR,
    maxSize: envVars.MAX_FILE_SIZE,
  },
};
