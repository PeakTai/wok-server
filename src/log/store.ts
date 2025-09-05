import { LogConfig } from './config'
import { Log } from './log'

/**
 * 日志存储函数
 */
export interface LogStore {
  /**
   * 日志存储函数
   * @param log 日志
   * @param config 日志配置
   */
  (log: Log, config: LogConfig): void
}

/**
 * 日志存储函数
 */
let STORE: LogStore | undefined

/**
 * 设置日志存储.
 * @param store
 */
export function setLogStore(store: LogStore) {
  STORE = store
}

export function getLogStore(): LogStore | undefined {
  return STORE
}
