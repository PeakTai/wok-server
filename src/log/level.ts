/**
 * 日志级别.
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR'
}

export const LogLevelVals: Record<LogLevel, number> = Object.freeze({
  [LogLevel.DEBUG]: 1,
  [LogLevel.INFO]: 2,
  [LogLevel.WARN]: 3,
  [LogLevel.ERROR]: 4
})

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
      throw new Error(`无法解析日志级别：${level}`)
  }
}
