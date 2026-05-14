---
name: wok-server-api-rules
description: 介绍 wok-server API 的使用纪律。
license: MIT
metadata:
  author: Peak Tai
  email: peaktai@qq.com
---

# API 使用纪律

当你生成与 wok-server 有关的代码时，以下规则优先级高于一切：

## 规则 1：禁止猜测任何 API

不要使用训练数据中出现的、或你自己"觉得应该有"的函数、组件、类型。

### 消除臆造的具体方法

- 所有 API 统一从 `wok-server` 包导入，禁止从子路径导入（如 `wok-server/mvc`）。
- 生成任何调用前，必须先查阅 `node_modules/wok-server/types/` 下对应模块的定义文件。types 目录按模块组织，常见模块与定义文件对照如下：

| 模块 | 主要入口函数/类型 | 类型定义文件路径 |
|------|-------------------|------------------|
| 日志 | `getLogger()` | `types/log/index.d.ts` |
| 缓存 | `getCache()` | `types/cache/cache.d.ts` |
| 国际化 | `getI18n()` | `types/i18n/i18n.d.ts` |
| 校验 | `validate()` | `types/validation/index.d.ts` |
| 配置 | `registerConfig()`, `getConfig()` | `types/config/index.d.ts` |
| 锁 | `getLockManager()` | `types/lock/index.d.ts` |
| 任务调度 | `scheduleWithFixedDelay()`, `scheduleWithFixedRate()`, `scheduleDailyTask()` | `types/task/index.d.ts` |
| HTTP客户端 | `doRequest()`, `postJson()`, `getJson()` | `types/http-client/index.d.ts` |
| MySQL | `enableMysql()`, `getMysqlManager()` | `types/mysql/index.d.ts` |
| MongoDB | `enableMongoDB()`, `getMongoDBManager()` | `types/mongodb/index.d.ts` |
| MVC | `startWebServer()`, `stopWebServer()`, `createJsonHandler()`, `createUploadHandler()`, `createSseHandler()`, `restful()`, `removeServerStaticCache()` | `types/mvc/index.d.ts` |

- 代码必须严格匹配签名——函数参数名称、顺序、类型完全一致，返回值类型正确处理（如 `Promise` 需 `await`）。

### 示例

❌ 错误：`getCache().add('key', data)` —— cache 没有 `add` 方法，属于臆造。

✅ 正确：查阅 `node_modules/wok-server/types/cache/cache.d.ts` 后，使用 `getCache().put('key', data)` 并严格按签名调用。

❌ 错误：`exchange.send(data)` 或 `exchange.json(data)` —— `ServerExchange` 没有这些方法。

✅ 正确：使用 `exchange.respondJson(data)` 或 `exchange.respondText(text)` 等，详见下方 ServerExchange 速查表。

---

## 规则 2：每个拦截器和每个路由 handler 都应该有单独的文件

禁止多个拦截器写在一个文件里，禁止多个接口的处理逻辑在一个文件里。
即使内容再少，也不允许写在一起。

路由的配置（`routers` 对象）必须在入口文件（如 `main.ts`）或独立的 router 目录中**集中管理**，不允许在业务目录中分散配置路由映射。集中配置是为了方便查找所有路由。

### 拦截器标准签名

```ts
import { ServerExchange } from 'wok-server'

// 每个拦截器单独一个文件，export 一个函数
export async function authInterceptor(
  exchange: ServerExchange,
  next: () => Promise<void>
): Promise<void> {
  // 前置处理...
  await next()
  // 后置处理...
}
```

类型定义为：

```ts
interface Interceptor {
  (exchange: ServerExchange, next: () => Promise<void>): Promise<void>
}
```

---

## 规则 3：每个路由 handler 文件的参数和响应定义都应该保持在内部

每个路由的处理逻辑是独立的，不向外导出除 handler 以外的函数、组件、类型，不和别的路由共享数据。

### 可用的 Handler 工厂函数

wok-server 提供了以下 4 种 handler 工厂函数，禁止使用除此之外任何臆造的工厂函数：

