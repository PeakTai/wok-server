import { Connection, createConnection, createPool } from 'mysql2'
import { registerConfig } from '../config'
import { MysqlConfig, configValidation, defaultConfig } from './config'
import { MysqlException } from './exception'
import { MysqlManager } from './manager'
import { MysqlCriteria } from './manager/ops/criteria'
import { migrate } from './migration'
import { Table } from './table-info'

const managerMap = new Map<string, MysqlManager>()

const defaultName = 'mysql'

/**
 * 启用mysql
 * @param name 配置名称，同时也是环境变量配置的前缀，英文开头，由英文数字和下划线成.
 */
export async function enableMysql(name?: string) {
  // 校验名称
  if (name) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(name)) {
      throw new Error(
        `mysql 配置名称必须是英文开头，由英文数字和下划线成，并且不得超过 32 位：${name}`
      )
    }
  }
  const finalName = name || defaultName
  // 连接池配置
  const mysqlConfig = registerConfig<MysqlConfig>(defaultConfig, finalName, configValidation)

  // 数据库版本管理
  if (mysqlConfig.versionControlEnabled) {
    // 创建一个支持多语句的连接，专门处理迁移
    const conn = await new Promise<Connection>((resolve, reject) => {
      const conn = createConnection({
        host: mysqlConfig.host,
        port: mysqlConfig.port,
        user: mysqlConfig.user,
        password: mysqlConfig.password,
        charset: mysqlConfig.charset,
        database: mysqlConfig.database,
        connectTimeout: mysqlConfig.connectTimeout,
        multipleStatements: true
      })
      conn.connect(err => (err ? reject(err) : resolve(conn)))
    })
    try {
      await migrate(mysqlConfig, conn)
    } finally {
      await new Promise<void>((resolve, reject) => {
        conn.end(err => (err ? reject(err) : resolve()))
      })
    }
  }
  const pool = createPool({
    host: mysqlConfig.host,
    port: mysqlConfig.port,
    user: mysqlConfig.user,
    password: mysqlConfig.password,
    charset: mysqlConfig.charset,
    database: mysqlConfig.database,
    connectTimeout: mysqlConfig.connectTimeout,
    debug: mysqlConfig.debug,
    connectionLimit: mysqlConfig.connectionLimit,
    maxIdle: mysqlConfig.maxIdle,
    idleTimeout: mysqlConfig.idleTimeout
  })
  process.addListener('beforeExit', () => pool.end())
  managerMap.set(finalName, new MysqlManager(mysqlConfig, pool))
}

/**
 * 获取管理器.
 * @param name  配置名称，如果调用 enableMysql 时填写了，那么这里也要填写并保持一致
 */
export function getMysqlManager(name?: string) {
  const manager = managerMap.get(name || defaultName)
  if (!manager) {
    throw new Error(`找不到想要的 mysql 配置 ${name ? ': ' + name : ''}，请先调用 enableMysql 启用`)
  }
  return manager
}

// 部分需要导出的对象
export * from './manager'
export { MysqlCriteria, MysqlException, Table }
