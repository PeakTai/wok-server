---
name: wok-server-getting-started
description: 介绍 wok-server 的入门指南，包括项目创建、手动安装、最简使用、使用路由等。
license: MIT
metadata:
  author: Peak Tai
  email: peaktai@qq.com
---

# wok-server 入门指南

wok-server 是一个简洁易用的 Node.js 后端开发框架，使用 TypeScript 开发，有完整的类型约束和定义，注释详细，文档齐全，支持国际化。

主要功能：配置，日志，国际化，校验，缓存，MVC，MySQL，MongoDB，周期任务。

## 创建项目

推荐通过脚手架创建一个结构完整的项目：

```bash
npm create wok-server
```

创建的项目结构与[工程化文档](./references/engineering.md)推荐的目录结构一致（按功能划分，而非传统的按层划分），细节可参考该文档。

## 手动安装

```bash
npm i wok-server --save
```

## 最简示例

入口文件 `main.ts`：

```ts
import { startWebServer } from 'wok-server'

startWebServer({
  routers: {
    '/': async exchange => exchange.respondText('Hello world !')
  }
}).catch(e => {
  console.error('Start server failed', e)
})
```

运行后访问 `http://localhost:8080` 将输出 "Hello world !"。

相关设置可通过环境变量来修改，比如 `SERVER_PORT` 设置端口号。

## 路由与拦截器

```ts
import { startWebServer } from 'wok-server'

await startWebServer({
  routers: {
    '/': async exchange => exchange.respondJson({ ok: true }),
    '/users': async exchange => {
      const list = await listUser()
      exchange.respondJson(list)
    }
  },
  interceptors: [
    async (exchange, next) => {
      try {
        await next()
      } catch (e) {
        exchange.respondErrMsg('服务器错误', 500)
      }
    }
  ]
})
```

## JSON 请求处理

使用 `createJsonHandler` 快速创建 JSON 格式接口，自动完成请求解析、校验、响应序列化：

```ts
import { createJsonHandler, notBlank, length } from 'wok-server'

interface Form {
  code: string
  nickname: string
}

export const createUser = createJsonHandler<Form, { id: string }>({
  validation: {
    code: [notBlank(), length({ max: 64 })],
    nickname: [notBlank(), length({ max: 64 })]
  },
  async handle(body) {
    const newUser = await createUserInDb(body)
    return { id: newUser.id }
  }
})
```

## 数据库操作（MySQL 为例）

```ts
import { enableMysql, getMysqlManager, Table } from 'wok-server'

await enableMysql()

export interface User {
  id: string
  nickname: string
}

export const tableUser: Table<User> = {
  tableName: 'user',
  id: 'id',
  columns: ['nickname']
}

const manager = getMysqlManager()
const user = await manager.findById(tableUser, '001')
```

数据库组件也支持 MongoDB，用法类似。