| 工厂函数 | 用途 | 请求格式 | 响应格式 |
|----------|------|----------|----------|
| `createJsonHandler` | JSON 请求/响应 | POST，JSON body | JSON |
| `createUploadHandler` | 二进制文件上传 | POST，binary body | JSON |
| `createSseHandler` | Server-Sent Events 推送 | GET | SSE 事件流 |
| `restful` | 按 HTTP 方法分发 | 任意 | 由内层 handler 决定 |

#### createJsonHandler 示例

```ts
// create-user.ts
import { createJsonHandler, notBlank, length, min, max, notNull } from 'wok-server'

interface Form {
  name: string
  age: number
}

interface Resp {
  id: string
}

export const createUserHandler = createJsonHandler<Form, Resp>({
  validation: {
    name: [notBlank(), length({ min: 2, max: 16 })],
    age: [notNull(), min(1), max(150)]
  },
  // 可选：缓存支持
  async cache(body) {
    return { key: `user-${body.name}`, expiresInSeconds: 60 }
  },
  async handle(body) {
    const newUser = await createUser(body)
    return { id: newUser.id }
  }
})
```

命名约定：请求数据类型推荐命名为 `Form`，响应数据类型推荐命名为 `Resp`。
由于这两个数据类型是保持在文件内部的，所以不同的 handler 文件可以使用这两个名称，不会冲突，
这也是推荐的方式。如果每个具体的业务，根据场景命名也是可以的，如 CreateUserForm、CreateUserResp,
这样更严谨，查询可能更方便，但是开发效率会稍低。

#### createUploadHandler 示例

上传请求正文是文件二进制内容，额外参数通过 QueryString 传递。请求体类型是 `Buffer`，不需要定义 Form。

```ts
// upload-avatar.ts
import { createUploadHandler, validate, notBlank } from 'wok-server'

interface Resp {
  url: string
}

export const uploadAvatarHandler = createUploadHandler<Resp>({
  async handle(body, exchange) {
    const userId = exchange.query.getStr('userId')
    validate({ userId }, { userId: [notBlank()] })
    // body 就是文件的 Buffer，可直接使用
    const key = `avatars/${userId}`
    await oss.putObject(key, body)
    return { url: oss.getUrl(key) }
  }
})
```

#### createSseHandler 示例

SSE handler 没有请求/响应数据类型，只有 `SseContext`。

```ts
// sse-notify.ts
import { createSseHandler } from 'wok-server'

export const notifyHandler = createSseHandler({
  async handle(ctx) {
    // ctx.send(data, event?, id?)  发送事件
    // ctx.close()                  关闭连接
    ctx.send({ message: '连接成功' }, 'connected')
    // ... 业务逻辑
    ctx.close()
  }
})
```

#### restful 示例

```ts
// user-router.ts
import { restful } from 'wok-server'
import { createUserHandler } from './create-user'
import { getUserHandler } from './get-user'

export const userRouter = restful({
  get: getUserHandler,
  post: createUserHandler
})
```

---

## 规则 4：业务错误应抛出异常，由全局异常拦截器统一处理

推荐的处理模式：
1. 定义 `BusinessException` 自定义业务异常类
2. 创建 `globalErrorInterceptor` 放在拦截器链**第一位**
3. Handler 中遇到业务错误，抛出异常来中止处理流程

```ts
// exception.ts —— 全局异常定义文件
import { ServerExchange, ValidationException } from 'wok-server'

export class BusinessException {
  constructor(
    readonly message: string,
    readonly status?: number
  ) {}
}

export async function globalErrorInterceptor(
  exchange: ServerExchange,
  next: () => Promise<void>
): Promise<void> {
  try {
    await next()
  } catch (e) {
    if (e instanceof BusinessException) {
      exchange.respondErrMsg(e.message, e.status ?? 400)
      return
    }
    if (e instanceof ValidationException) {
      exchange.respondErrMsg(`${e.propertyPath}：${e.errMsg}`, 400)
      return
    }
    throw e
  }
}
```

```ts
// main.ts 入口文件，将错误拦截器放在第一位
import { startWebServer } from 'wok-server'
import { globalErrorInterceptor } from './exception'

await startWebServer({
  interceptors: [globalErrorInterceptor /* , 其他拦截器 */],
  routers: { /* ... */ }
})
```

---

## 附录 A：ServerExchange 速查表

所有路由 handler 和拦截器都通过 `ServerExchange` 与请求/响应交互。以下是其完整方法列表，禁止使用表中未列出的方法。

