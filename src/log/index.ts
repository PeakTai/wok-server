import { config } from './config'
import { fileStore } from './file'
import { LogLevel } from './level'
import { formatLogJson, formatLogText, Log } from './log'
import { getLogStore, setLogStore } from './store'

/**
 * 文件存储
 */
if (config.file) {
  setLogStore(fileStore)
}

class Logger {
  constructor(private prefix?: string) {}

  /**
   * 输出日志
   * @param level
   * @param message
   * @param error
   */
  private log(level: LogLevel, message: string, error?: any) {
    if (level < config.level) {
      return
    }
    const log: Log = {
      level,
      content: message,
      time: new Date(),
      prefix: this.prefix,
      error
    }
    // 控制台输出日志
    if (config.console) {
      // const msg = config.format === 'text' ? formatLogText(log, true) : formatLogJson(log, true)
      // 控制台强制使用 text 格式，json 格式只在文件中输出
      const msg = formatLogText(log, true)
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(msg)
          break
        case LogLevel.INFO:
          console.info(msg)
          break
        case LogLevel.WARN:
          console.warn(msg)
          break
        case LogLevel.ERROR:
          console.error(msg)
          break
      }
      if (error) {
        console.error(error)
      }
    }
    // 自定义存储中输出日志
    const store = getLogStore()
    if (store) {
      store(log, config)
    }
  }
  /**
   * debug 日志
   */
  debug(message: string) {
    this.log(LogLevel.DEBUG, message)
  }

  isDebugEnabled() {
    return LogLevel.DEBUG >= config.level
  }
  /**
   * info 日志
   * @param message
   */
  info(message: string) {
    this.log(LogLevel.INFO, message)
  }

  isInfoEnabled() {
    return LogLevel.INFO >= config.level
  }
  /**
   * 警告日志
   * @param message
   * @param error
   */
  warn(message: string, error?: any) {
    this.log(LogLevel.WARN, message, error)
  }
  /**
   * 等同于 warn
   * @param message
   * @param error
   */
  warning(message: string, error?: any) {
    this.log(LogLevel.WARN, message, error)
  }

  isWarnEnabled() {
    return LogLevel.WARN >= config.level
  }
  /**
   * 错误日志
   * @param message
   * @param error
   */
  error(message: string, error?: any) {
    this.log(LogLevel.ERROR, message, error)
  }

  isErrorEnabled() {
    return LogLevel.ERROR >= config.level
  }
}

const defaultLogger = new Logger()

/**
 * 获取日志对象.
 *
 * @param prefix 日志前缀，如果有值，每条日志前都会加上前缀信息
 * @returns
 */
export function getLogger(prefix?: string) {
  if (prefix) {
    return new Logger(prefix)
  }
  return defaultLogger
}

export * from './config'
export * from './level'
export * from './log'
export { setLogStore } from './store'
