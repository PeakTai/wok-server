/**
 * 日志存储函数
 */
export interface LogStore {
  (log: string): void
}

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
