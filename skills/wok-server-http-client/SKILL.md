---
name: wok-server-http-client
description: wok-server HTTP 客户端组件使用指南，基于 Node.js 内置 http/https 模块封装的请求工具。
license: MIT
metadata:
  author: Peak Tai
  email: peaktai@qq.com
---

# wok-server HTTP 客户端

## 概述

HTTP 客户端基于 Node.js 内置 `http` 和 `https` 模块封装，提供三个函数：`doRequest`（通用请求）、`postJson`（JSON 响应 POST）、`getJson`（JSON 响应 GET）。支持自动 HTTPS、重定向跟随、超时控制。

## 源码与类型定义

安装 `wok-server` 后，可通过以下路径查看源码与类型定义：

- 源码目录：`node_modules/wok-server/src/http-client/`
- 类型定义：`node_modules/wok-server/types/` （引用 http-client 组件的 `.d.ts` 文件）

核心源码文件：

| 文件            | 说明                               |
| :-------------- | :--------------------------------- |
| `index.ts`      | `doRequest`、`postJson`、`getJson`  |

---

## 三个函数

| 函数        | 作用                                   |
| :---------- | :------------------------------------- |
| `doRequest` | 通用 HTTP 请求，自定义所有选项          |
| `postJson`  | POST 请求 + JSON 响应，自动序列化 body  |
| `getJson`   | GET 请求 + JSON 响应，默认跟随重定向    |

---

## getJson — GET JSON 请求

```ts
function getJson<T>(
  opts: { url: string; query?: Record<string, string[] | string>; headers?: IncomingHttpHeaders; timeout?: number }
): Promise<T>
```

- 自动跟随重定向（`followRedirect: true`）
- 状态码非 200 抛异常（含响应体前 1024 字节）
- 空响应体返回 `{}`

```ts
import { getJson } from 'wok-server'

const list = await getJson<User[]>({
  url: 'https://api.example.com/users',
  query: { status: 'active' },
  headers: { 'Authorization': 'Bearer xxx' },
  timeout: 3000
})
```

---

## postJson — POST JSON 请求

```ts
function postJson<T>(
  opts: { url: string; body: any; query?: Record<string, string[] | string>; headers?: IncomingHttpHeaders; timeout?: number }
): Promise<T>
```

- 自动设置 `Content-Type: application/json; charset=utf-8`
- 自动将 `body` 序列化为 JSON 字符串
- 不跟随重定向（`followRedirect: false`）
- 状态码非 200 抛异常

```ts
import { postJson } from 'wok-server'

const res = await postJson<{ id: string }>({
  url: 'https://api.example.com/users',
  body: { name: 'jack', age: 33 },
  timeout: 5000
})
```

---

## doRequest — 通用请求

```ts
function doRequest(opts: HttpRequestOpts): Promise<HttpResponseInfo>
```

完整选项：

| 选项             | 类型                                              | 说明                                   |
| :--------------- | :------------------------------------------------ | :------------------------------------- |
| `url`            | `string`                                          | 请求地址（支持 `http://` 和 `https://`） |
| `method`         | `GET \| POST \| PUT \| DELETE \| ...`             | 请求方法                               |
| `body`           | `string \| Buffer`                                | 请求正文（可选）                       |
| `query`          | `Record<string, string \| string[]>`              | 查询参数，自动拼接 URL（可选）         |
| `headers`        | `IncomingHttpHeaders`                             | 自定义消息头（可选）                   |
| `timeout`        | `number`                                          | 超时时间（ms），默认 5000              |
| `followRedirect` | `boolean`                                         | 是否跟随重定向（301/302/303/307/308）  |

返回值 `HttpResponseInfo`：

```ts
interface HttpResponseInfo {
  status: number
  headers: IncomingHttpHeaders
  body: Buffer
}
```

示例：

```ts
import { doRequest } from 'wok-server'

// DELETE 请求
const res = await doRequest({
  url: 'https://api.example.com/users/001',
  method: 'DELETE',
  timeout: 5000
})

// 带查询参数
const res2 = await doRequest({
  url: 'https://api.example.com/search',
  method: 'GET',
  query: { keyword: 'test', tags: ['a', 'b'] }
})

// 跟随重定向
const res3 = await doRequest({
  url: 'https://short.link/abc',
  method: 'GET',
  followRedirect: true
})
```

---

## 内部实现要点

### URL 解析

使用 Node.js 内置 `URL` 类解析，根据 `protocol` 自动选择 `http.request` 或 `https.request`。`query` 通过 `url.searchParams.append` 拼接（支持 `string` 和 `string[]`）。

### 重定向

`doRequest` 中检测 301/302/303/307/308 状态码时，取 `location` 头作为新 URL 递归调用。递归只进行一次（二次请求强制 `followRedirect: false`），防止死循环。

### 超时

通过 `req.on('timeout', ...)` 处理超时，timeout 默认为 5000ms。也可以传入自定义值，`<=0` 视为无效使用默认值。

### HTTPS

`rejectUnauthorized: false`，不验证服务端证书，适用于自签名证书场景。
