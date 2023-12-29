import { MongoClient } from 'mongodb'
import { registerConfig } from '../config'
import { MongoDBConfig, configValidation, defaultConfig } from './config'
import { MongoDBManager } from './manager'
import { MongoMigrationVersion, migrate } from './migration'

const managerMap = new Map<string, MongoDBManager>()

const DEFAULT_NAME = 'MONGO'

/**
 * 启用 MongoDB
 * @param opts 选项
 */
export async function enableMongoDB(opts?: {
  /**
   * 配置名称，同时也是环境变量配置的前缀，英文开头，由英文数字和下划线成.
   */
  name?: string
  /**
   * 迁移
   */
  migration?: { versionList: MongoMigrationVersion[] }
}) {
  const finalOpts = opts || {}
  // 校验名称
  if (finalOpts.name) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(finalOpts.name)) {
      throw new Error(
        `The mongodb configuration name must start with an english letter, digit or an underscore (_), and cannot exceed 32 characters：${finalOpts.name}`
      )
    }
  }
  const finalName = finalOpts.name || DEFAULT_NAME
  // 配置信息
  const mongoConfig = registerConfig<MongoDBConfig>(defaultConfig, finalName, configValidation)
  const client = new MongoClient(mongoConfig.uri, {
    maxPoolSize: mongoConfig.maxPoolSize,
    minPoolSize: mongoConfig.minPoolSize,
    maxConnecting: mongoConfig.maxConnecting,
    maxIdleTimeMS: mongoConfig.maxIdleTimeMS,
    waitQueueTimeoutMS: mongoConfig.waitQueueTimeoutMS
  })
  const db = client.db()
  // 版本控制
  if (finalOpts.migration) {
    await migrate(db, finalOpts.migration.versionList)
  }
  process.addListener('beforeExit', () => client.close())
  managerMap.set(finalName, new MongoDBManager(mongoConfig, db, client))
}
/**
 * 获取管理器实例
 * @param name
 * @returns
 */
export function getMongoDBManager(name?: string) {
  const manager = managerMap.get(name || DEFAULT_NAME)
  if (!manager) {
    throw new Error(
      `找不到想要的 mongodb 配置 ${name ? ': ' + name : ''}，请先调用 enableMongoDB 启用`
    )
  }
  return manager
}

export { MongoDBConfig } from './config'
export * from './exception'
export { MongoMigrationVersion } from './migration'
export * from './collection'
export * from './doc'
