import { deepStrictEqual, equal, fail, ok } from 'assert'
import { Pool, PoolConnection } from 'mysql2'
import { MixCriteria, MysqlException, enableMysql, getMysqlManager } from '../../src'
import { buildQuery } from '../../src/mysql/manager/ops'
import { promiseGetConnection } from '../../src/mysql/manager/utils'
import { assertAsyncThrows, runTestAsync, sleep } from '../utils'
import { tableBook } from './book'
import { tableDbVersion } from './db-version'
import { User, tableUser } from './user'
import { tableQuestion } from './question'

describe('mysql 组件测试', () => {
  before(
    runTestAsync(async () => {
      // 启用
      await enableMysql()
    })
  )
  after(
    runTestAsync(async () => {
      // 销毁进行测试的数据
      const manager = getMysqlManager()
      const pool: Pool = (manager as any).opts.pool
      const conn = await promiseGetConnection(pool)
      function execute(conn: PoolConnection, sql: string) {
        return new Promise<void>((resolve, reject) => {
          conn.execute(sql, err => (err ? reject(err) : resolve()))
        })
      }
      try {
        // 删除表
        await execute(conn, 'drop table db_version')
        await execute(conn, 'drop table user')
        await execute(conn, 'drop table book')
      } finally {
        pool.releaseConnection(conn)
      }
    })
  )
  it(
    '查询条件构建测试',
    runTestAsync(async () => {
      let c1: MixCriteria<User> = c => c.eq('nickname', 'jack')
      let c2: MixCriteria<User> = { nickname: 'jack' }
      let q1 = buildQuery(c1)
      let q2 = buildQuery(c2)
      ok(q1)
      ok(q2)
      equal(q1.sql, q2.sql)
      deepStrictEqual(q1.values, q2.values)

      let c5: MixCriteria<User> = cc => cc.eq('nickname', 'Jack').lt('balance', 0)
      const q5 = buildQuery(c5)
      ok(q5)
      equal(q5.sql, ' ?? = ? and ?? < ? ')
      deepStrictEqual(q5.values, ['nickname', 'Jack', 'balance', 0])

      let c3: MixCriteria<User> = c =>
        c
          .and(cc => cc.lt('balance', 5).isNotNull('nickname'))
          .or(cc => cc.eq('nickname', 'Jack').lt('balance', 0))
      let q3 = buildQuery(c3)
      ok(q3)
      equal(q3.sql, ' ( ?? < ? and ?? is not null ) or ( ?? = ? and ?? < ? ) ')
      deepStrictEqual(q3.values, ['balance', 5, 'nickname', 'nickname', 'Jack', 'balance', 0])

      const c4: MixCriteria<User> = c => c.between('balance', 10, 30).like('nickname', 'Ja%')
      const q4 = buildQuery(c4)
      ok(q4)
      equal(q4.sql, ' ?? between ? and ? and ?? like ? ')
      deepStrictEqual(q4.values, ['balance', 10, 30, 'nickname', 'Ja%'])
    })
  )
  it(
    '版本控制验证',
    runTestAsync(async () => {
      const manager = getMysqlManager()
      // 查询预置数据
      const admin = await manager.findById(tableUser, 'admin001')
      ok(admin)
      equal(admin.nickname, 'admin')
      ok(admin.create_at)
      ok(admin.update_at)
      // 验证用户的索引，查询索引并比对
      interface IndexInfo {
        table: string
        non_unique: number
        key_name: string
      }
      let indices = await manager.query<IndexInfo>('SHOW INDEX FROM user')
      // 用户中的昵称最终被删除了
      ok(!indices.some(index => index.key_name === 'uk_user_nickname'))
      indices = await manager.query<IndexInfo>('SHOW INDEX FROM book')
      // 书籍中应该还有名称索引
      ok(!indices.some(index => index.key_name === 'idx_book_name'))

      const dbVersion = await manager.findFirst(tableDbVersion)
      ok(dbVersion)
      equal(dbVersion.version, 3)
    })
  )
  it(
    'findById 测试',
    runTestAsync(async () => {
      const manager = getMysqlManager()
      const admin = await manager.findById(tableUser, 'admin001')
      ok(admin)
      equal(admin.nickname, 'admin')
      equal(admin.id, 'admin001')
      // 查询一个不存在的记录
      const user = await manager.findById(tableUser, 'jjjkkklll')
      ok(user === null)
    })
  )
  it(
    'findByIdIn 测试',
    runTestAsync(async () => {
      const manager = getMysqlManager()
      // 用预置数据来测试
      const users = await manager.findByIdIn(tableUser, ['admin001', 't001', 't002'])
      ok(users)
      ok(Array.isArray(users))
      equal(users.length, 3)
      equal(users[0].nickname, 'admin')
      equal(users[0].id, 'admin001')
      ok(users[0].create_at)
      ok(users[0].update_at)
      equal(users[1].id, 't001')
      equal(users[1].nickname, 'test-one')
      equal(users[2].id, 't002')
      equal(users[2].nickname, 'test-two')
    })
  )
  it(
    'existsById 测试',
    runTestAsync(async () => {
      const manager = getMysqlManager()
      const res = await manager.existsById(tableUser, 'admin001')
      ok(res)
      const res2 = await manager.existsById(tableUser, 'non-existent')
      ok(!res2)
    })
  )
  it(
    'existsBy 测试',
    runTestAsync(async () => {
      const manager = getMysqlManager()
      const res = await manager.existsBy(tableUser, { nickname: 'admin' })
      ok(res)
      const res2 = await manager.existsBy(tableUser, c =>
        c.lt('balance', 9999).eq('nickname', 'Link')
      )
      ok(!res2)
    })
  )
  it(
    'deleteById 测试',
    runTestAsync(async () => {
      const manager = getMysqlManager()
      // 插入测试数据
      await manager.insert(tableUser, { id: 'd0001', nickname: '测试删除', balance: 0 })
      // 验证插入成功
      ok(await manager.existsById(tableUser, 'd0001'))

      await manager.deleteById(tableUser, 'd0001')
      const exist = await manager.existsById(tableUser, 'd0001')
      ok(!exist)
    })
  )
  it(
    'deleteOne 测试',
    runTestAsync(async () => {
      const manager = getMysqlManager()
      // 插入几条测试数据
      await manager.insert(tableUser, { id: 'do001', nickname: 'DO001', balance: 333 })
      await manager.insert(tableUser, { id: 'do002', nickname: 'DO002', balance: 444 })
      ok(await manager.existsById(tableUser, 'do001'))
      ok(await manager.existsById(tableUser, 'do002'))

      const res1 = await manager.deleteOne(tableUser, { nickname: 'DO001', balance: 333 })
      ok(res1)
      ok(!(await manager.existsById(tableUser, 'do001')))
      ok(await manager.existsById(tableUser, 'do002'))

      const res2 = await manager.deleteOne(tableUser, { nickname: 'DO002', balance: 444 })
      ok(res2)
      ok(!(await manager.existsById(tableUser, 'do002')))

      const res3 = await manager.deleteOne(tableUser, { nickname: 'DO002', balance: 11 })
      ok(!res3)
    })
  )
  it(
    'deleteMany 测试',
    runTestAsync(async () => {
      const manager = getMysqlManager()
      // 插入几条测试数据
      await manager.insert(tableUser, { id: 'd0002', nickname: 'DD02', balance: 4 })
      await manager.insert(tableUser, { id: 'd0003', nickname: 'DD03', balance: 5 })
      await manager.insert(tableUser, { id: 'd0004', nickname: 'DD04', balance: 6 })
      await manager.insert(tableUser, { id: 'd0005', nickname: 'DD05', balance: 7 })
      await manager.insert(tableUser, { id: 'd0006', nickname: 'DD06', balance: 9 })
      // 删除余额在 5 到 7 之间的
      await manager.deleteMany({
        table: tableUser,
        criteria: c => c.like('nickname', 'DD%').between('balance', 5, 7)
      })
      ok(!(await manager.existsById(tableUser, 'd0003')))
      ok(!(await manager.existsById(tableUser, 'd0004')))
      ok(!(await manager.existsById(tableUser, 'd0005')))
      ok(await manager.existsById(tableUser, 'd0002'))
      ok(await manager.existsById(tableUser, 'd0006'))

      // limit 测试
      const rows = await manager.deleteMany({
        table: tableUser,
        criteria: c => c.in('id', ['d0002', 'd0006']),
        limit: 1
      })
      equal(rows, 1)
      // 只会删除第一条
      ok(!(await manager.existsById(tableUser, 'd0002')))
      ok(await manager.existsById(tableUser, 'd0006'))

      // deleteBy 不允许空条件，删除所有记录
      try {
        await manager.deleteMany({ table: tableUser, criteria: {} })
        fail('无条件删除记录被执行了')
      } catch (e) {
        ok(e instanceof MysqlException)
        equal(e.message, 'No valid criteria specified.')
      }
    })
  )
  it(
    'findAll 测试',
    runTestAsync(async () => {
      const manager = getMysqlManager()
      const list = await manager.findAll(tableUser)
      ok(list.length)
      const list2 = await manager.findAll(tableBook)
      ok(list2.length === 0)
    })
  )
  it(
    'findFirst 测试',
    runTestAsync(async () => {
      const manager = getMysqlManager()
      // 预置几个用于查询的数据
      await manager.insert(tableUser, { id: 'ff001', nickname: 'ff001', balance: 78 })
      await manager.insert(tableUser, { id: 'ff002', nickname: 'ff002', balance: 76 })
      await manager.insert(tableUser, { id: 'ff003', nickname: 'ff003', balance: 77 })
      const user = await manager.findFirst(tableUser, c =>
        c.like('nickname', 'ff0%').gt('balance', 75).lt('balance', 77)
      )
      ok(user)
      equal(user.id, 'ff002')
      equal(user.nickname, 'ff002')
      equal(user.balance, 76)

      const user2 = await manager.findFirst(tableUser, { nickname: 'ff003' })
      ok(user2)
      equal(user2.id, 'ff003')
      equal(user2.balance, 77)
    })
  )
  it(
    'insert 测试',
    runTestAsync(async () => {
      const manager = getMysqlManager()
      let userInserted = await manager.insert(tableUser, {
        id: 'in001',
        nickname: '小明',
        balance: 1
      })
      ok(userInserted.create_at)
      ok(userInserted.update_at)
      equal(userInserted.id, 'in001')
      equal(userInserted.nickname, '小明')
      equal(userInserted.balance, 1)
      // 这里需要注意，返回的数据是程序处理过的，并不是数据库返回的
      // 数据库返回的记录和列使用的类型有关，比如列是 datetime 类型，那么是没有毫秒的
      // 这里为了测试方便， user 表使用的是 datetime(3)
      let { create_at, update_at } = userInserted

      let user = await manager.findById(tableUser, 'in001')
      ok(user)
      equal(user.id, 'in001')
      equal(user.nickname, '小明')
      equal(user.balance, 1)
      // 创建和更新时间被自动维护，有值
      ok(user.create_at)
      ok(user.update_at)
      equal(create_at.getTime(), user.create_at.getTime())
      equal(update_at.getTime(), user.update_at.getTime())

      // book 自动生成 id
      let bookInserted = await manager.insert(tableBook, { name: '秘籍' })
      ok(bookInserted.create_at)
      ok(bookInserted.update_at)
      ok(typeof bookInserted.create_at === 'number')
      ok(typeof bookInserted.update_at === 'number')
      equal(bookInserted.name, '秘籍')
      ok(bookInserted.id)
      let { id } = bookInserted
      ok(typeof id === 'number')
      const book = await manager.findById(tableBook, id)
      ok(book)
      equal(book.id, id)
      equal(book.name, '秘籍')
      ok(book.create_at)
      ok(book.update_at)
      ok(typeof book.create_at === 'number')
      ok(typeof book.update_at === 'number')
    })
  )
  it(
    'insertMany 测试',
    runTestAsync(async () => {
      const manager = getMysqlManager()
      await manager.insertMany(tableUser, [
        { id: 'im001', nickname: '张飞', balance: 0 },
        { id: 'im002', nickname: '关羽', balance: 2 },
        { id: 'im003', nickname: '刘备', balance: 5 }
      ])

      const u1 = await manager.findById(tableUser, 'im002')
      ok(u1)
      equal(u1.id, 'im002')
      equal(u1.nickname, '关羽')
      const u2 = await manager.findById(tableUser, 'im001')
      ok(u2)
      equal(u2.id, 'im001')
      equal(u2.nickname, '张飞')
      const u3 = await manager.findById(tableUser, 'im003')
      ok(u3)
      equal(u3.id, 'im003')
      equal(u3.nickname, '刘备')

      // 测试自动生成主键
      await manager.insertMany(tableBook, [
        { name: '三字经' },
        { name: '百家姓' },
        { name: '千字文' },
        { name: '增广贤文' }
      ])

      const b1 = await manager.findFirst(tableBook, { name: '三字经' })
      ok(b1)
      ok(b1.id)
      ok(typeof b1.id === 'number')

      const b2 = await manager.findFirst(tableBook, { name: '百家姓' })
      ok(b2)
      ok(b2.id)
      ok(typeof b2.id === 'number')

      const b3 = await manager.findFirst(tableBook, { name: '千字文' })
      ok(b3)
      ok(b3.id)
      ok(typeof b3.id === 'number')

      const b4 = await manager.findFirst(tableBook, { name: '增广贤文' })
      ok(b4)
      ok(b4.id)
      ok(typeof b4.id === 'number')

      console.log('插入的id', [b1.id, b2.id, b3.id, b4.id])
    })
  )
  it(
    'update 测试',
    runTestAsync(async () => {
      const manager = getMysqlManager()
      await manager.insert(tableUser, { id: 'up001', nickname: '张三', balance: 566 })
      let user = await manager.findById(tableUser, 'up001')
      ok(user)
      equal(user.nickname, '张三')
      equal(user.balance, 566)
      ok(user.create_at)
      ok(user.update_at)
      const { create_at, update_at } = user

      await sleep(100)
      user.nickname = '李四'
      user.balance = 78
      const userUpdated = await manager.update(tableUser, user)
      equal(userUpdated.create_at, create_at)
      ok(userUpdated.update_at)
      ok(userUpdated.update_at > update_at)
      equal(userUpdated.nickname, '李四')
      equal(userUpdated.balance, 78)

      user = await manager.findById(tableUser, 'up001')
      ok(user)
      ok(user.create_at)
      equal(user.create_at.getTime(), create_at.getTime())
      ok(user.update_at)
      ok(user.update_at > update_at)
      equal(user.update_at.getTime(), userUpdated.update_at.getTime())
      equal(user.nickname, '李四')
      equal(user.balance, 78)

      // 更新不存在的记录会报错
      try {
        await manager.update(tableUser, { id: 'xxxxxxx', nickname: '王五', balance: 44 })
        fail('更新不存在的记录没有报错')
      } catch (e) {
        ok(e instanceof MysqlException)
        console.log(e.message)
      }
    })
  )
  it(
    'updateMany 测试',
    runTestAsync(async () => {
      const manager = getMysqlManager()
      await Promise.all([
        manager.insert(tableUser, { id: 'um001', nickname: 'um001', balance: 23 }),
        manager.insert(tableUser, { id: 'um002', nickname: 'um002', balance: 24 }),
        manager.insert(tableUser, { id: 'um003', nickname: 'um003', balance: 34 }),
        manager.insert(tableUser, { id: 'um004', nickname: 'um004', balance: 18 })
      ])

      let u1 = await manager.findById(tableUser, 'um001')
      ok(u1)
      ok(u1.create_at)
      ok(u1.update_at)
      // 记录时间，后面验证更新时间也有更新
      const createAt1 = u1.create_at
      const updateAt1 = u1.update_at

      let u2 = await manager.findById(tableUser, 'um002')
      ok(u2)
      ok(u2.create_at)
      ok(u2.update_at)
      const createAt2 = u2.create_at
      const updateAt2 = u2.update_at

      await sleep(100)
      const ct = await manager.updateMany({
        table: tableUser,
        query: c => c.like('nickname', 'um%').between('balance', 23, 24),
        updater: { balance: ['inc', 2] }
      })
      // 共更新成功两条
      equal(ct, 2)

      u1 = await manager.findById(tableUser, 'um001')
      ok(u1)
      equal(u1.nickname, 'um001')
      equal(u1.balance, 25)
      ok(u1.create_at)
      ok(u1.update_at)
      equal(u1.create_at.getTime(), createAt1.getTime())
      ok(u1.update_at > updateAt1)

      u2 = await manager.findById(tableUser, 'um002')
      ok(u2)
      equal(u2.nickname, 'um002')
      equal(u2.balance, 26)
      ok(u2.create_at)
      ok(u2.update_at)
      equal(u2.create_at.getTime(), createAt2.getTime())
      ok(u2.update_at > updateAt2)

      let u3 = await manager.findById(tableUser, 'um003')
      ok(u3)
      equal(u3.nickname, 'um003')
      equal(u3.balance, 34)

      let u4 = await manager.findById(tableUser, 'um004')
      ok(u4)
      equal(u4.nickname, 'um004')
      equal(u4.balance, 18)

      // orderBy 加 limit
      const ct2 = await manager.updateMany({
        table: tableUser,
        query: c => c.gte('id', 'um001').lte('id', 'um004'),
        updater: { balance: 0 },
        orderBy: [['id', 'desc']],
        limit: 2
      })
      equal(ct2, 2)
      // 应当只有 um004 和 um003 更新成功，因为是从　um004 到 um001 倒序，且只更新2条
      u1 = await manager.findById(tableUser, 'um001')
      ok(u1)
      equal(u1.balance, 25)
      u2 = await manager.findById(tableUser, 'um002')
      ok(u2)
      equal(u2.balance, 26)
      u3 = await manager.findById(tableUser, 'um003')
      ok(u3)
      equal(u3.balance, 0)
      u4 = await manager.findById(tableUser, 'um004')
      ok(u4)
      equal(u4.balance, 0)
    })
  )
  it(
    'partialUpdate 测试',
    runTestAsync(async () => {
      const manager = getMysqlManager()
      await manager.insert(tableUser, { id: 'pu000', nickname: '管佑', balance: 33 })
      let user = await manager.findById(tableUser, 'pu000')
      ok(user)
      ok(user.create_at)
      ok(user.update_at)
      const { create_at, update_at } = user

      await sleep(100)
      let res = await manager.partialUpdate(tableUser, { id: 'pu000', nickname: '石秦' })
      ok(res)
      user = await manager.findById(tableUser, 'pu000')
      ok(user)
      equal(user.nickname, '石秦')
      equal(user.balance, 33)
      ok(user.create_at)
      ok(user.update_at)
      equal(user.create_at.getTime(), create_at.getTime())
      ok(user.update_at > update_at)
      const updateAt2 = user.update_at

      res = await manager.partialUpdate(tableUser, { id: 'pu000', balance: ['inc', 22] })
      ok(res)
      user = await manager.findById(tableUser, 'pu000')
      ok(user)
      equal(user.nickname, '石秦')
      equal(user.balance, 55)
      ok(user.create_at)
      ok(user.update_at)
      equal(user.create_at.getTime(), create_at.getTime())
      ok(user.update_at > updateAt2)

      // 更新不存在的记录
      res = await manager.partialUpdate(tableUser, { id: 'pu-xxxx', balance: ['inc', 1] })
      ok(!res)
    })
  )
  it(
    'updateOne 测试',
    runTestAsync(async () => {
      const manager = getMysqlManager()
      await manager.insert(tableUser, { id: 'uo000', nickname: '占元', balance: 22 })
      await manager.insert(tableUser, { id: 'uo001', nickname: '占元', balance: 33 })
      const res = await manager.updateOne(tableUser, { nickname: '占元' }, { nickname: '至长' })
      ok(res)
      const u1 = await manager.findById(tableUser, 'uo000')
      const u2 = await manager.findById(tableUser, 'uo001')
      ok(u1)
      ok(u2)
      // 只能有一个被更新
      if (u1.nickname === '占元') {
        equal(u2.nickname, '至长')
      } else if (u2.nickname === '占元') {
        equal(u1.nickname, '至长')
      } else {
        fail('updateOne 失败')
      }

      const res2 = await manager.updateOne(
        tableUser,
        { nickname: '艾尼路', balance: 999 },
        { nickname: '云飞' }
      )
      ok(!res2)
    })
  )
  it(
    'find 测试',
    runTestAsync(async () => {
      const manager = getMysqlManager()
      Promise.all([
        manager.insert(tableUser, { id: 'find1', nickname: 'f1', balance: 788 }),
        manager.insert(tableUser, { id: 'find2', nickname: 'f2', balance: 790 }),
        manager.insert(tableUser, { id: 'find3', nickname: 'f3', balance: 777 }),
        manager.insert(tableUser, { id: 'find4', nickname: 'f4', balance: 793 })
      ])

      // balance 顺序： 777 788 790 793 ，offset 1 跳过第一个
      let list = await manager.find({
        table: tableUser,
        criteria: c => c.between('balance', 700, 800).like('id', 'find%'),
        offset: 1,
        limit: 10,
        orderBy: [['balance', 'asc']]
      })
      equal(list.length, 3)

      // u1 788
      // u2 790
      // u3 793
      const [u1, u2, u3] = list
      equal(u1.id, 'find1')
      equal(u1.balance, 788)

      equal(u2.id, 'find2')
      equal(u2.balance, 790)

      equal(u3.id, 'find4')
      equal(u3.balance, 793)

      list = await manager.find({
        table: tableUser,
        criteria: c => c.between('balance', 700, 800),
        offset: 1,
        limit: 2,
        orderBy: [['balance', 'asc']]
      })
      equal(list.length, 2)

      // in 条件和 notIn 条件测试
      list = await manager.find({
        table: tableUser,
        criteria: c =>
          c.in('id', ['find1', 'find2', 'find3', 'find4']).notIn('id', ['find2', 'find4']),
        offset: 0,
        limit: 10,
        orderBy: [['id', 'asc']]
      })
      equal(list.length, 2)
      const [uu1, uu2] = list
      equal(uu1.id, 'find1')
      equal(uu2.id, 'find3')
    })
  )
  it(
    'count 测试',
    runTestAsync(async () => {
      const manager = getMysqlManager()
      await Promise.all([
        manager.insert(tableUser, { id: 'c001', nickname: '李志', balance: 233 }),
        manager.insert(tableUser, { id: 'c002', nickname: '李响', balance: 234 }),
        manager.insert(tableUser, { id: 'c003', nickname: '李幸', balance: 235 }),
        manager.insert(tableUser, { id: 'c004', nickname: '李辽', balance: 236 })
      ])

      const count = await manager.count(tableUser, c =>
        c.like('id', 'c00%').like('nickname', '李%')
      )
      equal(count, 4)
    })
  )
  it(
    'paginate 测试',
    runTestAsync(async () => {
      const manager = getMysqlManager()
      await Promise.all([
        manager.insert(tableUser, { id: 'pg001', nickname: '张伟', balance: 122 }),
        manager.insert(tableUser, { id: 'pg002', nickname: '王伟', balance: 111 }),
        manager.insert(tableUser, { id: 'pg003', nickname: '张静', balance: 105 }),
        manager.insert(tableUser, { id: 'pg004', nickname: '刘洋', balance: 132 }),
        manager.insert(tableUser, { id: 'pg005', nickname: '王勇', balance: 104 }),
        manager.insert(tableUser, { id: 'pg006', nickname: '张杰', balance: 102 }),
        manager.insert(tableUser, { id: 'pg007', nickname: '张涛', balance: 119 }),
        manager.insert(tableUser, { id: 'pg008', nickname: '刘杰', balance: 188 }),
        manager.insert(tableUser, { id: 'pg009', nickname: '王秀兰', balance: 105 }),
        manager.insert(tableUser, { id: 'pg010', nickname: '张强', balance: 105 }),
        manager.insert(tableUser, { id: 'pg011', nickname: '王桂英', balance: 89 }),
        manager.insert(tableUser, { id: 'pg012', nickname: '李燕', balance: 134 }),
        manager.insert(tableUser, { id: 'pg013', nickname: '王鑫', balance: 113 }),
        manager.insert(tableUser, { id: 'pg014', nickname: '王刚', balance: 101 })
      ])

      const page = await manager.paginate({
        table: tableUser,
        criteria: c => c.like('id', 'pg0%'),
        pn: 2,
        pz: 5,
        orderBy: [
          ['balance', 'asc'],
          ['id', 'asc']
        ]
      })

      // balance 排序：
      // 89,101,102,104,105,105,105,111,113,119,122,132,134,188
      // 105 重复的记录，再按 id 排序：pg003,pg009,pg010
      // 第二页应该是：105(pg009),105(pg010),111,113,119

      equal(page.total, 14)
      equal(page.list.length, 5)

      const [u1, u2, u3, u4, u5] = page.list
      equal(u1.balance, 105)
      equal(u2.balance, 105)
      equal(u3.balance, 111)
      equal(u4.balance, 113)
      equal(u5.balance, 119)

      equal(u1.id, 'pg009')
      equal(u2.id, 'pg010')
    })
  )
  it(
    'query 测试',
    runTestAsync(async () => {
      const manager = getMysqlManager()
      await Promise.all([
        manager.insert(tableUser, { id: 'qu001', nickname: '空头文学家', balance: 0 }),
        manager.insert(tableBook, { name: '求解之谜', author_id: 'qu001' })
      ])
      // 自定义查询
      interface QueryResult {
        author: string
        book: string
      }
      const list = await manager.query<QueryResult>(
        'select u.nickname as author,b.name as book ' +
          ' from ?? u left join ?? b on u.id=b.author_id ' +
          ' where b.id is not null',
        ['user', 'book']
      )
      equal(list.length, 1)
      ok(list[0].author)
      ok(list[0].book)
      equal(list[0].author, '空头文学家')
      equal(list[0].book, '求解之谜')
    })
  )
  it(
    'modify 测试',
    runTestAsync(async () => {
      const manager = getMysqlManager()
      await Promise.all([
        manager.insert(tableUser, { id: 'mo001', nickname: '佚名', balance: 0 }),
        manager.insert(tableUser, { id: 'mo002', nickname: '佚名', balance: 1 })
      ])
      const res = await manager.modify(`update user set nickname='无名' where nickname='佚名'`)
      equal(res, 2)
    })
  )
  it(
    '事务测试',
    runTestAsync(async () => {
      const manager = getMysqlManager()
      // 在只读事务中执行写操作
      try {
        await manager.tx(
          async session => {
            await session.partialUpdate(tableUser, { id: 'tx0099', nickname: '舜' })
          },
          { accessMode: 'READ ONLY', isolationLevel: 'READ COMMITTED' }
        )
        fail('在只读事务中执行写操作应当发生异常，但是并没有')
      } catch (e) {
        ok(e instanceof Error)
        equal(e.message, 'Cannot execute statement in a READ ONLY transaction.')
      }

      await manager.insert(tableUser, { id: 'tx001', nickname: '禹', balance: 33 })
      try {
        await manager.tx(
          async session => {
            await session.insert(tableUser, { id: 'tx002', nickname: '契', balance: 20 })
            await session.partialUpdate(tableUser, { id: 'tx001', balance: ['inc', 10] })
            // id 重复导致插入失败
            await session.insert(tableUser, { id: 'tx002', nickname: '汤', balance: 20 })
          },
          { isolationLevel: 'READ COMMITTED' }
        )
        fail('事务应该失败，抛出异常，但是并没有')
      } catch (e) {
        ok(e instanceof Error)
        console.log(e.message)
      }
      // 验证数据没有操作成功
      ok(!(await manager.existsById(tableUser, 'tx002')))
      const u1 = await manager.findById(tableUser, 'tx001')
      ok(u1)
      equal(u1.balance, 33)

      // 成功操作测试
      const txRes = await manager.tx(
        async session => {
          await session.insert(tableUser, { id: 'tx003', nickname: '孔丘', balance: 0 })
          await session.insert(tableBook, { name: '春秋', author_id: 'tx003' })
          return 7788
        },
        // 像这种纯插入记录的，可以将级别设置为最低
        { isolationLevel: 'READ UNCOMMITTED' }
      )

      equal(txRes, 7788)
      const u2 = await manager.findById(tableUser, 'tx003')
      ok(u2)
      equal(u2.nickname, '孔丘')
      const book = await manager.findFirst(tableBook, { author_id: 'tx003' })
      ok(book)
      equal(book.name, '春秋')

      // 测试超时
      await assertAsyncThrows({
        run: () =>
          manager.tx(async session => {
            console.log('开始执行')
            await session.insert(tableBook, { name: '无字书' })
            console.log('开始等待')
            await new Promise<void>((resolve, reject) => {
              setTimeout(() => {
                resolve()
              }, 3000)
            })
            console.log('等待后继续写入')
            try {
              await session.insert(tableBook, { name: '大学' })
            } catch (e) {
              console.log('超时后的写入发生异常', e)
            }
          }),
        assert(err) {
          ok(err instanceof MysqlException)
          equal(err.message, 'Transaction timeout !')
        }
      })
      // 实际上即使是超时了，只是超时的定时器先结束而已
      // 原 tx 中的操作逻辑还会继续的，等待足够的时间，观察原 tx 中的操作是否会失败
      // 一个连接上的事务回滚后，这个连接还可以继续使用的，超时虽然把事务回滚了
      // 但是原流程中继续使用 session 的方法就是在利用回滚后的连接，再继续后面的流程就是没有事务的
      // 所以 session 中必须要处理好，在超时的情况下强制不能再使用
      await sleep(2000)
      let b2 = await manager.findFirst(tableBook, { name: '无字书' })
      ok(!b2)
      let b3 = await manager.findFirst(tableBook, { name: '大学' })
      ok(!b3)
      // 测试严格模式
      await assertAsyncThrows({
        run: () =>
          manager.tx(async session => {
            await session.insert(tableBook, { name: '无字书' })
            session.findAll(tableBook)
          }),
        assert(err) {
          ok(err instanceof MysqlException)
          equal(err.message, 'Prohibited to use findAll in a strict transaction.')
        }
      })
      b2 = await manager.findFirst(tableBook, { name: '无字书' })
      ok(!b2)
      await assertAsyncThrows({
        run: () =>
          manager.tx(async session => {
            await session.insert(tableBook, { name: '无字书' })
            session.deleteMany({ table: tableBook, criteria: { name: '春秋' } })
          }),
        assert(err) {
          ok(err instanceof MysqlException)
          equal(err.message, 'Prohibited to use deleteBy in a strict transaction.')
        }
      })
      b2 = await manager.findFirst(tableBook, { name: '无字书' })
      ok(!b2)
      await assertAsyncThrows({
        run: () =>
          manager.tx(async session => {
            await session.insert(tableBook, { name: '无字书' })
            session.insertMany(tableBook, [{ name: '三字经' }, { name: '千字文' }])
          }),
        assert(err) {
          ok(err instanceof MysqlException)
          equal(err.message, 'Prohibited to use insertMany in a strict transaction.')
        }
      })
      b2 = await manager.findFirst(tableBook, { name: '无字书' })
      ok(!b2)
      // 严格模式，操作过多出现异常
      await assertAsyncThrows({
        run: () =>
          manager.tx(async session => {
            await session.insert(tableBook, { name: '楚辞' })
            await session.insert(tableBook, { name: '公孙龙子' })
            await session.insert(tableBook, { name: '公羊传' })
            await session.insert(tableBook, { name: '关尹子' })
            await session.insert(tableBook, { name: '孔子家语' })
            await session.insert(tableBook, { name: '列子' })
            await session.insert(tableBook, { name: '六韬' })
            await session.insert(tableBook, { name: '晏子春秋' })
            await session.insert(tableBook, { name: '战国策' })
            // 查询，更新等任何操作都算在内，不能超过10个
            const b = await session.findFirst(tableBook, { name: '战国策' })
            if (b) {
              await session.partialUpdate(tableBook, { id: b.id, name: '左传' })
            }
          }),
        assert(err) {
          ok(err instanceof MysqlException)
          equal(err.message, 'Too many operations in a strict transaction.')
        }
      })
      ok(!(await manager.existsBy(tableBook, { name: '公羊传' })))
      ok(!(await manager.existsBy(tableBook, { name: '晏子春秋' })))
      ok(!(await manager.existsBy(tableBook, { name: '战国策' })))
      ok(!(await manager.existsBy(tableBook, { name: '左传' })))
    })
  )
  it(
    'json类型测试',
    runTestAsync(async () => {
      // 插入几条测试数据
      const mananger = getMysqlManager()
      // 以不同的方式插入，分别测试 insert 和  insertMany 是否能支持
      await mananger.insertMany(tableQuestion, [
        {
          id: '001',
          title: '以下哪些国家是欧洲的',
          options: [
            { title: '英国', correct: true },
            { title: '阿尔及利亚' },
            { title: '塞尔维亚', correct: true },
            { title: '波兰', correct: true }
          ],
          question_setter: { id: 'x000', name: '王老师' }
        },
        {
          id: '002',
          title: '下面哪个是恒星',
          options: [
            { title: '地球' },
            { title: '火星' },
            { title: '太阳', correct: true },
            { title: '月亮' }
          ],
          question_setter: { id: 'x333', name: '小李老师' }
        }
      ])
      await mananger.insert(tableQuestion, {
        id: '003',
        title: '下面哪个类型是 Mysql 不支持的',
        options: [
          { title: 'TINYINT' },
          { title: 'BOOLEAN', correct: true },
          { title: 'CHAR' },
          { title: 'TEXT' }
        ],
        question_setter: { id: 'x333', name: '小李老师' }
      })

      // 查询验证
      const q1 = await mananger.findById(tableQuestion, '001')
      ok(q1)
      equal('以下哪些国家是欧洲的', q1.title)
      equal(4, q1.options.length)
      equal('阿尔及利亚', q1.options[1].title)
      equal('王老师', q1.question_setter.name)

      // 使用 json 查询来验证
      const q2 = await mananger.findFirst(tableQuestion, c =>
        c
          .eq(['json_extract', 'question_setter', '$.id'], 'x333')
          .eq(['json_extract', 'options', '$[0].title'], '地球')
      )
      ok(q2)
      equal('002', q2.id)
      equal('下面哪个是恒星', q2.title)
      equal('小李老师', q2.question_setter.name)
      equal(true, q2.options[2].correct)
      equal('月亮', q2.options[3].title)
      // 用选项数组中的元素来查询
      const q3 = await mananger.findFirst(tableQuestion, c =>
        c.eq(['json_extract', 'options', '$[0].title'], '地球')
      )
      ok(q3)
      equal(q2.id, q3.id)

      // 修改
      await mananger.partialUpdate(tableQuestion, {
        id: '001',
        question_setter: { id: 'x003', name: '于老师' }
      })
      const q4 = await mananger.findById(tableQuestion, '001')
      ok(q4)
      ok(q4.question_setter)
      equal('x003', q4.question_setter.id)
      equal('于老师', q4.question_setter.name)

      q1.options.push({ title: '阿根廷' })
      await mananger.update(tableQuestion, q1)
      const q5 = await mananger.findById(tableQuestion, '001')
      ok(q5)
      equal(5, q5.options.length)
      equal('阿根廷', q5.options[4].title)

      // 查询选项达到5个的试题，验证 json_length
      const q6 = await mananger.findFirst(tableQuestion, c => c.gte(['json_length', 'options'], 5))
      ok(q6)
      equal(5, q6.options.length)
      equal('英国', q6.options[0].title)
      equal('阿根廷', q6.options[4].title)

      await mananger.updateMany({
        table: tableQuestion,
        query: c => c.eq(['json_extract', 'question_setter', '$.id'], 'x333'),
        updater: {
          // 暂时没有支持 json_set 这类函数来设置字段，只能传入整个内容
          // 这些操作是比较低频的，以后的版本再考虑吧
          question_setter: { id: 'x333', name: '李帅' }
        }
      })
      const list1 = await mananger.find({
        table: tableQuestion,
        criteria: c => c.eq(['json_extract', 'question_setter', '$.id'], 'x333'),
        orderBy: [['id', 'asc']]
      })
      equal(2, list1.length)
      equal('002', list1[0].id)
      equal('003', list1[1].id)
      equal('李帅', list1[0].question_setter.name)
      equal('李帅', list1[1].question_setter.name)
    })
  )
})
