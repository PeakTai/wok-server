# mongodb

mongodb 组件基于 [mongodb 官方的驱动](https://www.npmjs.com/package/mongodb)进行封装，提供了简单的实体映射和增删改查功能，以方便操作。

## 环境变量

mongodb 组件支持多实例，默认情况下以 MONGO 为前缀。

| 变量名称                    | 说明                                                            |
| :-------------------------- | :-------------------------------------------------------------- |
| MONGO_URI                   | mongo 链接，示例：mongodb+srv://<user>:<password>@<cluster-url> |
| MONGO_MAX_POOL_SIZE         | 连接小事情最大连接数,默认 10                                    |
| MONGO_MIN_POOL_SIZE         | 连接小事情最小连接数,默认 1                                     |
| MONGO_MAX_CONNECTING        | 连接池最大并发连接数 ,默认 10                                   |
| MONGO_MAX_IDLE_TIME_MS      | 连接的最大闲置时间,单位毫秒,默认 60000                          |
| MONGO_WAIT_QUEUE_TIMEOUT_MS | 连接的最大等待时间,单位毫秒,默认 60000                          |
| MONGO_SLOW_QUERY_WARN       | 慢查询警告，开启后会对慢查询输出警告日志，默认开启              |
| MONGO_SLOW_QUERY_MS         | 慢查询毫秒数,默认 200                                           |
| MONGO_TRANSACTION_TIMEOUT   | 事务超时时间，单位毫秒，默认 5000                               |
| MONGO_TRANSACTION_STRICT    | 事务严格模式,默认为 true ,设置为 false 关闭                     |

## 使用

### 初始化

先使用函数 enableMongoDB 来启用 mongodb ，完成后才使用相关的功能。

```ts
await enableMongoDB()
```

组件支持多实例，如果有多个库需要连接，可以指定一个新名称。

```ts
// 启用指定名称为 md2 的实现
await enableMongoDB('md2')
```

默认情况下环境变量的前缀是 MONGO，指定名称的实例，将使用名称大写后的前缀，上例中指定的名称为 md2 的实例，将使用前缀 MD2。

```
# 配置默认的连接
MONGO_URI=mongodb://test1:t1abcd@localhost/t1
MONGO_MAXPOOLSIZE=10
# 配置 md2 名称对应的链接
MD2_URI=mongodb://test2:t2abcd@localhost/t2
MD2_MAXPOOLSIZE=10
```

使用 getMongoDBManager 函数可以获取一个管理器实例用于操作 mongodb 实例，
支持可选的名称来获取对应的实例。

```ts
// 默认实例
const mananger = getMongoDBManager()
// md2 实例
const md2 = getMongoDBManager('md2')
```

### 实体映射

通过 manager 对象提供的方法可以完成基础的增删改查，但是在操作之前必须要进行配置。

配置分为两个部分，一个是集合的数据格式定义，一个是集合信息的设定，下面是一个示例。

```ts
/**
 * 用户集合数据定义。
 * 主键名称固定为 _id，不支持映射配置，实体类不要有 _id 字段。
 */
export interface User {
  nickname: string
  skills: string[]
  // 创建和更新字段都可以设置让组件自动维护
  // 因为类型约束的缘故，为了插入和更新时不填，这里设为可选
  createAt?: Date
  updateAt?: Date
}
/**
 * 用户集合信息，类型是 MongoCollection，泛型就是实体类型。
 * 主键名称固定为 _id，不支持映射配置。
 */
export const collUser: MongoCollection<User> = {
  /**
   * 集合名称
   */
  collectionName: 'user',
  /**
   * 配置创建时间字段，组件会自动管理
   */
  createdDate: {
    type: 'date',
    field: 'createAt'
  },
  /**
   * 配置更新时间字段，组件会自动管理
   */
  updatedDate: {
    type: 'date',
    field: 'updateAt'
  }
}
```

### 增删改查

现在就可以做增删改查了，manager 的所有操作第一个参数都是集合信息，就是前面配置的 collUser。

```ts
const mananger = getMongoDBManager()
// 插入记录，在插入记录时，如果 _id 无值，则会由数据库生成 ObjectId 的主键值
await mananger.insert(collUser, { _id: '007', nickname: 'Spark', skills: [] })
// 按id 查找
const uer1 = await mananger.findById(collUser, '007')
// 更新昵称
user1.nickname = 'ryan'
await mananger.update(collUser, user1)
// 判定某个 id 是否存在
const exist = await mananger.existsById(collUser, 'xyz')
// 判定指定条件是否有记录存在
const exist2 = await mananger.existsBy(collUser, { nickname: 'acute' })
// 按 id 删除
await mananger.deleteById(collUser, '007')
// 按条件删除，慎用，一次性删除大量数据很可能会导致数据库高负载，引发线上事故
await mananger.deleteMany(collUser, { nickname: 'smith' })
// 查找第一条符合条件的记录
const jack = await mananger.findFirst(collUser, { nickname: 'jack' })
// 查询集合中的所有记录，谨慎使用，一次性查询大量数据可能会爆内存，需要很长时间来传输
await mananger.findAll(collUser)
// 统计数量，谨慎使用，count 操作即便能走索引，数据量大也会有性能问题
const count = await mananger.count(collUser, { nickname: 'Steve' })
// 查找有技能的用户，最多返回2条结果
const list = await mananger.find(
  collUser,
  {
    skills: { $exists: true }
  },
  { offset: 0, limit: 2 }
)
// 分页，按id排序，每页20条，查询第2页的记录
const page = await mananger.paginate(
  collUser,
  {
    skills: { $exists: true }
  },
  { pn: 2, pz: 20, orderBy: ['_id', 'asc'] }
)
```

### 几种更新方法说明

manager 提供了四种更新方法：update、partialUpdate、updateMany、updateOne。

| 方法名称      | 说明                                                                       |
| :------------ | :------------------------------------------------------------------------- |
| update        | 整个文档更新，需要以传递完整的文档信息，返回更新后的文档，更新失败抛出异常 |
| partialUpdate | 局部更新，只需要传递 id 和要更新的字段信息，返回更新是否成功               |
| partialUpdate | 局部更新，只需要传递 id 和要更新的字段信息，返回更新是否成功               |
| updateMany    | 更新所有符合条件的记录，返回被更新文档数量                                 |
| updateOne     | 只更新一条符合条件的记录，只能是相等条件，不支持范围条件                   |

```ts
// update 需要有完整的文档，一般都要先查询获取文档
const user = await mananger.findById(collUser, '007')
user.nickname = 'ryan'
await mananger.update(collUser, user)
// partialUpdate 则不需要
// 将 id 为 001 的文档昵称更新为 lily
await manager.partialUpdate(collUser, '001', { $set: { nickname: 'lily' } })
// updateMany 和 partialUpdate 唯一的区别就是 id 参数变为条件
// 将所有学分小于等于10的用户学分加一
await manager.updateMany(collUser, { credit: { $lte: 10 } }, { $inc: { credit: 1 } })
```

## 版本管理

enableMongoDB 函数支持 migration 参数，用于版本管理，完成自动迁移。

```ts
await enableMongoDB({
  migration: {
    versionList: versionList
  }
})
```

其中的 versionList 是版本列表，格式是元素为 MongoMigrationVersion（`(db: Db) => Promise<void>`） 类型的数组，
Db 则是 mongodb 驱动提供的库，可以完成各种操作，比如创建集合和索引等。
版本号就是元素的下标，就是说每次程序有更新都应该增加元素，已经的元素不能做任何修改，程序不会做任何校验。
在启动阶段，程序会检查已经更新的版本号（版本列表的下标），然后从版本列表中寻找之后的版本，逐个更新并标记已经完成的版本号。

下面是 versionList 参数的示例：

```ts
const versionList: MongoMigrationVersion[] = [
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
```

## 事务

使用 mananger 对象的 tx 方法可以执行事务操作，方法接受一个函数参数，函数的参数是 session 对象，
**所在事务中的操作，都必须调用 session 的方法，session 的操作方法与 mananger 是一样的**。

```ts
await manager.tx(
  async session => {
    // 在事务中更新订单和帐号余额
    // orderId 订单ID
    // accountId 帐号ID
    // amount 订单金额
    await session.partialUpdate(collOrder, orderId, { $set: { status: 'finished' } })
    await session.partialUpdate(collAccount, accountId, { $inc: { balance: -amount } })
  },
  // 额外的选项，可针对单个事务设置超时时间等
  { timeout: 1000 }
)
```

### 严格模式

事务默认是打开严格模式的，在严格模式下，事务中的很多操作都被禁止，
通过将环境变量 MONGO_TRANSACTION_STRICT （默认变量名称，多实例的情况下使用对应名称）
设置为 false 可以关闭。

严格模式下，禁止在事务中进行以下的操作：

1. 批量插入 insertMany
2. 批量更新 updateMany
3. 批量删除 deleteMany
4. 批量查询和计数 find、count、paginate
5. findByIdIn 参数超过 100 个
6. 调用 session 进行的任何操作累计超过 10 次
