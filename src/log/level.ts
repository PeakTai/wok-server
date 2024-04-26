/**
 * 日志级别.
 */
export enum LogLevel {
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4
}

/**
 * 解析日志级别
 * @param level
 */
export function parseLogLevel(level: string): LogLevel {
  const iLevel = level.toUpperCase()
  switch (iLevel) {
    case 'DEBUG':
      return LogLevel.DEBUG
    case 'INFO':
      return LogLevel.INFO
    case 'WARN':
      return LogLevel.WARN
    case 'ERROR':
      return LogLevel.ERROR
    default:
      throw new Error(`Unknown log level ：${level}`)
  }
}
