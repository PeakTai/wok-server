---
name: wok-server-code-navigation
description: 教你如何读懂一个 wok-server 项目的代码结构，快速定位目标文件。
license: MIT
metadata:
  author: Peak Tai
  email: peaktai@qq.com
---

# wok-server 项目代码导航

## 概述

面对一个基于 wok-server 的项目时，按以下路径快速理解项目结构、定位目标代码。核心原则：**项目按功能划分目录，路由集中配置，每个接口/拦截器独立一个文件**。

## 通用

### 找到后端代码位置

一个项目可能前后端分离，也可能前端项目合并在同一个仓库。按以下顺序排查：

#### 1. 检查根目录

查看项目根目录是否有 `package.json`：

```bash
ls package.json
```

如果有，搜索其中是否依赖了 `wok-server`：

```bash
grep -o '"wok-server"' package.json
```

如果匹配，说明根目录就是后端项目，后端代码就在根目录。

#### 2. 检查 backend / server 目录

如果根目录没有 `package.json` 或没有安装 wok-server，查找 `backend/` 或 `server/` 子目录：

```bash
ls backend/package.json
```

搜索其中是否依赖了 `wok-server`。例如一个前后端分离的项目，后端代码可能在 `backend/` 目录：

```
backend/
  ├── package.json      # 包含 "wok-server": "^0.5.0"
  ├── src/
  ├── db-migration/
  └── docker/
```

#### 3. 如果以上都行不通

- 搜索项目中的 `wok-server` 关键词（如 `from 'wok-server'`）
- 搜索 `startWebServer` 函数调用，这是 wok-server 的入口 API
- 搜索 `createJsonHandler`、`Table<`、`Routers` 等 wok-server 特有类型

> **确定了后端代码目录后**，后续所有文件路径都相对于该目录（以下称为**项目根目录**）。

### 真实项目结构示例

一个典型 wok-server 中型项目的目录结构（仅作参考，实际项目可能不同）：

```
backend/
  ├── db-migration/              # MySQL 迁移文件
  └── src/
      ├── main.ts                # 入口文件
      ├── exception.ts           # 全局异常定义 + 异常拦截器
      ├── router/
      │   ├── json-handler.ts    # 自定义 handler 工厂（二次封装）
      │   └── rules/             # 按业务模块拆分的路由规则
      │       ├── index.ts       # 聚合所有模块路由
      │       ├── contact.ts     # 联系人模块路由
      │       └── order.ts       # 订单模块路由
      ├── contact/               # 联系人业务模块
      │   ├── contact.ts         # 数据实体 & 表定义
      │   ├── contact-service.ts # 业务逻辑层
      │   ├── bs-contact-create.ts
      │   ├── bs-contact-get.ts
      │   ├── field/             # 子功能：自定义字段
      │   └── log/               # 子功能：操作日志
      ├── order/                 # 订单模块
      ├── auth/                  # 授权模块
      ├── redis/                 # Redis 基础设施（项目扩展）
      └── ali-oss/               # OSS 基础设施（项目扩展）
```

### 搜索技巧

如果以上方法定位不到文件，全文搜索以下关键词：

1. **路由路径字符串** — 一定能找到 handler 的 import 来源（因为 wok-server 路由使用完整路径作为 key）
2. `createJsonHandler` —— 列出直接使用内置工厂的 JSON 接口
3. `create.*Handler` —— 发现自定义封装的 handler 工厂及使用位置
4. `Table<` —— 列出所有数据表定义
5. `Interceptor` —— 列出所有拦截器
6. `schedule` —— 列出所有定时任务
7. `from 'wok-server'` —— 列出所有使用 wok-server API 的文件

## MVC（路由 / 拦截器 / Handler）

### 项目入口 — main.ts

入口文件在 `src/main.ts`，包含以下典型结构（以真实项目为例）：

```ts
// 1. 全局初始化
Date.prototype.toJSON = function () { return this.getTime() as any }
process.on('uncaughtException', err => getLogger().error('未捕获的异常', err))

// 2. 启用基础设施
await enableRedis()       // 项目扩展的，非框架内置
await enableMysql()       // wok-server 框架自带的
await enableAliOss()      // 项目扩展的，非框架内置

// 3. 启动 Web 服务 —— 配置路由和拦截器
await startWebServer({
  interceptors: [globalErrorInterceptor],
  routers: { '/': homepage, ...routers }
})

// 4. 定时任务
scheduleWithFixedDelay(30, 30, new MessageQueueTask({...}))
scheduleDailyTask(3, 0, new CorpFileCleanTask())
```

