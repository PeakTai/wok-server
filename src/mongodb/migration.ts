import { Db } from 'mongodb'
import { MongoDBException } from './exception'
import { getLogger } from '../log'

/**
 * 迁移版本，是一个函数，可以在函数的内部通过 mongodb 驱动提升的 api 来完成操作。
 * 注：驱动里有些 api 是没有的，和 mongodb 的脚本有区分，但是有些是可以通过 db.command() 来替代的。
 */
export type MongoMigrationVersion = (db: Db) => Promise<void>

/**
 * 迁移
 * @param db
 * @param versionList
 */
export async function migrate(db: Db, versionList: MongoMigrationVersion[]) {
  let currentVersion = await getCurrentVersion(db)
  // 逐个执行，迁移执行的逻辑是无法提供事务支持的
  // 版本管理代码是自定义的，无法做到强制绑定 session
  // 一旦出错，只能手动处理数据库，然后再重新执行程序，和 mysql 一样
  for (let idx = 0; idx < versionList.length; idx++) {
    if (idx <= currentVersion) {
      continue
    }
    const migrationVersion = versionList[idx]
    getLogger().info(`MongoDB migrating, version: ${idx}`)
    await migrationVersion(db)
    await updateVersion(db, idx)
  }
}

/**
 * 版本管理集合.
 */
interface VersionColl {
  _id: string
  version: number
}

const VERSION_COLLECTION_NAME = 'db_version'
const VERSION_RECORD_ID = 'db_version'

async function getCurrentVersion(db: Db): Promise<number> {
  const res = await db
    .collection<VersionColl>(VERSION_COLLECTION_NAME)
    .findOne({ _id: VERSION_RECORD_ID })
  return res ? res.version : -1
}

/**
 * 更新版本号
 * @param db
 * @param version
 */
async function updateVersion(db: Db, version: number) {
  const collection = db.collection<VersionColl>(VERSION_COLLECTION_NAME)
  const res = await collection.findOne({ _id: VERSION_RECORD_ID })
  if (res) {
    const rs = await collection.updateOne({ _id: VERSION_RECORD_ID }, { $set: { version } })
    if (rs.modifiedCount !== 1) {
      throw new MongoDBException('Failed to update version.')
    }
  } else {
    await collection.insertOne({ _id: VERSION_RECORD_ID, version: version })
  }
}
