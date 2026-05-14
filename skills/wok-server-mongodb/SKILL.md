---
name: wok-server-mongodb
description: wok-server MongoDB 组件使用指南，基于官方驱动封装，提供实体映射、CRUD、事务和版本管理。
license: MIT
metadata:
  author: Peak Tai
  email: peaktai@qq.com
---

# wok-server MongoDB 组件

## 概述

MongoDB 组件基于 [mongodb 官方驱动](https://www.npmjs.com/package/mongodb) 封装，提供实体映射和增删改查功能。支持多实例、事务、慢查询告警、版本管理。

## 源码与类型定义

安装 `wok-server` 后，可通过以下路径查看源码与类型定义：

- 源码目录：`node_modules/wok-server/src/mongodb/`
- 类型定义：`node_modules/wok-server/types/` （引用 mongodb 组件的 `.d.ts` 文件）

核心源码文件：

| 文件               | 说明                               |
| :----------------- | :--------------------------------- |
| `index.ts`         | 模块入口，`enableMongoDB`/`getMongoDBManager` |
| `config.ts`        | 配置定义与默认值                    |
| `collection.ts`    | `MongoCollection<T>` 集合映射接口   |
| `doc.ts`           | `MongoDocId`、`MongoDocWithId<T>`  |
| `manager/base.ts`  | `BaseMongoManager` 基类            |
| `manager/index.ts` | `MongoDBManager`，含 `tx` 方法     |
| `manager/tx.ts`    | `MongoTxSession` 事务会话          |
| `manager/tx-strict.ts` | `MongoStrictTxSession` 严格事务 |
| `migration.ts`     | 版本迁移                           |
| `exception.ts`     | `MongoDBException` 异常类          |

---

## 环境变量

| 环境变量                    | 说明                 | 默认值 |
| :-------------------------- | :------------------- | :----- |
| `MONGO_URI`                 | 连接地址             | -      |
| `MONGO_MAX_POOL_SIZE`       | 连接池最大连接数     | 10     |
| `MONGO_MIN_POOL_SIZE`       | 连接池最小连接数     | 1      |
| `MONGO_MAX_CONNECTING`      | 最大并发连接数       | 10     |
| `MONGO_MAX_IDLE_TIME_MS`    | 最大闲置时间（ms）   | 60000  |
| `MONGO_WAIT_QUEUE_TIMEOUT_MS` | 等待连接超时（ms） | 60000  |
| `MONGO_SLOW_QUERY_WARN`     | 慢查询警告           | true   |
| `MONGO_SLOW_QUERY_MS`       | 慢查询阈值（ms）     | 200    |
| `MONGO_TRANSACTION_TIMEOUT` | 事务超时（ms）       | 5000   |
| `MONGO_TRANSACTION_STRICT`  | 事务严格模式         | true   |

---

## 初始化

```ts
import { enableMongoDB, getMongoDBManager } from 'wok-server'

await enableMongoDB()
const manager = getMongoDBManager()
```

### 多实例

指定名称即可，环境变量前缀自动变更为该名称大写：

```ts
await enableMongoDB()                    // 默认，前缀 MONGO_
await enableMongoDB({ name: 'md2' })    // 自定义，前缀 MD2_
```

---

## 实体映射

```ts
import { MongoCollection } from 'wok-server'

export interface User {
  nickname: string
  skills: string[]
  createAt?: Date     // 可选，由组件自动管理
  updateAt?: Date
}

export const collUser: MongoCollection<User> = {
  collectionName: 'user',
  createdDate: { type: 'date', field: 'createAt' },
  updatedDate: { type: 'date', field: 'updateAt' }
}
```

- 主键固定为 `_id`（`string | ObjectId`），不可自定义映射
- 实体接口不要声明 `_id` 字段，插入时可传可省略（省略时数据库自动生成 ObjectId）
- `createdDate`/`updatedDate` 配置后由组件自动填充

---

## CRUD 操作

所有操作以 `MongoCollection<T>` 为第一个参数。

### 插入

```ts
const result = await manager.insert(collUser, { _id: '007', nickname: 'Spark', skills: [] })
```

### 查询

```ts
const user = await manager.findById(collUser, '007')                    // 按 _id
const list = await manager.findByIdIn(collUser, ['007', '008'])         // 批量 _id
const jack = await manager.findFirst(collUser, { nickname: 'jack' })    // 第一条
const all = await manager.findAll(collUser)                             // ⚠️ 全量，危险

// 条件查询
const results = await manager.find(collUser,
  { skills: { $exists: true } },
  { offset: 0, limit: 2 }
)
```

查询条件使用 MongoDB 原生 Filter 语法（`{ nick: 'jack' }`, `{ $gt: ... }` 等）。

### 分页

```ts
const page = await manager.paginate(collUser,
  { skills: { $exists: true } },
  { pn: 2, pz: 20, orderBy: ['_id', 'asc'] }
)
```

### 更新（四种方法）

| 方法            | 说明                               | 需要完整文档 |
| :-------------- | :--------------------------------- | :----------- |
| `update`        | 完整文档更新，失败抛异常           | 是           |
| `partialUpdate` | 局部更新，只需 id + 更新字段       | 否           |
| `updateMany`    | 批量更新所有符合条件的             | 否           |
| `updateOne`     | 只更新一条相等条件的               | 否           |

```ts
// 完整更新
const user = await manager.findById(collUser, '007')
user.nickname = 'ryan'
await manager.update(collUser, user)

// 局部更新（MongoDB 更新操作符语法）
await manager.partialUpdate(collUser, '001', { $set: { nickname: 'lily' } })

// 批量更新
await manager.updateMany(collUser, { credit: { $lte: 10 } }, { $inc: { credit: 1 } })
```

### 其他

```ts
await manager.existsById(collUser, 'xyz')
await manager.existsBy(collUser, { nickname: 'smith' })
await manager.deleteById(collUser, '007')
await manager.deleteMany(collUser, { nickname: 'smith' })  // ⚠️ 危险
const count = await manager.count(collUser, { nickname: 'Steve' })
```

---

## 事务

```ts
await manager.tx(async session => {
  await session.partialUpdate(collOrder, orderId, { $set: { status: 'finished' } })
  await session.partialUpdate(collAccount, accountId, { $inc: { balance: -amount } })
}, { timeout: 1000 })
```

**⚠️ 事务中的所有操作必须通过 `session` 完成**，直接使用 `manager` 不会在事务中生效。

选项可覆盖全局超时时间，支持设置 `readConcern`、`writeConcern`、`readPreference`。

### 严格模式

`MONGO_TRANSACTION_STRICT=true`（默认），事务中禁止：
1. 批量 `insertMany`
2. 批量 `updateMany` / `deleteMany`
3. 大批量查询 `find` / `count` / `paginate`
4. `findByIdIn` 参数超过 100
5. 任何操作累计超过 10 次

---

## 版本管理

在 `enableMongoDB` 时传入 `migration.versionList`：

```ts
await enableMongoDB({
  migration: {
    versionList: [
      async db => {                          // 版本 0
        await db.createCollection('user')
        await db.collection('user').createIndex({ nickname: 1 }, { unique: true })
      },
      async db => {                          // 版本 1
        await db.collection('user').insertOne({ nickname: 'jack', ... })
      }
    ]
  }
})
```

- 版本号 = 数组下标，从 0 开始
- **已有元素不可修改**，只能在末尾追加
- 启动时自动检测当前版本（存储在 `db_version` 集合），执行未应用的版本
- 迁移不能回滚，出错需手动在数据库中修复后重启

---

## 内部实现要点

### 初始化

`registerConfig` 注册配置 → 创建 `MongoClient` → 可选迁移 → 存入 `managerMap` → 进程退出前自动 `close()`。

### 慢查询计时

所有操作通过 `timingQuery` 包装，记录耗时，超出 `MONGO_SLOW_QUERY_MS` 时输出 WARN 日志（含操作类型、集合名、ID 等）。

### 事务实现

创建 `ClientSession` → `startTransaction` → `Promise.race` 超时竞速 → 根据 `transactionStrict` 创建普通/严格 session → `exec(session)` → `commit` / `abort` / `finally endSession`。