**所以 `main.ts` 是读懂项目的第一个文件**。从它可以看到：
- 项目用了哪些基础设施（框架自带的如 `enableMysql()`，项目扩展的如 `enableRedis()`、`enableAliOss()`）
- **拦截器链**：`interceptors` 数组定义了请求处理流程，例如 `请求 → globalErrorInterceptor → handler`
- **路由入口**：`routers` 对象指明了路由配置的位置
- **定时任务**：`scheduleWithFixedDelay`、`scheduleDailyTask` 等

### 从接口路径定位 handler（最可靠的方法）

wok-server 的路由配置使用接口完整路径作为 key，所以**在 `src/` 目录下搜索接口路径字符串，就能直接定位到 handler 的 import 位置**。不需要依赖固定的文件名或目录结构。

```
要找一个接口的处理逻辑？
  → 在 src/ 目录下搜索接口完整路径（如 '/bs/contact/create'）
  → 找到匹配的路由配置位置
  → 在该行看到 handler 的 import 来源
  → Ctrl/Cmd + 点击跳转到 handler 文件
```

#### 关键原则

- **最可靠的方式**：从 `startWebServer()`（在 `src/main.ts`）的 `routers` 属性出发，这是路由配置的入口锚点，永远有效。
- **不要依赖固定的文件或目录名**：项目可能将路由写在 `src/main.ts`、`src/router.ts` 或 `src/router/rules/` 目录下，具体位置取决于项目规模。
- **wok-server 路由使用完整路径作为 key**，不会分散配置，所以搜索路径字符串一定能找到。

例如搜索 `/bs/contact/create` 就能在路由文件中找到：

```ts
'/bs/contact/create': bsContactCreate,  // ← 直接看到 handler 名及其 import 来源
```

路由文件的形态取决于项目规模：

- **小型项目**：路由可能直接写在 `src/main.ts` 里
- **中型项目**：每个业务模块一个路由文件，通过 `...` 展开符合并导出

```ts
// router/rules/contact.ts
export const contactRouters: Routers = {
  '/bs/contact/create': bsContactCreate,
  '/bs/contact/delete': bsContactDelete,
  '/bs/contact/get': bsContactGet,
  // ...
}
```


## MySQL

### 通过 SQL 迁移文件了解全局业务

SQL 迁移文件记录了完整的建表语句，可以从中了解项目涉及的所有业务表。查找方式如下：

1. 打开项目根目录下的 `.env` 文件
2. 查看 `MYSQL_VERSION_CONTROL_ENABLED` 变量是否为 `true`
3. 如果为 `true`，再看 `MYSQL_VERSION_CONTROL_DIR` 变量配置的迁移文件目录（如未设置，默认为 `db_migration`）
4. 如果 `.env` 不存在或 `MYSQL_VERSION_CONTROL_ENABLED` 不为 `true`，说明项目没有使用版本控制，即没有 SQL 迁移文件

通过迁移文件的建表语句，可以看到每个表的完整字段定义、索引、外键等，比实体 `interface` 更全面，有助于先对项目业务有个大致的了解。

### 通过实体文件查表结构

知道表名查配置，最快的方式是搜索 `tableName`，但不同项目的代码格式化风格可能不同（空格、引号），建议用正则搜索提高容错：

```
搜索正则可匹配 tableName\s*:\s*['"]表名['"]
```

例如搜索 `tableName:\s*['"]contact['"]`（注意正则中 `\s*` 可以匹配任意数量的空格，`['"]` 可以匹配单引号或双引号），找到匹配位置后，确认满足以下两个条件就是表的配置：

1. 该 `tableName` 所属的常量声明是 `Table<表类型>` 类型，例如 `export const tableContact: Table<Contact>`
2. `Table` 导入自 `wok-server`（即 `import { Table } from 'wok-server'`）

满足这两点，就找到了完整的表配置，从中可以看到表名、主键 ID、字段列表、时间戳配置等信息。

示例代码结构：

```ts
import { Table } from 'wok-server'

export interface Contact {
  id: string
  corp_id: string
  name: string
  // ...
}

export const tableContact: Table<Contact> = {
  tableName: 'contact',   // ← 搜这个字符串找到这里
  id: 'id',               // 主键字段
  columns: ['corp_id', 'name', /* ... */],
  createdDate: { type: 'date', column: 'create_at' },
  updatedDate: { type: 'date', column: 'update_at' }
}
```

业务逻辑层通常在 `src/{功能名}/{功能名}-service.ts`。