### 读取请求

| 方法/属性 | 返回类型 | 说明 |
|-----------|----------|------|
| `exchange.request` | `IncomingMessage` | Node.js 原生请求对象 |
| `exchange.response` | `ServerResponse` | Node.js 原生响应对象 |
| `await exchange.bodyJson<T>()` | `Promise<T>` | 读取 JSON 请求体（空体返回 `{}`） |
| `await exchange.bodyBuffer()` | `Promise<Buffer>` | 读取二进制请求体 |
| `await exchange.bodyText()` | `Promise<string>` | 读取文本请求体 |
| `exchange.parseQueryString()` | `QueryString` | 解析 URL 查询字符串 |

> **注意**：如果使用了第三方库读取 request 内容，则不能再调用 `bodyXxx` 系列方法，反之亦然。但 `bodyXxx` 系列方法之间可以重复调用。

### 响应

| 方法 | 说明 |
|------|------|
| `exchange.respondJson(json, status?)` | 响应 JSON，默认 status 200 |
| `exchange.respondErrMsg(message, status?)` | 响应统一错误格式 `{ message: "..." }`，默认 status 400 |
| `exchange.respondText(text, status?)` | 响应纯文本，默认 status 200 |
| `exchange.respondFile(filePath, download?)` | 响应文件，`download=true` 触发下载 |
| `exchange.respondHtml(html, status?)` | 响应 HTML |
| `exchange.respond({ statusCode, body?, headers? })` | 底层通用响应 |

---

## 附录 B：startWebServer 完整配置

```ts
import { startWebServer } from 'wok-server'

await startWebServer({
  // 必填：路由配置，键为路径，值为 RouterHandler
  // 路径仅支持明确地址，不支持动态参数（如 /users/:id）和通配符
  // '*' 为特殊路径，用于兜底处理 404
  routers: {
    '/user/create': createUserHandler,
    '/user/delete': deleteUserHandler,
    '/sse/notify': notifyHandler,
    '*': notFoundHandler
  },
  // 可选：拦截器链，按数组顺序执行
  interceptors: [globalErrorInterceptor, authInterceptor],
  // 可选：前置处理，可整合 socket.io 等原生 http 组件
  preHandler: async (server) => {
    // const io = new Server(server)
  },
  // 可选：静态文件服务配置
  static: {
    '/': { dir: 'fe', cacheAge: 600 }
  }
})
```

---

## 附录 C：内置校验器列表

以下校验器从 `wok-server` 导入，禁止臆造不存在的校验器：

| 函数 | 作用 |
|------|------|
| `notNull()` | 非空校验（不能是 null/undefined） |
| `notBlank()` | 字符串非空校验（不能是 null/undefined/空白字符串） |
| `min(n)` | 数字最小值 |
| `max(n)` | 数字最大值 |
| `length({ min?, max? })` | 字符串/数组长度范围 |
| `maxLength(n)` | 字符串/数组最大长度 |
| `minLength(n)` | 字符串/数组最小长度 |
| `regexp(re)` | 正则校验 |
| `enumerate(list)` | 枚举校验，值必须在指定列表中 |
| `array(validators)` | 数组元素校验 |
| `plainObject(opts)` | 嵌套对象校验 |

所有内置校验器已支持国际化，自动根据请求头 `accept-language` 切换提示语言。

---

## 附录 D：目录结构参考

```
src/
├── exception.ts          # 全局异常定义 + 错误拦截器
├── main.ts               # 入口：启动服务、集中配置路由
├── auth/                 # 授权模块
│   ├── auth-interceptor.ts
│   ├── create-auth.ts
│   └── index.ts
├── user/                 # 用户模块
│   ├── user.ts           # 实体配置（mysql/mongo 等）
│   ├── create-user.ts    # POST /user/create
│   ├── update-user.ts    # POST /user/update
│   └── index.ts
└── tag/                  # 标签模块
    ├── tag.ts
    ├── create-tag.ts
    └── index.ts
```

- 目录按业务功能划分，而非按技术层（service/controller）划分。
- 路由配置集中在 `main.ts` 或独立 `router/` 目录中。
- 每个 handler 和 interceptor 都是单独文件。
