---
name: wok-server-mvc
description: wok-server MVC 组件使用指南，基于 Node.js http 模块，提供路由、拦截器、JSON/上传处理器等。
license: MIT
metadata:
  author: Peak Tai
  email: peaktai@qq.com
---

# wok-server MVC 组件

## 概述

MVC 组件基于 Node.js 内置 `http` 模块封装，提供 HTTP 服务构建能力。核心概念：路由（Router）、拦截器（Interceptor）、处理器（Handler）。

## 源码与类型定义

安装 `wok-server` 后，可通过以下路径查看源码与类型定义：

- 源码目录：`node_modules/wok-server/src/mvc/`
- 类型定义：`node_modules/wok-server/types/` （引用 mvc 组件的 `.d.ts` 文件）

核心源码文件：

| 文件               | 说明                               |
| :----------------- | :--------------------------------- |
| `index.ts`         | 模块入口，`startWebServer`/`stopWebServer` |
| `server.ts`        | `WokServer` 类，HTTP/HTTPS 服务实现 |
| `router.ts`        | `RouterHandler` 类型与 `Routers` 定义 |
| `exchange.ts`      | `ServerExchange` 数据交换对象       |
| `config.ts`        | 服务配置（端口、超时、CORS、TLS 等）|
| `interceptor.ts`   | `Interceptor` 拦截器接口            |
| `handler/json.ts`  | `createJsonHandler` JSON 处理器     |
| `handler/upload.ts`| `createUploadHandler` 二进制上传      |
| `handler/sse.ts`   | `createSseHandler` SSE 服务端推送      |
| `handler/restful.ts`| `restful` 方法分派函数             |
| `handler/index.ts` | 处理器模块聚合导出                  |
| `query.ts`         | `QueryString` 查询字符串解析        |
| `static/`          | 静态文件服务                        |

---

## 环境变量

| 环境变量                   | 说明                | 默认值 |
| :------------------------- | :------------------ | :----- |
| `SERVER_PORT`              | 端口号              | 8080   |
| `SERVER_TIMEOUT`           | 超时时间（ms）      | 30000  |
| `SERVER_ACCESS_LOG`        | 是否启用访问日志    | false  |
| `SERVER_CORS_ALLOW_ORIGIN` | CORS 允许的源域名   | *      |
| `SERVER_CORS_ALLOW_HEADERS`| CORS 允许的消息头   | *      |
| `SERVER_CORS_ALLOW_METHODS`| CORS 允许的请求方法 | *      |

---

## 启动与停止

```ts
import { startWebServer, stopWebServer } from 'wok-server'

await startWebServer({
  routers: { '/': async exchange => exchange.respondText('Hello') }
})

await stopWebServer()
```

服务全局单例，重复启动抛异常。进程退出前自动停止。

---

## 路由

路由是 `Record<string, RouterHandler>`，key 为路径，value 为异步处理函数。**仅支持明确地址，不支持动态路径（如 `/users/:id`）**。

```ts
import { RouterHandler } from 'wok-server'

const myHandler: RouterHandler = async exchange => {
  const body = await exchange.bodyJson()
  exchange.respondJson({ ok: true })
}
```

特殊路径 `'*'` 匹配所有未命中请求，用于自定义 404。

### ServerExchange

路由处理函数的参数，提供请求读取与响应方法：

```ts
// 读取请求
exchange.request.method          // 请求方法
exchange.request.url             // 请求 URL
exchange.request.headers         // 消息头
exchange.parseQueryString()      // 解析 QueryString → QueryString 对象

// 读取正文
const body = await exchange.bodyBuffer()     // Buffer
const text = await exchange.bodyText()       // string
const json = await exchange.bodyJson<T>()    // T

// 响应
exchange.respondText('text', 200)
exchange.respondJson({ ok: true }, 200)
exchange.respondErrMsg('错误信息', 400)       // JSON 格式: { message }
exchange.respondFile('/abs/path/to/file')
exchange.respondHtml('<h1>Hi</h1>', 200)
exchange.respond({ statusCode: 200, body: 'raw', headers: { ... } })
```

---

## 拦截器

类型 `Interceptor: (exchange, next) => Promise<void>`。按数组中顺序执行，调用 `next()` 继续下一拦截器或路由。

