import { deepStrictEqual, equal, fail, ok } from 'assert'
import { Db, ObjectId } from 'mongodb'
import { MongoDBException, enableMongoDB, getMongoDBManager } from '../../src'
import { assertAsyncThrows, runTestAsync, sleep } from '../utils'
import { collUser } from './user'
import { versionList } from './version-list'
import { collDbVersion } from './db-version'

describe('mongodb 组件测试', () => {
  // 测试前激活组件，做版本管理预置
  before(
    runTestAsync(async () => {
      await enableMongoDB({
        migration: {
          versionList: versionList
        }
      })
    })
  )
  after(async () => {
    const mananger = getMongoDBManager()
    const db: Db = (mananger as any).db
    await db.dropCollection('user')
    await db.dropCollection('db_version')
  })
  it(
    '版本控制验证',
    runTestAsync(async () => {
      // 查询验证
      const mananger = getMongoDBManager()
      const jack = await mananger.findFirst(collUser, { nickname: 'jack' })
      const tom = await mananger.findFirst(collUser, { nickname: 'tom' })
      // 如果两版本都更新成功，那么两个用户都应该不为 null
      ok(jack)
      ok(jack._id)
      ok(jack._id instanceof ObjectId)
      ok(jack.skills)
      deepStrictEqual(jack.skills, ['java'])
      ok(jack.nickname)
      ok(jack.createAt)
      ok(jack.updateAt)
      ok(tom)
      ok(tom._id)
      ok(tom._id instanceof ObjectId)
      ok(tom.nickname)
      ok(tom.skills)
      deepStrictEqual(tom.skills, ['golang', 'rust'])
      ok(tom.createAt)
      ok(tom.updateAt)
      // 索引，版本一中创建了两个索引，版本二中将 idx_skills 删除
      const coll = mananger.getCollection(collUser)
      console.log('user indexes', await coll.indexes())
      ok(await coll.indexExists('uk_nickname'))
      ok(!(await coll.indexExists('idx_skills')))

      const dbVersion = await mananger.findFirst(collDbVersion, {})
      ok(dbVersion)
      equal(dbVersion.version, 1)
    })
  )
  it(
    'findById 测试',
    runTestAsync(async () => {
      const mananger = getMongoDBManager()
      // 先插入一条记录
      await mananger.insert(collUser, { _id: '007', nickname: 'Spark', skills: [] })
      const res1 = await mananger.findById(collUser, '007')
      ok(res1)
      equal(res1.nickname, 'Spark')
      equal(res1._id, '007')
      // 创建时间和更新时间会自动管理，应该会有值
      ok(res1.createAt)
      ok(res1.updateAt)
      const res2 = await mananger.findById(collUser, '008')
      ok(res2 === null)
      // 测试自动生成主键（objectId）的文档能不能正确查询
      const jack = await mananger.findFirst(collUser, { nickname: 'jack' })
      ok(jack)
      console.log('jack id is ', jack._id)
      const res3 = await mananger.findById(collUser, jack._id)
      ok(res3)
      equal(res3.nickname, 'jack')
      ok(jack._id instanceof ObjectId)
      ok(res3._id instanceof ObjectId)
      equal(jack._id.toHexString(), res3._id.toHexString())
    })
  )
  it(
    'findByIdIn 测试',
    runTestAsync(async () => {
      const mananger = getMongoDBManager()
      // 先插入测试数据
      await mananger.insert(collUser, { _id: '001', nickname: 'lucy', skills: ['js'] })
      await mananger.insert(collUser, { _id: '002', nickname: 'lily', skills: ['ts'] })
      const res = await mananger.findByIdIn(collUser, ['001', '002'])
      ok(res.length === 2)
      const [u1, u2] = res
      ok(u1)
      equal(u1._id, '001')
      equal(u1.nickname, 'lucy')
      ok(u2)
      equal(u2._id, '002')
      equal(u2.nickname, 'lily')

      // 查询不到记录应该返回空数组
      const res2 = await mananger.findByIdIn(collUser, ['0022', '0033'])
      ok(res2)
      ok(res2.length === 0)

      // 使用 objectID 一起查询
      const jack = await mananger.findFirst(collUser, { nickname: 'jack' })
      ok(jack)
      const res3 = await mananger.findByIdIn(collUser, ['001', '002', jack._id])
      ok(res3)
      equal(res3.length, 3)
      const u11 = res3[0]
      equal(u11._id, '001')
      equal(u11.nickname, 'lucy')
      const jack2 = res3[2]
      ok(jack2._id instanceof ObjectId)
      ok(jack._id instanceof ObjectId)
      equal(jack._id.toHexString(), jack2._id.toHexString())
      equal(jack2.nickname, 'jack')
    })
  )
  it(
    'existsById 测试',
    runTestAsync(async () => {
      const mananger = getMongoDBManager()
      const res = await mananger.existsById(collUser, 'xyz')
      ok(!res)
      await mananger.insert(collUser, { _id: '005', nickname: 'ann', skills: ['js'] })
      const res2 = await mananger.existsById(collUser, '005')
      ok(res2)
    })
  )
  it(
    'existsBy 测试',
    runTestAsync(async () => {
      const mananger = getMongoDBManager()
      const res = await mananger.existsBy(collUser, { nickname: 'acute' })
      ok(!res)
      await mananger.insert(collUser, { _id: '006', nickname: 'mose', skills: ['js', 'java'] })
      const res2 = await mananger.existsBy(collUser, { nickname: 'mose' })
      ok(res2)
      const res3 = await mananger.existsBy(collUser, {
        $or: [{ nickname: 'jjkk' }, { skills: { $in: ['js'] } }]
      })
      ok(res3)
    })
  )
  it(
    'deleteById 测试',
    runTestAsync(async () => {
      const mananger = getMongoDBManager()
      await mananger.insert(collUser, { _id: '011', nickname: 'modi', skills: ['java'] })
      const res1 = mananger.existsById(collUser, '011')
      ok(res1)
      // 删除
      await mananger.deleteById(collUser, '011')
      // 现在应该查不到了
      const res2 = await mananger.existsById(collUser, '011')
      ok(!res2)
    })
  )
  it(
    'deleteOne 测试',
    runTestAsync(async () => {
      const mananger = getMongoDBManager()
      await mananger.insert(collUser, { _id: 'do001', nickname: 'DO001', age: 39 })
      await mananger.insert(collUser, { _id: 'do002', nickname: 'DO002', age: 44 })
      ok(await mananger.existsById(collUser, 'do001'))
      ok(await mananger.existsById(collUser, 'do002'))

      const res = await mananger.deleteOne(collUser, { nickname: 'DO001', age: 39 })
      ok(res)
      ok(!(await mananger.existsById(collUser, 'do001')))
      ok(await mananger.existsById(collUser, 'do002'))

      const res2 = await mananger.deleteOne(collUser, { nickname: 'DO002', age: 44 })
      ok(res2)
      ok(!(await mananger.existsById(collUser, 'do002')))

      // 修改不存在的记录
      const res3 = await mananger.deleteOne(collUser, { nickname: 'DO002', age: 88 })
      ok(!res3)
    })
  )
  it(
    'deleteMany 测试',
    runTestAsync(async () => {
      const mananger = getMongoDBManager()
      await mananger.insert(collUser, { _id: '012', nickname: 'smith', skills: ['java'] })
      const res1 = mananger.existsById(collUser, '012')
      ok(res1)
      // 按昵称删除
      const res = await mananger.deleteMany(collUser, { nickname: 'smith' })
      equal(res, 1)
      // 现在应该查不到了
      const res2 = await mananger.existsById(collUser, '012')
      ok(!res2)
    })
  )
  it(
    'findAll 测试',
    runTestAsync(async () => {
      const mananger = getMongoDBManager()
      // 由于有测试数据和版本预置的数据，一定是可以查询到记录的
      const res = await mananger.findAll(collUser)
      ok(res)
      ok(res.length)
    })
  )
  it(
    'findFirst 测试',
    runTestAsync(async () => {
      const mananger = getMongoDBManager()
      // 查询预置的 jack 用户
      const res = await mananger.findFirst(collUser, { nickname: 'jack' })
      ok(res)
      // 查询不存在的记录
      const res2 = await mananger.findFirst(collUser, { nickname: 'abcd' })
      ok(!res2)
    })
  )
  it(
    'insert 测试',
    runTestAsync(async () => {
      const mananger = getMongoDBManager()
      await mananger.insert(collUser, { _id: '013', nickname: 'Franklin', skills: [] })
      ok(await mananger.existsById(collUser, '013'))
      // 再次插入 昵称相同的记录索引不允许，会报错
      try {
        await mananger.insert(collUser, { _id: '014', nickname: 'Franklin', skills: [] })
        fail('又一个 nickname 为 Franklin 的记录被插入成功了，唯一索引没有生效')
      } catch (e) {
        console.log((e as Error).message)
      }

      // 测试不填id插入，自动生成 ObjectId
      const res = await mananger.insert(collUser, { nickname: 'daken', skills: [] })
      ok(res.createAt)
      ok(res.updateAt)
      // 使用 ObjectId 查询
      const res2 = await mananger.findById(collUser, res._id)
      ok(res2)
      ok(res2.createAt)
      ok(res2.updateAt)
      equal(res2.createAt.getTime(), res.createAt.getTime())
      equal(res2.updateAt.getTime(), res.updateAt.getTime())
      equal(res2.nickname, 'daken')
    })
  )
  it(
    'insertMany 测试',
    runTestAsync(async () => {
      const mananger = getMongoDBManager()
      const list = await mananger.insertMany(collUser, [
        { _id: 'im001', nickname: 'Ford' },
        { nickname: 'Hank' },
        { _id: 'im003', nickname: 'Ivan' }
      ])
      equal(list.length, 3)
      // 第二条记录应当会自动生成 ObjectId
      ok(list[1]._id)
      ok(list[1]._id instanceof ObjectId)

      // 查询验证
      const u2 = await mananger.findById(collUser, list[1]._id)
      ok(u2)
      equal(u2.nickname, 'Hank')
      ok(u2.createAt)
      ok(u2.updateAt)

      const u1 = await mananger.findById(collUser, 'im001')
      ok(u1)
      equal(u1.nickname, 'Ford')
      ok(u1.createAt)
      ok(u1.updateAt)

      const u3 = await mananger.findById(collUser, 'im003')
      ok(u3)
      equal(u3.nickname, 'Ivan')
      ok(u3.createAt)
      ok(u3.updateAt)
    })
  )
  it(
    'update 测试',
    runTestAsync(async () => {
      const mananger = getMongoDBManager()
      await mananger.insert(collUser, { _id: '014', nickname: 'jobs', skills: [] })
      let user = await mananger.findById(collUser, '014')
      ok(user)
      ok(user.createAt)
      ok(user.updateAt)
      const { createAt, updateAt } = user
      await sleep(100)
      // 更新记录
      user.nickname = 'qixi'
      const updatedUser = await mananger.update(collUser, user)
      ok(updatedUser.createAt)
      ok(updatedUser.updateAt)
      user = await mananger.findById(collUser, '014')
      ok(user)
      equal(user.nickname, 'qixi')
      // 验证更新时间也更新了，但是创建时间不会变化
      equal(user.createAt?.getTime(), createAt.getTime())
      ok(user.updateAt && user.updateAt > updateAt)
      // 对 update 方法返回的数据进行验证，应该是和新查询出来的记录一致
      equal(updatedUser.createAt?.getTime(), user.createAt?.getTime())
      equal(updatedUser.updateAt?.getTime(), user.updateAt.getTime())
      equal(updatedUser.nickname, user.nickname)

      // id 不存在的情况
      try {
        await mananger.update(collUser, { _id: 'nonexistent', nickname: 'Jack', skills: [] })
        fail('id 不正确调用 update 更新记录应当报错，但是并没有')
      } catch (error) {
        ok(error instanceof MongoDBException)
        equal(
          error.message,
          `Failed to update record, possibly due to non-existent record，collection：${collUser.collectionName}，id：nonexistent`
        )
      }
    })
  )
  it(
    'partialUpdate 测试',
    runTestAsync(async () => {
      const mananger = getMongoDBManager()
      // 插入测试数据
      await mananger.insert(collUser, { _id: 'pu001', nickname: 'barret', skills: [] })
      let user = await mananger.findById(collUser, 'pu001')
      ok(user)
      equal(user.nickname, 'barret')
      ok(user.createAt)
      ok(user.updateAt)
      const { createAt, updateAt } = user
      await sleep(100)
      // 更新
      let res = await mananger.partialUpdate(collUser, 'pu001', { $set: { nickname: 'barn' } })
      ok(res)
      user = await mananger.findById(collUser, 'pu001')
      ok(user)
      // 昵称已经被修改
      equal(user.nickname, 'barn')
      // 更新时间也应该有变化
      equal(user.createAt?.getTime(), createAt.getTime())
      ok(user.updateAt && user.updateAt > updateAt)

      // 添加新的技能
      res = await mananger.partialUpdate(collUser, 'pu001', { $push: { skills: 'Java' } })
      ok(res)
      user = await mananger.findById(collUser, 'pu001')
      ok(user)
      // 技能已经修改
      deepStrictEqual(user.skills, ['Java'])
      // 昵称则不会受影响
      equal(user.nickname, 'barn')
      // 更新时间也应该有变化
      equal(user.createAt?.getTime(), createAt.getTime())
      ok(user.updateAt && user.updateAt > updateAt)

      // 修改不存在的记录，最终返回的结果是失败
      res = await mananger.partialUpdate(collUser, 'non existent', { $set: { nickname: 'Jack' } })
      ok(!res)
    })
  )
  it(
    'updateOne 测试',
    runTestAsync(async () => {
      const mananger = getMongoDBManager()
      await mananger.insert(collUser, { _id: 'uo001', nickname: 'UO1', skills: ['Perl'], age: 35 })
      await mananger.insert(collUser, { _id: 'uo002', nickname: 'UO2', skills: ['Perl'], age: 35 })

      const res = await mananger.updateOne(
        collUser,
        { skills: ['Perl'], age: 35 },
        { $set: { age: 33 } }
      )
      ok(res)

      const u1 = await mananger.findById(collUser, 'uo001')
      const u2 = await mananger.findById(collUser, 'uo002')
      ok(u1)
      ok(u2)
      // 只有一个被修改成功
      if (u1.age === 35) {
        deepStrictEqual(u2.age, 33)
      } else if (u2.age === 35) {
        deepStrictEqual(u1.age, 33)
      } else {
        fail('updateOne 失败，未修改成功数据')
      }

      const res2 = await mananger.updateOne(
        collUser,
        { nickname: 'UO1', age: 333 },
        { $set: { nickname: 'Abc' } }
      )
      ok(!res2)
    })
  )
  it(
    'updateMany 测试',
    runTestAsync(async () => {
      const mananger = getMongoDBManager()
      await Promise.all([
        mananger.insert(collUser, { _id: 'um001', nickname: 'Abernathy', age: 18 }),
        mananger.insert(collUser, { _id: 'um002', nickname: 'Cody', age: 22 }),
        mananger.insert(collUser, { _id: 'um003', nickname: 'Dick', age: 32, skills: ['Rust'] }),
        mananger.insert(collUser, { _id: 'um004', nickname: 'Edison', skills: ['PHP'] }),
        mananger.insert(collUser, { _id: 'um005', nickname: 'Ethan' })
      ])
      // 将id 以 um 开头的数据全部修改
      const count = await mananger.updateMany(
        collUser,
        { _id: { $regex: /^um/ } },
        { $inc: { age: 1 }, $push: { skills: 'Java' } }
      )
      // 共更新5条
      equal(count, 5)
      // 验证信息
      const u1 = await mananger.findById(collUser, 'um001')
      ok(u1)
      equal(u1.age, 19)
      deepStrictEqual(u1.skills, ['Java'])

      const u2 = await mananger.findById(collUser, 'um002')
      ok(u2)
      equal(u2.age, 23)
      deepStrictEqual(u2.skills, ['Java'])

      const u3 = await mananger.findById(collUser, 'um003')
      ok(u3)
      equal(u3.age, 33)
      deepStrictEqual(u3.skills, ['Rust', 'Java'])

      const u4 = await mananger.findById(collUser, 'um004')
      ok(u4)
      equal(u4.age, 1)
      deepStrictEqual(u4.skills, ['PHP', 'Java'])

      const u5 = await mananger.findById(collUser, 'um005')
      ok(u5)
      equal(u5.age, 1)
      deepStrictEqual(u5.skills, ['Java'])
    })
  )
  it('find 测试', async () => {
    const mananger = getMongoDBManager()
    const res = await mananger.find(
      collUser,
      {
        skills: { $exists: true }
      },
      { offset: 0, limit: 2 }
    )
    ok(res)
    equal(res.length, 2)
    const res2 = await mananger.find(
      collUser,
      {
        nickname: { $gt: '002' }
      },
      { offset: 0, limit: 3 }
    )
    ok(res2)
    equal(res2.length, 3)
  })
  it(
    'count 测试',
    runTestAsync(async () => {
      const mananger = getMongoDBManager()
      await mananger.insert(collUser, { _id: '015', nickname: 'Steve', skills: [] })
      const c1 = await mananger.count(collUser, { nickname: 'Steve' })
      equal(c1, 1)
      const c2 = await mananger.count(collUser, { nickname: 'not exist' })
      equal(c2, 0)
    })
  )
  it(
    'paginate 测试',
    runTestAsync(async () => {
      const mananger = getMongoDBManager()
      // 插入测试数据
      await Promise.all([
        mananger.insert(collUser, {
          _id: 'p01',
          nickname: 'Aaron',
          skills: ['Java', 'PHP', 'Shell']
        }),
        mananger.insert(collUser, { _id: 'p02', nickname: 'Adam', skills: ['Java', 'Golang'] }),
        mananger.insert(collUser, { _id: 'p03', nickname: 'Alan', skills: ['C', 'Rust', 'Shell'] }),
        mananger.insert(collUser, { _id: 'p04', nickname: 'Ben', skills: ['C#', 'Java'] }),
        mananger.insert(collUser, {
          _id: 'p05',
          nickname: 'Bill',
          skills: ['Python', 'Java', 'Shell']
        }),
        mananger.insert(collUser, {
          _id: 'p06',
          nickname: 'Bob',
          skills: ['C++', 'Basic', 'Shell']
        }),
        mananger.insert(collUser, {
          _id: 'p07',
          nickname: 'Cheney',
          skills: ['C', 'Python', 'Shell']
        }),
        mananger.insert(collUser, {
          _id: 'p08',
          nickname: 'Dennis',
          skills: ['JavaScript', 'Java']
        })
      ])
      // 分页查询
      const page = await mananger.paginate(
        collUser,
        { skills: { $in: ['Shell'] } },
        { pn: 2, pz: 3, orderBy: [['_id', 'asc']] }
      )
      ok(page)
      equal(page.total, 5)
      // 一共 5条，第2页只有2条
      equal(page.list.length, 2)
      equal(page.list[0]._id, 'p06')
      equal(page.list[0].nickname, 'Bob')
      equal(page.list[1]._id, 'p07')
      equal(page.list[1].nickname, 'Cheney')
    })
  )
  it(
    '事务测试',
    runTestAsync(async () => {
      const mananger = getMongoDBManager()
      // 插入失败，验证两条记录都不会存在
      try {
        await mananger.tx(async session => {
          await session.insert(collUser, { _id: '016', nickname: 'Marx', skills: [] })
          await session.insert(collUser, { _id: '017', nickname: 'Engels', skills: [] })
          throw new Error('记录将被回退')
        })
        fail('执行事务应当发生错误，但是却没有')
      } catch (e) {
        ok(e instanceof Error)
        equal(e.message, '记录将被回退')
      }
      ok(!(await mananger.existsById(collUser, '016')))
      ok(!(await mananger.existsById(collUser, '017')))

      // 插入成功，查询验证记录都存入成功
      const txRes = await mananger.tx(
        async session => {
          await session.insert(collUser, { _id: '016', nickname: 'Marx', skills: [] })
          await session.insert(collUser, { _id: '017', nickname: 'Engels', skills: [] })
          return 5566
        },
        { timeout: 2000 }
      )
      equal(txRes, 5566)
      const u1 = await mananger.findById(collUser, '016')
      ok(u1)
      equal(u1.nickname, 'Marx')
      const u2 = await mananger.findById(collUser, '017')
      ok(u2)
      equal(u2.nickname, 'Engels')

      // 在事务中使用严格模式禁止的操作
      await assertAsyncThrows({
        async run() {
          await mananger.tx(async session => {
            await session.insertMany(collUser, [{ nickname: ' Orwell' }, { nickname: 'Picasso' }])
          })
        },
        assert(err) {
          ok(err instanceof MongoDBException)
          equal(err.message, 'Prohibited to use insertMany in a strict transaction.')
        }
      })
      await assertAsyncThrows({
        async run() {
          await mananger.tx(async session => {
            await session.find(collUser, { skills: { $in: ['Java'] } }, { offset: 0 })
          })
        },
        assert(err) {
          ok(err instanceof MongoDBException)
          equal(err.message, 'Prohibited to use find in a strict transaction.')
        }
      })

      // 事务超时测试,测试环境配置的是 2s
      await assertAsyncThrows({
        async run() {
          await mananger.tx(async session => {
            await session.insert(collUser, { _id: 't18', nickname: 'Eric' })
            await sleep(3000)
            // 会话超时后的操作
            try {
              await session.insert(collUser, { _id: 't19', nickname: 'Hamath' })
              console.log('即使事务超时,也可以插入成功')
            } catch (e) {
              console.log('事务超时后的操作发生错误', e)
              throw e
            }
          })
        },
        assert(err) {
          ok(err instanceof MongoDBException)
          equal(err.message, 'Transaction timeout !')
        }
      })
      // 等待两秒,让事务内的操作彻底完成,让事务超时后的后续操作有机会执行
      await sleep(2000)
      // 最终两条记录都不会插入
      ok(!(await mananger.existsById(collUser, 't18')))
      ok(!(await mananger.existsById(collUser, 't19')))

      // 操作次数过多引起异常
      await assertAsyncThrows({
        async run() {
          await mananger.tx(async session => {
            await session.findById(collUser, 't01')
            await session.findById(collUser, 't02')
            await session.findById(collUser, 't03')
            await session.findById(collUser, 't04')
            await session.findById(collUser, 't05')
            await session.partialUpdate(collUser, '016', { $set: { nickname: ' Hardy' } })
            await session.partialUpdate(collUser, '017', { $set: { nickname: ' Jeffrey' } })
            await session.findFirst(collUser, { nickname: 'Engels' })
            await session.insert(collUser, { _id: 't19', nickname: ' Dickinson' })
            const u = await session.findById(collUser, 't19')
            if (u) {
              u.skills = ['Java']
              // 这个是第11个操作,刚好会失败
              await session.update(collUser, u)
            }
          })
        },
        assert(err) {
          ok(err instanceof MongoDBException)
          equal(err.message, 'Too many operations in a strict transaction.')
        }
      })
      // 验证回退
      ok(!(await mananger.existsById(collUser, 't19')))
      // 两个被修改的记录也不会变化
      const u3 = await mananger.findById(collUser, '016')
      ok(u3)
      equal(u3.nickname, 'Marx')
      const u4 = await mananger.findById(collUser, '017')
      ok(u4)
      equal(u4.nickname, 'Engels')
    })
  )
})
