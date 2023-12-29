# mysql

mysql 组件基于 [mysql2](https://www.npmjs.com/package/mysql2) 封装，提供了便捷的单表操作方法，
支持多数据源和版本管理功能。

使用 enableMysql 函数来启用 mysql，参数配置名称可选，默认为 MYSQL

## 环境变量

下面是所有环境变量配置说明，使用默认名称 MYSQL，如果使用多套数据源，将 MYSQL 前缀替换成自定义名称，详细见初始化部分。

| 环境变量                      | 说明                                                  |
| :---------------------------- | :---------------------------------------------------- |
| MYSQL_HOST                    | 主机名                                                |
| MYSQL_PORT                    | 端口号                                                |
| MYSQL_USER                    | 用户名                                                |
| MYSQL_PASSWORD                | 密码                                                  |
| MYSQL_CHARSET                 | 字符集，默认 utf8mb4                                  |
| MYSQL_DATABASE                | 库                                                    |
| MYSQL_VERSION_CONTROL_ENABLED | 版本控制开启                                          |
| MYSQL_VERSION_CONTROL_DIR     | 版本控制的文件目录，默认 db_migration                 |
| MYSQL_TIMEZONE                | 时区，默认 +08:00                                     |
| MYSQL_CONNECT_TIMEOUT         | 超时时间，单位毫秒，默认 10000                        |
| MYSQL_DEBUG                   | 调试模式，设置为 true 时会输出执行的 sql              |
| MYSQL_CONNECTION_LIMIT        | 最大连接数                                            |
| MYSQL_MAX_IDLE                | 最大闲置数                                            |
| MYSQL_IDLE_TIMEOUT            | 闲置的超时时间，也即多久不用算闲置，单位毫秒          |
| MYSQL_SLOW_SQL_WARN           | 慢 sql 警告，启用后如果一个查询过慢，就会输出警告日志 |
| MYSQL_SLOW_SQL_MS             | 慢 sql 毫秒数，默认 200                               |
| MYSQL_TRANSACTION_TIMEOUT     | 事务超时时间，单位毫秒，默认 5000                     |
| MYSQL_TRANSACTION_STRICT      | 事务严格模式，默认 true，设置为 false 可关闭严格模式  |

## 初始化

先使用函数 enableMysql 来启用 mysql 组件，然后才能使用相关功能。

```ts
await enableMysql()
```

上面调用 enableMysql 函数未传递任何参数，默认使用名称 "mysql"，搜索以 `MYSQL_` 为前缀的环境变量。

如果有连接多个库的需要，可以多次调用 enableMysql ，传递不同的名称。

```ts
// 自定义新的配置名称 d2
await enableMysql('d2')
```

上传的操作要激活 mysql 　时，会自动映射以 `D2_` 为前缀的环境变量。

下面是多数据源的环境变量示例：

```bash
#  enableMysql() 默认，以 MYSQL_ 为前缀
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=test
MYSQL_PASSWORD=abc123
MYSQL_DATABASE=test1
# enableMysql('d2') 自定义 D2，以 D2_ 为前缀
D2_HOST=localhost
D2_PORT=3306
D2_USER=test2
D2_PASSWORD=abcdefg
D2_DATABASE=test2
```

使用 getMysqlManager 函数来获取 MysqlManager 来完成实体类的相关操作，仅有一个参数，也即是上一步配置的名称，可选。

```ts
// 默认不填，名称是 mysql
const mysqlManager = getMysqlManager()
// 指定名称为 d2，对应 enableMysql('d2')
const d2Manager = getMysqlManager('d2')
```

### 实体类设置

在进行操作之前必须先做好实体类的映射配置, 每个实体类都必须有对应的表信息，下面是用户表的配置示例。

```ts
/**
 * 用户，映射用户表，所有的字段名称都必须和列名称一致，不支持字段名称映射自定义.
 */
export interface User {
  /**
   * id，映射列 id.
   */
  id: string
  nickname: string
  /**
   * 入职日期，映射列 entry_date.
   */
  entry_date?: Date
  hobby?: string
  /**
   * 创建和更新时间由于是自动管理的，类型定义为非必填，由组件自动处理,
   * 在调用组件方法时，不用填写这两个字段的信息.
   */
  createAt?: Date
  updateAt?: Date
}

/**
 * 用户表信息配置，其作用是自动生成 sql 语句.
 */
export const tableUser: Table<User> = {
  /**
   * 表名
   */
  tableName: 'user',
  /**
   * 主键名称，仅支持单列主键，不支持复合主键.
   */
  id: 'id',
  /**
   * 列名称，不包含下面自动管理的时间列和主键.
   */
  columns: ['nickname', 'hobby'],
  /**
   * 创建时间，如果有设置在使用组件操作时会自动管理
   */
  createdDate: {
    /**
     * 列名称
     */
    column: 'createAt',
    /**
     * 类型，支持 date 和 number
     */
    type: 'date'
  },
  /**
   * 更新时间，如果有设置在使用组件操作时会自动管理
   */
  updatedDate: {
    column: 'updateAt',
    type: 'date'
  }
}
```

建议所有的表配置都以 table 开头，这样有利于编辑器提示，需要填入表配置信息的时候就输入 table ，编辑器会提示出所有的表配置信息。

实体类的配置与前面初始化的库配置是没有强制绑定的，也就是说一个实体类的配置可以给多个库使用。
在需要做读写分离的场景，可以让主库和只读库共用实体类。

### 类型映射

实体类字段和查询方法的返回对象的字段有一套类型映射规则，这个需要写的时间注意，**数据库里是什么类型，就必须写对应的 js 原生类型**。
类型映射逻辑不支持修改，下面是对照表：

| js 原生类型 | mysql 字段类型                                                       |
| :---------- | :------------------------------------------------------------------- |
| Number      | TINYINT,SMALLINT,INT,MEDIUMINT,YEAR.FLOAT,DOUBLE,BIGINT              |
| Date        | TIMESTAMP,DATE,DATETIME                                              |
| Buffer      | TINYBLOB,MEDIUMBLOB,LONGBLOB,BLOB,BINARY,VARBINARY,BIT               |
| String      | CHAR,VARCHAR,TINYTEXT,MEDIUMTEXT,LONGTEXT,TEXT,ENUM,SET,DECIMAL,TIME |

对于可空字段，可以在 ts 里也定义为可空：

```ts
export interface User {
  /**
   * 头像文件在对象存储中的 key，可空
   */
  avatar_oss_key?: string
}
```

枚举类型也可以映射的，但是注意是值映射，例如：

```ts
enum Type {
  COURSE,
  EXAM
}
// 实体类
class Entity {
  type: Type
}
```

上面的枚举，实际上 Type.COURSE 映射的值是 0, Type.EXAM 映射的值是 1。
如果需要 Type.COURSE 映射 字符串 COURSE，需要像下面这样处理：

```ts
enum Type {
  COURSE = 'COURSE',
  EXAM = 'EXAM'
}
```

一般情况下，为了使用起来更方便，更推荐使用合并类型。

```ts
class Entity {
  type: 'course' | 'exam'
}
```

## 增删改查

接下来就可以通过 MysqlManager 实例做增删改查的操作了，所有的方法第一个参数都是表信息。

下面是一些增删改查的操作演示。更多的方法信息可参照 MysqlManager 的类型定义，所有方法和参数都有注释。

```ts
// 获取 MysqlManager 实例
const manager = getMysqlManager()
// 按 id 查询
const admin = await manager.findById(tableUser, 'admin001')
// 查询一批 id 对应的记录
const users = await manager.findByIdIn(tableUser, ['admin001', 't001', 't002'])
// 判定某个 id 是否存在
const res = await manager.existsById(tableUser, 'admin001')
// 删除 id 为 d0001 的记录
await manager.deleteById(tableUser, 'd0001')
// 查询表中所有记录，危险操作，慎用
const list = await manager.findAll(tableUser)
// 插入记录
await manager.insert(tableUser, {
  id: 'in001',
  nickname: '小明',
  balance: 1
})
// 批量插入
await manager.insertMany(tableUser, [
  { id: 'im001', nickname: '张飞', balance: 0 },
  { id: 'im002', nickname: '关羽', balance: 2 },
  { id: 'im003', nickname: '刘备', balance: 5 }
])
// 根据指定的条件查询第一条符合的记录
const user = await manager.findFirst(tableUser, c =>
  c.like('nickname', 'ff0%').gt('balance', 75).lt('balance', 77)
)
// 更新记录，完整更新
await manager.update(tableUser, { id: 'xxxxxxx', nickname: '王五', balance: 44 })
// 部分更新，支持置空和递增等操作
await manager.partialUpdate(tableUser, { id: 'pu000', balance: ['inc', 22] })
// 批量更新，对所有符合条件的记录进行局部更新
await manager.updateMany(tableUser, c => c.like('nickname', 'um%').between('balance', 23, 24), {
  balance: ['inc', 2]
})
// 查找所有符合条件的记录
await manager.find({
  table: tableUser,
  criteria: c => c.between('balance', 700, 800).like('id', 'find%'),
  offset: 1,
  limit: 10,
  orderBy: [['balance', 'asc']]
})
// 统计符合条件的记录数量
const count = await manager.count(tableUser, c => c.like('id', 'c00%').like('nickname', '李%'))
// 分页查询
await manager.paginate({
  table: tableUser,
  criteria: c => c.like('id', 'pg0%'),
  pn: 2,
  pz: 5,
  orderBy: [
    ['balance', 'asc'],
    ['id', 'asc']
  ]
})
// 自定义查询，手写 sql
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
// 自定义修改，手写 sql
await manager.modify(`update user set nickname='无名' where nickname='佚名'`)
```

### 所有操作方法

| 方法          | 功能说明                                                                    |
| :------------ | :-------------------------------------------------------------------------- |
| findById      | 按 id 查询                                                                  |
| findByIdIn    | 按 id 列表查询多条记录                                                      |
| existsBy      | 判定指定的条件是否存在记录                                                  |
| existsById    | 判定 id 是否存在                                                            |
| deleteById    | 按 id 删除                                                                  |
| deleteMany    | 按指定条件删除，危险操作，建议尽可能设置 limit 参数来限制数量               |
| findAll       | 查询表下所有记录，危险操作，建议只对数据量非常小的表使用                    |
| findFirst     | 查询符合条件的第一条记录                                                    |
| insert        | 插入记录                                                                    |
| insertMany    | 一次性插入多条记录                                                          |
| update        | 更新记录，需要完整信息                                                      |
| partialUpdate | 局部更新，只提供 id 和需要更新的字段信息                                    |
| updateOne     | 只更新指定条件的第一条记录，必须是相等条件，不支持范围条件                  |
| updateMany    | 更新所有符合条件的记录，危险操作，建议对条件严加限制，控制受影响的范围      |
| find          | 按条件查询所有符合条件的记录，危险操作，建议尽可能设置 limit 参数来限制数量 |
| count         | 统计符合条件的记录数量，危险操作，建议严格限制条件，注意索引的利用          |
| paginate      | 分页查询 ，危险操作，基于 find 和 count                                     |
| query         | 自定义 sql 查询，返回记录列表，支持预编译 sql                               |
| modify        | 执行自定义 sql，返回操作记录数 ，支持预编译 sql                             |

### 预编译 sql

使用 query 或 midify 方法传入自定义 sql 时，sql 是支持预编译的，参数值使用 ? (问号)来占位，表名和
字段名使用 ?? (双问号)来占位。

```sql
update ?? set ?? = ? where ?? = ?
```

上而的预编译 sql 对应的参数：

```ts
const values = ['user', 'name', 'tom', 'id', '001']
```

最终编译后的 sql ：

```sql
update `user` set `name` = 'tom' where `id` = '001'
```

实际开发中，表名和字段名可不必参与预编译，以免影响代码可读性。
但是对于一些特殊的名称或者是动态名称，建议使用预编译，相比字符串拼接更安全。

## 版本控制

前面环境变量有介绍，变量 MYSQL_VERSION_CONTROL_ENABLED 启用管理，变量 MYSQL_VERSION_CONTROL_DIR 设置版本目录，
目前支持绝对路径或者相对于进程工作目录的相对路径。

在版本目录中，所有的文件的格式都是“数字版本号加.sql”。

版本管理目录文件列表示例：

```
1.sql
2.sql
3.sql
```

版本号是从 1 开始的，逐个递增。**程序迭代，新版本必须添加新的文件，而不能改动已有的版本文件。**
组件并没有文件校验功能，来防止改动旧文件，也不支持为版本加注释，这些需要在项目中做作好代码的版本控制。

**注意不要在版本管理中执行耗时较久的 sql，每个版本的 sql 都尽可能要短。**这主要是因为版本管理在执行在事务中的，
时间太长会因事务会超导致失败，程序的启动时间也会很长。对于大表创建索引等非常耗时的场景，只能手动操作数据库，无法在版本管理中完成。

## 事务

使用 MysqlManager 对象的 tx 方法可以执行事务操作，方法接受一个函数参数，函数的参数是 session 对象，
**所在事务中的操作，都必须调用 session 的方法，session 的操作方法与 mananger 是一样的**。

```ts
mysqlManager.tx(
  async session => {
    // 在事务中更新订单和帐号余额
    // orderId 订单ID
    // accountId 帐号ID
    // amount 订单金额
    await session.partialUpdate(tableOrder, { id: orderId, status: 'finished' })
    await session.partialUpdate(tableAccount, { id: accountId, balance: ['inc', -amount] })
  },
  // 设置隔离级别和超时时间，可选
  { isolationLevel: 'READ UNCOMMITTED', timeout: 1000 }
)
```

**注意事务中的异步调用不要忘了 await ，一定要等这些异步执行完，否则相关操作将不会参与事务。**

### 严格模式

因此事务默认是打开严格模式的，在严格模式下，事务中的很多操作都被禁止，
通过将环境变量 MYSQL_TRANSACTION_STRICT （默认变量名称，多实例的情况下使用对应名称）
设置为 false 可以关闭。

严格模式下，禁止在事务中进行以下的操作：

1. 批量插入 insertMany
2. 批量更新 updateMany
3. 批量删除 deleteMany
4. 批量查询和计数 find、count、paginate
5. findByIdIn 参数超过 100 个
6. 使用 query 和 modify 执行自定义 sql
7. 调用 session 进行的任何操作累计超过 10 次

长事务有很大的风险，在生产环境下推荐使用严格事务，并且将事务的超时时间设置的尽可能短一些。
