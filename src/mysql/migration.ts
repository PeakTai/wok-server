import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { Connection, RowDataPacket } from 'mysql2'
import { isAbsolute, resolve } from 'path'
import { getLogger } from '../log'
import { MysqlConfig } from './config'
import { MysqlException } from './exception'
import { promiseQuery } from './manager/utils'

/**
 * 版本信息.
 */
interface MysqlVersion {
  version: number
  filePath: string
}

/**
 * 迁移.
 * @param config
 * @param conn
 */
export async function migrate(config: MysqlConfig, conn: Connection) {
  const versionDir = config.versionControlDir
  // 查找文件
  const dir = isAbsolute(versionDir) ? versionDir : resolve(process.cwd(), versionDir)
  if (!existsSync(dir)) {
    throw new Error(`Directory ${versionDir} does not exist`)
  }
  const versions: MysqlVersion[] = []
  // 忽略隐藏文件
  const files = readdirSync(dir).filter(file => !file.startsWith('.'))
  for (const file of files) {
    const filePath = resolve(dir, file)
    const stat = statSync(filePath)
    if (!stat.isFile()) {
      continue
    }
    if (!file.endsWith('.sql')) {
      throw new Error(`版本文件名没有以 .sql 为后缀：${file}`)
    }
    const version = parseInt(file.substring(0, file.length - 4))
    if (isNaN(version)) {
      throw new Error(`Version file is not named with a number：${file}`)
    }
    versions.push({ version, filePath })
  }
  // 排序，判定顺序
  versions.sort((o1, o2) => o1.version - o2.version)
  for (let i = 0; i < versions.length; i++) {
    const version = versions[i]
    if (version.version !== i + 1) {
      throw new Error(
        `The SQL version number must start from 1 and increment one by one，error version：${version.version}`
      )
    }
  }
  await createVersionTableIfNotExist(config, conn)

  // 在事务中执行版本管理，主要目的是为了通过锁来协调多个进程同时启动的情况
  // 事务不能保存一个版本处理成功就完整回退，如有错误，仍然需要手动调整后再操作
  await promiseQuery(config, conn, `SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED`)
  await new Promise<void>((resolve, reject) => {
    conn.beginTransaction(err => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
  try {
    // 执行 sql, 判定当前版本
    let currentVersion = await getCurrentVersion(config, conn)
    if (typeof currentVersion !== 'number') {
      // 插入初始版本号
      await promiseQuery(config, conn, 'insert `db_version`(`version`) values (0)')
    }
    const filnalCurrentVersion = currentVersion || 0
    const pendingVersions = versions.filter(ver => ver.version > filnalCurrentVersion)
    if (!pendingVersions.length) {
      getLogger().info('The SQL version is already the latest.')
      return
    }
    const nextVersion = filnalCurrentVersion + 1
    if (pendingVersions[0].version !== nextVersion) {
      throw new MysqlException(
        `MySQL migration error, the next version should be ${nextVersion}，but current is ${pendingVersions[0].version}`
      )
    }

    for (const verion of pendingVersions) {
      getLogger().info(`Mysql migrating, version: ${verion.version}`)
      let sql = readFileSync(verion.filePath, { encoding: 'utf-8' })
      await promiseQuery(config, conn, sql)
      // 版本号
      await promiseQuery(config, conn, `UPDATE db_version SET version=${verion.version};`)
    }
    // 提交
    await new Promise<void>((resolve, reject) => {
      conn.commit(err => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
    getLogger().info('Mysql migration finished.')
  } catch (e) {
    // 异常回退，仅能回退 dml 操作，对 ddl 无效
    await new Promise<void>((resolve, reject) => {
      conn.rollback(err => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
    throw e
  }
}

async function createVersionTableIfNotExist(config: MysqlConfig, conn: Connection): Promise<void> {
  await promiseQuery(
    config,
    conn,
    'CREATE TABLE IF NOT EXISTS `db_version` (' +
      '  `version` int NOT NULL,' +
      '  PRIMARY KEY (`version`)' +
      ') ENGINE = innodb DEFAULT CHARACTER SET = "utf8mb4" ' +
      'COLLATE = "utf8mb4_unicode_ci";'
  )
}
/**
 * 获取当前版本，使用 for update 加锁，用于协调多进程并发场景
 * @param config
 * @param conn
 * @returns
 */
async function getCurrentVersion(config: MysqlConfig, conn: Connection): Promise<number | null> {
  const res = await promiseQuery(config, conn, 'select version from `db_version` for update')
  const rows = res as RowDataPacket[]
  if (rows.length >= 1) {
    return rows[0].version
  } else {
    return null
  }
}
