import { EOL } from 'os'
import { config } from './config'
import { formatDateTime } from './date'
import { fileStore } from './file'
import { LogLevel } from './level'
import { getLogStore, setLogStore } from './store'

/**
 * 文件存储
 */
if (config.file) {
  setLogStore(fileStore)
}

/**
 * 输出日志
 * @param level
 * @param message
 * @param error
 */
function log(level: LogLevel, message: string, error?: any) {
  if (level < config.level) {
    return
  }
  const date = new Date()
  // 控制台输出日志
  let msg = `[${formatDateTime(date)}][${LogLevel[level]}]${message}`
  console.log(msg)
  if (error) {
    console.log(error)
  }
  // 存储中输出日志
  const store = getLogStore()
  if (store) {
    if (error) {
      if (error.stack) {
        msg += EOL + error.stack
      } else if (error.message) {
        msg += EOL + error.message
      } else {
        msg += EOL + error
      }
    }
    store(msg)
  }
}

const logger = Object.freeze({
  /**
   * debug 日志
   */
  debug(message: string) {
    log(LogLevel.DEBUG, message)
  },

  isDebugEnabled() {
    return LogLevel.DEBUG >= config.level
  },
  /**
   * info 日志
   * @param message
   */
  info(message: string) {
    log(LogLevel.INFO, message)
  },

  isInfoEnabled() {
    return LogLevel.INFO >= config.level
  },
  /**
   * 警告日志
   * @param message
   * @param error
   */
  warn(message: string, error?: any) {
    log(LogLevel.WARN, message, error)
  },

  isWarnEnabled() {
    return LogLevel.WARN >= config.level
  },
  /**
   * 错误日志
   * @param message
   * @param error
   */
  error(message: string, error?: any) {
    log(LogLevel.ERROR, message, error)
  },

  isErrorEnabled() {
    return LogLevel.ERROR >= config.level
  }
})

/**
 * 获取日志对象.
 * @returns
 */
export function getLogger() {
  return logger
}

export * from './config'
export * from './level'
export { setLogStore } from './store'

