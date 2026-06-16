---
name: wok-server-mysql
description: wok-server MySQL 组件使用指南，提供单表 CRUD、多数据源、版本管理和事务的完整支持。
license: MIT
metadata:
  author: Peak Tai
  email: peaktai@qq.com
---

# wok-server MySQL 组件

## 概述

MySQL 组件基于 [mysql2](https://www.npmjs.com/package/mysql2) 封装，提供便捷的单表操作。支持：实体映射 CRUD、多数据源、SQL 版本管理、事务、慢查询告警。

## 源码与类型定义

安装 `wok-server` 后，可通过以下路径查看源码与类型定义：

- 源码目录：`node_modules/wok-server/src/mysql/`
- 类型定义：`node_modules/wok-server/types/` （引用 mysql 组件的 `.d.ts` 文件）

核心源码文件：

| 文件               | 说明                               |
| :----------------- | :--------------------------------- |
| `index.ts`         | 模块入口，`enableMysql`/`getMysqlManager` |
| `config.ts`        | 配置定义与默认值                    |
| `table-info.ts`    | `Table<T>` 表映射接口               |
| `manager/`         | 管理器层：`BaseMysqlManager`、`MysqlManager`、`MysqlTxSession` |
| `manager/ops/`     | 各操作的 SQL 生成与执行             |
| `manager/ops/criteria.ts` | `MysqlCriteria` 条件构建器    |
| `migration.ts`     | SQL 文件版本管理                    |
| `exception.ts`     | `MysqlException` 异常类             |

---

## 环境变量

| 环境变量                       | 说明                 | 默认值       |
| :----------------------------- | :------------------- | :----------- |
| `MYSQL_HOST`                   | 主机名               | localhost    |
| `MYSQL_PORT`                   | 端口号               | 3306         |
| `MYSQL_USER`                   | 用户名               | root         |
| `MYSQL_PASSWORD`               | 密码                 | 123456       |
| `MYSQL_DATABASE`               | 数据库名             | example      |
| `MYSQL_CHARSET`                | 字符集               | utf8mb4      |
| `MYSQL_CONNECTION_LIMIT`       | 最大连接数           | 10           |
| `MYSQL_MAX_IDLE`               | 最大闲置连接数       | 10           |
| `MYSQL_IDLE_TIMEOUT`           | 闲置超时（ms）       | 60000        |
| `MYSQL_CONNECT_TIMEOUT`        | 连接超时（ms）       | 10000        |
| `MYSQL_DEBUG`                  | 调试模式，输出 SQL   | false        |
| `MYSQL_SLOW_SQL_WARN`          | 慢查询警告           | true         |
| `MYSQL_SLOW_SQL_MS`            | 慢查询阈值（ms）     | 200          |
| `MYSQL_TIMEZONE`               | 时区                 | +08:00       |
| `MYSQL_VERSION_CONTROL_ENABLED`| 版本管理开启         | false        |
| `MYSQL_VERSION_CONTROL_DIR`    | 迁移文件目录         | db_migration |
| `MYSQL_TRANSACTION_TIMEOUT`    | 事务超时（ms）       | 5000         |
| `MYSQL_TRANSACTION_STRICT`     | 事务严格模式         | true         |
| `MYSQL_MAX_OPS_IN_STRICT_TX`   | 严格事务最大操作次数 | 10           |

---

## 初始化

```ts
import { enableMysql, getMysqlManager } from 'wok-server'

await enableMysql()
const manager = getMysqlManager()
```

多数据源（如读写分离等高级用法）见[参考文档](./references/multi-datasource.md)。

---

## 实体类配置

表映射配置由 `Table<T>` 接口定义，字段分三部分：主键、普通列、时间列，三者不允许重叠。

```ts
import { Table } from 'wok-server'

export interface User {
  id: string
  nickname: string
  hobby?: string
  create_at?: number
  update_at?: number
}

export const tableUser: Table<User> = {
  tableName: 'user',
  id: 'id',
  columns: ['nickname', 'hobby'],
  createdDate: { type: 'number', column: 'create_at' },
  updatedDate: { type: 'number', column: 'update_at' }
}
```

`createdDate` 和 `updatedDate` 配置的字段由框架自动管理：`insert`/`insertMany` 时自动填入创建时间和更新时间，`update`/`partialUpdate`/`updateMany` 时自动更新 `updatedDate` 字段。业务代码中不需要手动设置这两个字段的值。

> **⚠️ 重要：框架不支持字段名称映射。** 实体类型的字段名必须和数据库列名一模一样。比如数据库列名是 `entry_date`，实体字段不能写为 `entryDate` 或 `entryDate` 再用装饰器映射，必须是 `entry_date: Date`。如果之前用惯了其他 ORM 框架，很容易在这里习惯性写成驼峰而掉坑，务必注意。

### 类型映射规则

| JS 类型        | MySQL 字段类型                                                        |
| :------------- | :------------------------------------------------------------------- |
| `number`       | TINYINT, SMALLINT, INT, MEDIUMINT, YEAR, FLOAT, DOUBLE, BIGINT       |
| `Date`         | TIMESTAMP, DATE, DATETIME                                             |
| `Buffer`       | TINYBLOB, MEDIUMBLOB, LONGBLOB, BLOB, BINARY, VARBINARY, BIT         |
| `string`       | CHAR, VARCHAR, TINYTEXT, MEDIUMTEXT, LONGTEXT, TEXT, ENUM, SET, DECIMAL, TIME |
| `object`/`array` | JSON                                                                |

实体字段类型必须与数据库列类型匹配对应的 JS 原生类型，否则查询结果会不正确。可空字段在实体中也定义为可选（`?`）。

> **⚠️ `boolean` 类型安全警告**
>
> MySQL 的 `BOOLEAN` 实际是 `TINYINT(1)`，驱动返回 `0`/`1`（number），**不是** `true`/`false`。
> 实体类中将字段声明为 `boolean` 会导致 `===` 全等比较出现 bug，且手写 SQL 查询同样存在此问题。
>
> 框架**不提供**类型自动映射。最安全的做法是使用 `0 | 1` 类型，与数据库真实返回值保持一致：
>
> ```ts
> export interface User {
>   is_active: 0 | 1  // 推荐
> }
> ```
>
> `0 | 1` 在条件判断中与 `boolean` 行为一致，仅在 `=== true/false` 时有差异。

---

## CRUD 操作

所有操作以 `Table<T>` 为第一个参数。

### 查询

```ts
const user = await manager.findById(tableUser, '001')           // 按 ID 查
const users = await manager.findByIdIn(tableUser, ['001','002'])  // 批量 ID 查
const list = await manager.findAll(tableUser)                   // ⚠️ 全表，危险
```

### 条件查询

使用 `MysqlCriteria` 构建条件，默认 AND 关系：

```ts
const user = await manager.findFirst(tableUser, c =>
  c.like('nickname', 'ff0%').gt('balance', 75).lt('balance', 77)
)
```

**链式条件方法**：`eq`、`neq`、`gt`、`gte`、`lt`、`lte`、`like`、`notLike`、`between`、`in`、`notIn`、`isNull`、`isNotNull`、`or`、`and`、`expr`。

`expr()` 方法支持在 WHERE 子句中插入自定义 SQL 表达式：

```ts
c => c.like('id', 'critex%').expr('?? * ? > ?', ['balance', 2, 50])
// SQL: where `id` like 'critex%' and `balance` * 2 > 50
```

### 复杂查询

```ts
const list = await manager.find({
  table: tableUser,
  criteria: c => c.between('balance', 700, 800).like('id', 'find%'),
  offset: 1,
  limit: 10,
  orderBy: [['balance', 'asc']]
})

// 自定义排序表达式
const list2 = await manager.find({
  table: tableUser,
  criteria: c => c.like('nickname', 'ob%'),
  orderBy: [['expr', '?? * ?', ['balance', 2], 'desc']]
})
// SQL: ORDER BY `balance` * 2 desc
```

### 分页

```ts
const page = await manager.paginate({
  table: tableUser,
  criteria: c => c.like('id', 'pg0%'),
  pn: 2, pz: 5,
  orderBy: [['balance', 'asc'], ['id', 'asc']]
})
// { total: number, list: T[] }

// 指定字段分页查询
const page2 = await manager.paginateSelect({
  table: tableUser,
  criteria: c => c.like('id', 'pg0%'),
  select: ['id', 'nickname', 'balance'],
  pn: 2, pz: 5
})
// { total: number, list: Pick<T, 'id'|'nickname'|'balance'>[] }
```

### 插入

```ts
const newUser = await manager.insert(tableUser, { id: 'in001', nickname: '小明' })
await manager.insertMany(tableUser, [
  { id: 'im001', nickname: '张飞' },
  { id: 'im002', nickname: '关羽' }
])

// 插入时使用表达式（InsertValue）
await manager.insert(tableUser, {
  id: 'in002',
  nickname: '小红',
  balance: ['expr', '?? * ?', ['score', 2]],
  createAt: ['now']
})
```

支持三种表达式：`['now']`（NOW()）、`['set', value]`（解决元组冲突）、`['expr', sql, values?]`（自定义 SQL）。

### Upsert

```ts
// 单条 upsert，主键冲突则更新
await manager.upsert(tableUser, { id: 'us001', nickname: '赵云', balance: 10 })

// 批量 upsert
await manager.upsertMany(tableUser, [
  { id: 'us002', nickname: '马超', balance: 20 },
  { id: 'us003', nickname: '黄忠', balance: 30 }
])

// 冲突时自定义更新（使用 Updater）
await manager.upsertWithUpdater(
  tableUser,
  { id: 'us001', nickname: '赵云', balance: 10 },
  { balance: ['inc', 5], nickname: '赵云-updated' }
)
```

### 更新

```ts
// 完整更新（需要完整文档）
await manager.update(tableUser, { id: 'xxx', nickname: '王五' })

// 局部更新
await manager.partialUpdate(tableUser, {
  id: 'pu000',
  // 自增 +22
  balance: ['inc', 22],
  // 自增 +1（默认值）
  visits: ['inc'],
  // NULL 安全的字符串追加
  nickname: ['concat', '-suffix'],
  // 设置为 NOW()
  last_login_at: ['now'],
  // 自定义表达式
  score: ['expr', '?? * ?', ['score', 2]]
})

// 批量更新
await manager.updateMany(tableUser, c => c.like('nickname', 'um%'), { balance: ['inc', 2] })
```

> **0.7.0 版本**开始，`null` 不再自动置 NULL。如需将字段设置为 NULL，必须显式使用 `['setNull']`。
> `['func']` 已移除，请使用 `['expr']` 替代（如 `['func', 'NOW()']` → `['expr', 'NOW()']`）。

### 删除

```ts
await manager.deleteById(tableUser, 'd0001')
await manager.deleteMany({ table: tableUser, criteria: { status: 'DISABLED' }, limit: 100 })
await manager.deleteOne(tableUser, { id: 'only_one' })
```

**⚠️ `deleteMany` 是危险操作**，建议严格限制条件并设置 `limit` 参数。

### 自定义 SQL

```ts
// 查询
const list = await manager.query<{ author: string; book: string }>(
  'select u.nickname as author, b.name as book from ?? u left join ?? b on u.id=b.author_id where b.id is not null',
  ['user', 'book']
)

// 修改
const affected = await manager.modify(`update user set nickname='无名' where nickname='佚名'`)
```

### 全部方法

| 方法           | 说明                         | 危险 |
| :------------- | :--------------------------- | :--- |
| `findById`     | 按 id 查询                   |      |
| `findByIdIn`   | 批量 id 查询                 |      |
| `findFirst`    | 查第一条符合条件的           |      |
| `find`         | 条件查询，支持 offset/limit  | ⚠️   |
| `findSelect`   | 条件查询，指定返回列         | ⚠️   |
| `findAll`      | 全表查询                     | ⚠️   |
| `existsBy`     | 条件判断存在                 |      |
| `existsById`   | id 判断存在                  |      |
| `count`        | 统计数量                     | ⚠️   |
| `paginate`     | 分页查询                     | ⚠️   |
| `paginateSelect` | 指定字段分页查询            | ⚠️   |
| `insert`       | 插入单条                     |      |
| `insertMany`   | 批量插入                     |      |
| `upsert`       | 插入单条，主键冲突则更新     |      |
| `upsertMany`   | 批量 upsert                  |      |
| `upsertWithUpdater` | upsert 单条，冲突时自定义更新 |  |
| `update`       | 完整更新                     |      |
| `partialUpdate`| 局部更新                     |      |
| `updateOne`    | 更新第一条相等条件           |      |
| `updateMany`   | 批量更新                     | ⚠️   |
| `deleteById`   | 按 id 删除                   |      |
| `deleteOne`    | 删除第一条相等条件           |      |
| `deleteMany`   | 批量删除                     | ⚠️   |
| `query`        | 自定义 SQL 查询              |      |
| `modify`       | 自定义 SQL 修改              |      |

---

## JSON 类型支持

在实体中直接定义 JSON 字段对应的 TS 类型即可，框架自动解析：

```ts
interface Question {
  id: string
  options: { title: string; correct?: boolean }[]
}

export const tableQuestion: Table<Question> = {
  tableName: 'question', id: 'id', columns: ['options']
}
```

条件查询支持 `json_extract` 和 `json_length`，使用元组代替列名：

```ts
await manager.findFirst(tableQuestion, c =>
  c.eq(['json_extract', 'question_setter', '$.id'], 'x333')
)
await manager.findFirst(tableQuestion, c =>
  c.gt(['json_length', 'options'], 3)
)
```

---

## 事务

```ts
await manager.tx(async session => {
  await session.partialUpdate(tableAccount, { id: accId, balance: ['inc', -amount] })
  await session.insert(tableOrder, { id: orderId, amount })
}, { timeout: 3000 })
```

事务操作**必须使用 `session` 对象**，直接调用 `manager` 的方法不会在事务中生效。

选项：
- `timeout`：超时时间（ms），超时后自动回滚并抛出 `MysqlException`
- `isolationLevel`：隔离级别（`REPEATABLE READ` 等）
- `accessMode`：读写模式（`READ WRITE` / `READ ONLY`）

### 严格模式

`MYSQL_TRANSACTION_STRICT=true` 时启用严格模式，限制事务中的操作次数（`MYSQL_MAX_OPS_IN_STRICT_TX`，默认 10 次）。超限抛出 `MysqlException`。

---

## 内部实现要点

### 连接管理

`enableMysql` 注册配置 → 可选迁移 → 创建 `Pool` → 构建 `MysqlManager` → 存入 `managerMap`。进程退出前自动关闭连接池。

### 查询流程

`MysqlManager` 从连接池获取连接 → `Promise.race` 超时竞速 → 执行 SQL → 释放连接。

### 慢查询

所有 CRUD 操作（除自定义 SQL）自动计时，超过 `MYSQL_SLOW_SQL_MS` 时输出 WARN 日志。

### Migration 实现

版本管理的完整使用说明见[参考文档](./references/version-control.md)。

---

## 参考

- [多数据源（读写分离等高级用法）](./references/multi-datasource.md)
- [版本管理](./references/version-control.md)
