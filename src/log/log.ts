import { EOL } from 'os'
import { formatDateTime } from './date'
import { LogLevel } from './level'

/**
 * 单条日志的信息
 */
export interface Log {
  /**
   * 日志的时间
   */
  time: Date
  /**
   * 日志的等级
   */
  level: LogLevel
  /**
   * 日志的内容
   */
  content: string
  /**
   * 异常信息
   */
  error?: any
  /**
   * 前缀信息
   */
  prefix?: string
}

/**
 * 将日志格式化为简单的文本
 * @param log
 * @param ignoreError 忽略异常信息
 * @returns
 */
export function formatLogText(log: Log, ignoreError = false) {
  let str = `[${formatDateTime(log.time)}][${LogLevel[log.level]}]${
    log.prefix ? `[${log.prefix}]` : ''
  }${log.content}`
  if (log.error && !ignoreError) {
    if (log.error.stack) {
      str += EOL + log.error.stack
    } else if (log.error.message) {
      str += EOL + log.error.message
    } else {
      str += EOL + log.error
    }
  }
  return str
}

/**
 * 将日志格式化为 json
 * @param log
 * @param ignoreError 忽略异常信息
 * @returns
 */
export function formatLogJson(log: Log, ignoreError = false) {
  let error: string | undefined
  if (log.error && !ignoreError) {
    error = ''
    if (log.error.stack) {
      error += log.error.stack
    } else if (log.error.message) {
      error += log.error.message
    } else {
      error += log.error
    }
  }
  const json: any = { ...log }
  delete json.error
  if (error) {
    json.error = error
  }
  return JSON.stringify(json)
}
