import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  redact: {
    paths: [
      'req.headers.authorization',
      'req.body.password',
      'req.body.refreshToken',
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'secret',
      's3SecretKey',
      'S3_SECRET_KEY',
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
    ],
    remove: true,
  },
  transport: !isProduction
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    : undefined,
});
