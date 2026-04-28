/**
 * modules/logger.js
 * Simple structured logger with timestamps and levels.
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL || 'info'];

function log(level, ...args) {
  if (LEVELS[level] < currentLevel) return;
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const prefix = {
    debug: '🔍 DEBUG',
    info:  '✅ INFO ',
    warn:  '⚠️  WARN ',
    error: '❌ ERROR',
  }[level];
  console[level === 'error' ? 'error' : 'log'](`[${ts}] ${prefix}`, ...args);
}

export const logger = {
  debug: (...a) => log('debug', ...a),
  info:  (...a) => log('info',  ...a),
  warn:  (...a) => log('warn',  ...a),
  error: (...a) => log('error', ...a),
};
