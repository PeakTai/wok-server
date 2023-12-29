import { max, min, notBlank, notNull, ValidationOpts } from '../validation'

/**
 * mysql 配置.
 */
export interface MysqlConfig {
  /**
   * 主机名.
   */
  host: string
  /**
   * 端口号
   */
  port: number
  /**
   * 用户名
   */
  user: string
  /**
   * 密码
   */
  password: string
  /**
   * 字符集，默认 utf8mb4
   */
  charset: string
  /**
   * 库
   */
  database: string
  /**
   * 版本控制开启.
   */
  versionControlEnabled: boolean
  /**
   * 版本控制的文件目录，默认 db_migration.
   */
  versionControlDir: string
  /**
   * 时区，默认 +08:00
   */
  timezone: string
  /**
   * 超时时间，单位毫秒，默认 10秒
   */
  connectTimeout: number
  /**
   * 调试模式
   */
  debug: boolean
  /**
   * 最大连接数
   */
  connectionLimit: number
  /**
   * 最大闲置数
   */
  maxIdle: number
  /**
   * 闲置的超时时间，也即多久不用算闲置，单位毫秒
   */
  idleTimeout: number
  /**
   * 慢 sql 警告，启用后如果一个查询过慢，就会输出警告日志。
   */
  slowSqlWarn: boolean
  /**
   * 慢 sql 毫秒数，执行时间超过设定值的 sql 会被认为是慢 sql ，默认 200
   */
  slowSqlMs: number
  /**
   * 事务超时时间，单位毫秒，默认 5000，设置为小于等于 0 的值表示不限制
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
export const defaultConfig: MysqlConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '123456',
  charset: 'utf8mb4',
  database: 'example',
  versionControlEnabled: false,
  versionControlDir: 'db_migration',
  timezone: '+08:00',
  connectTimeout: 10000,
  debug: false,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  slowSqlWarn: true,
  slowSqlMs: 200,
  transactionTimeout: 5000,
  transactionStrict: true
}
/**
 * 配置校验规则.
 */
export const configValidation: ValidationOpts<MysqlConfig> = {
  host: [notBlank()],
  port: [notNull(), min(80), max(65535)],
  user: [notBlank()],
  password: [notBlank()],
  charset: [notBlank()],
  database: [notBlank()],
  versionControlEnabled: [notNull()],
  versionControlDir: [notNull()],
  timezone: [notBlank()],
  connectTimeout: [notNull(), min(1000), max(60000)],
  connectionLimit: [notNull(), min(1), max(999)],
  maxIdle: [notNull(), min(1), max(999)],
  idleTimeout: [notNull(), min(1000), max(60000)],
  slowSqlWarn: [notNull()],
  slowSqlMs: [notNull(), min(1), max(3600000)],
  transactionTimeout: [notNull(), min(0), max(60000)],
  transactionStrict: [notNull()]
}
