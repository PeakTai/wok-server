import { MongoMigrationVersion } from './../../src'
import { User } from './user'

export const versionList: MongoMigrationVersion[] = [
  // 版本一
  async db => {
    // 创建一个集合，插入点数据 再创建索引
    await db.createCollection('user')
    await db
      .collection<User>('user')
      .createIndex({ nickname: 1 }, { unique: true, name: 'uk_nickname' })
    await db
      .collection<User>('user')
      .createIndex({ skills: 1 }, { unique: false, name: 'idx_skills' })
    // 预置数据
    await db.collection<User>('user').insertOne({
      nickname: 'jack',
      skills: ['java'],
      createAt: new Date(),
      updateAt: new Date()
    })
  },
  // 版本二
  async db => {
    // 删除一个索引
    await db.collection<User>('user').dropIndex('idx_skills')
    // 预置数据
    await db.collection<User>('user').insertOne({
      nickname: 'tom',
      skills: ['golang', 'rust'],
      createAt: new Date(),
      updateAt: new Date()
    })
  }
]
