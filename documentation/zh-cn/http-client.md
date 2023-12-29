# HTTP 客户端

HTTP 客户端是基于 Nodejs 内置的 http 和 https 模块封装的 http 请求发送工具，
提供了三个函数。

| 函数      | 作用                                     |
| :-------- | :--------------------------------------- |
| doRequest | 通用的 http 请求，可以自定义各种选项     |
| postJson  | 发送 post 请求，获取 json 格式的响应数据 |
| getJson   | 发送 get 请求，获取 json 格式的响应数据  |

## 使用示例

```ts
// get 请求 json
const list = await getJson<User[]>({
  url: '/users'
})

// post 请求 json
const res = await postJson<Result>({
  url: '/data/save',
  body: { name: 'jack', age: 33 }
})

// 使用 doRequest，自定义更多的选项
await doRequest({
  url: '/users/001',
  method: 'DELETE',
  timeout: 5000,
  followRedirect: true
})
```