```ts
const authInterceptor: Interceptor = async (exchange, next) => {
  const token = exchange.request.headers.authorization
  if (!token) {
    exchange.respondErrMsg('Unauthorized', 401)
    return
  }
  await next()
}
```

典型用途：授权校验、异常统一处理、CORS 预检等。服务选项中 `SERVER_ACCESS_LOG=true` 会自动注入访问日志拦截器（位于最前）。

---

## JSON 请求处理器

`createJsonHandler<REQ, RES>` 封装了请求正文 JSON 解析、校验、i18n 语言切换、响应缓存等常见流程：

```ts
import { createJsonHandler, notBlank, length } from 'wok-server'

interface Form { code: string; nickname: string }
interface Resp { id: string }

const createUser = createJsonHandler<Form, Resp>({
  validation: {
    code: [notBlank(), length({ max: 64 })],
    nickname: [notBlank(), length({ max: 64 })]
  },
  async handle(body, exchange) {
    const newUser = await insertUser(body)
    return { id: newUser.id }
  }
})
```

- 仅处理 POST 请求，非 POST 返 405
- `validation` 可选，校验前自动通过 `accept-language` 切换校验器语言
- 支持 `validation` 为函数以动态生成规则
- `cache` 可选，设置后通过缓存组件缓存 `Buffer` 格式的响应（避免重复序列化）

---

## 文件上传

`createUploadHandler<RES>` 处理 `application/octet-stream` 格式的二进制文件上传，比 multipart/form-data 更简单高效。也支持通过第三方库（如 formidable）处理 multipart/form-data 格式。

详见：[文件上传](references/upload.md)

---

## Restful 方法分派

```ts
import { restful } from 'wok-server'

routers: {
  '/users': restful({
    get: async exchange => { /* 查列表 */ },
    post: async exchange => { /* 创建 */ },
    delete: async exchange => { /* 删除 */ }
  })
}
```

---

## 响应 HTML

`exchange.respondHtml()` 支持两种方式：内置 `HtmlStuct` 结构化构建（提供 `HtmlTag` 类型推断，支持动态渲染），或直接传入第三方模板引擎（Handlebars、Vue SSR 等）渲染后的 HTML 字符串。

详见：[响应 HTML](references/respond-html.md)

---

## SSE 服务端推送

`createSseHandler` 封装了 Server-Sent Events 协议细节，通过 `ctx.send()` 即可推送数据，支持命名事件和断线重连。

详见：[Server-Sent Events](references/sse.md)

---

## 静态文件

通过 `static` 参数设置静态文件目录映射，支持前缀匹配、主页自动映射和服务器端缓存。

详见：[静态文件](references/static-files.md)

---

## TLS / HTTPS

```bash
SERVER_TLS_ENABLE=true
SERVER_TLS_KEY=/path/to/key.pem
SERVER_TLS_CERT=/path/to/cert.pem
```

---

## 内部实现要点

### 请求处理流程

```
请求到达 → WokServer.handleRequest()
  → 依次执行拦截器链（含可选的 accessLogInterceptor、CORS 处理）
  → 路由匹配（精确匹配，未命中使用 '*' handler）
  → 未捕获异常统一响应 500
```

### ServerExchange

封装 `IncomingMessage` 和 `ServerResponse`。`bodyBuffer()` 内部有缓存，多次调用只读一次流。`bodyJson` 空正文返回 `{}`。

### createJsonHandler 缓存

缓存值为 `Buffer`（序列化后的 JSON），直接 `response.end(buffer)` 避免重复 `JSON.stringify`。`cache` 函数返回 `{ key, expiresInSeconds }`，存入缓存组件。

---

## 参考文档

以下为扩展功能的详细参考文档：

| 文档                                          | 说明                     |
| :-------------------------------------------- | :----------------------- |
| [文件上传](references/upload.md)                         | 二进制上传与 multipart/form-data |
| [响应 HTML](references/respond-html.md)                 | 内置结构化构建与第三方模板引擎 |
| [静态文件](references/static-files.md)                   | 静态文件目录映射与缓存   |
| [WebSocket](references/websocket.md)                     | 通过 socket.io 集成 WebSocket |
| [Server-Sent Events](references/sse.md)                  | `createSseHandler` 服务端推送 |
