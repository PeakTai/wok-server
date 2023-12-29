import { ValidationOpts, max, min, notBlank, notNull } from '../validation'

/**
 * MongoDB 配置.
 */
export interface MongoDBConfig {
  /**
   * 连接地址.
   * 示例：mongodb+srv://<user>:<password>@<cluster-url>?retryWrites=true&writeConcern=majority
   */
  uri: string
  /** The maximum number of connections in the connection pool. */
  maxPoolSize: number
  /** The minimum number of connections in the connection pool. */
  minPoolSize: number
  /** The maximum number of connections that may be in the process of being established concurrently by the connection pool. */
  maxConnecting: number
  /** The maximum number of milliseconds that a connection can remain idle in the pool before being removed and closed. */
  maxIdleTimeMS: number
  /** The maximum time in milliseconds that a thread can wait for a connection to become available. */
  waitQueueTimeoutMS: number
  /**
   * 开启慢查询警告，默认开启
   */
  slowQueryWarn: boolean
  /**
   * 慢查询毫秒数，默认 200
   */
  slowQueryMs: number
  /**
   *事务超时时间，单位毫秒，默认 5000，设置为0的值表示不限制
   */
  transactionTimeout: number
  /**
   * 事务严格模式
   */
  transactionStrict: boolean
}

/**
 * 默认配置.
 */
export const defaultConfig: MongoDBConfig = {
  uri: 'mongodb://test:123456@localhost/test',
  maxPoolSize: 10,
  minPoolSize: 1,
  maxConnecting: 10,
  maxIdleTimeMS: 60000,
  waitQueueTimeoutMS: 60000,
  slowQueryWarn: true,
  slowQueryMs: 200,
  transactionTimeout: 5000,
  transactionStrict: true
}
/**
 * 配置校验
 */
export const configValidation: ValidationOpts<MongoDBConfig> = {
  uri: [notBlank()],
  maxPoolSize: [notNull(), min(1), max(1000)],
  minPoolSize: [notNull(), min(1), max(1000)],
  maxConnecting: [notNull(), min(1), max(1000)],
  maxIdleTimeMS: [notNull(), min(1)],
  waitQueueTimeoutMS: [notNull(), min(1)],
  slowQueryWarn: [notNull()],
  slowQueryMs: [notNull(), min(1), max(3600000)],
  transactionTimeout: [notNull(), min(0), max(3600000)],
  transactionStrict: [notNull()]
}
