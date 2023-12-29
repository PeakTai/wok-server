import { EOL } from 'os'
import { config } from './config'
import { formatDateTime } from './date'
import { LogLevel, LogLevelVals } from './level'
import { getLogStore, setLogStore } from './store'
import { fileStore } from './file'

/**
 * 日志级别的值
 */
const LOG_LEVEL_VAL = LogLevelVals[config.level]
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
  const levelVal = LogLevelVals[level]
  if (levelVal >= LOG_LEVEL_VAL) {
    const date = new Date()
    // 控制台输出日志
    let msg = `[${formatDateTime(date)}][${level}]${message}`
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
}

const logger = Object.freeze({
  /**
   * debug 日志
   */
  debug(message: string) {
    log(LogLevel.DEBUG, message)
  },

  isDebugEnabled() {
    return LogLevelVals[LogLevel.DEBUG] >= LOG_LEVEL_VAL
  },
  /**
   * info 日志
   * @param message
   */
  info(message: string) {
    log(LogLevel.INFO, message)
  },

  isInfoEnabled() {
    return LogLevelVals[LogLevel.INFO] >= LOG_LEVEL_VAL
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
    return LogLevelVals[LogLevel.WARN] >= LOG_LEVEL_VAL
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
    return LogLevelVals[LogLevel.ERROR] >= LOG_LEVEL_VAL
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
