/**
 * Infra: Logger
 *
 * Structured JSON logger (pino). Single instance shared across the app.
 *
 * Levels by environment:
 *   test        → silent  (no output during jest runs)
 *   development → debug   (unless LOG_LEVEL overrides)
 *   production  → info    (unless LOG_LEVEL overrides)
 *
 * Usage: logger.info({ action }, 'command received')
 *        logger.error({ err }, 'persistence write failed')
 *
 * Never log: IP addresses, message content, PINs, or any user data.
 */
const pino = require('pino');

const isTest = process.env.NODE_ENV === 'test';
const isDev  = process.env.NODE_ENV === 'development';

const defaultLevel = isTest ? 'silent' : isDev ? 'debug' : 'info';

const logger = pino({ level: process.env.LOG_LEVEL ?? defaultLevel });

module.exports = logger;
