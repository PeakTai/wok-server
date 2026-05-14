# Server-Sent Events (SSE)

从 0.4.0 版本开始，MVC 组件内置了 `createSseHandler`，封装了 SSE 协议细节，大幅简化服务端推送实现。

## 内置 SSE Handler

```ts
import { createSseHandler } from 'wok-server'

await startWebServer({
  routers: {
    '/sse': createSseHandler({
      async handle(ctx) {
        let counter = 0
        for (let i = 0; i < 10; i++) {
          await new Promise<void>(resolve => setTimeout(resolve, 1000))
          counter++
          // ctx.send 自动处理 SSE 协议格式
          ctx.send({ message: '实时更新', count: counter })
          if (counter >= 10) {
            break
          }
        }
        // 显式关闭连接（不调用也会在 handle 结束时自动关闭）
        ctx.close()
      }
    })
  }
})
```

### SseContext

`handle` 函数接收的 `ctx` 对象提供以下属性与方法：

| 属性/方法                                | 说明                                                         |
| :--------------------------------------- | :----------------------------------------------------------- |
| `ctx.send(data, event?, id?)`           | 发送 SSE 事件，`data` 会被 JSON 序列化。`event` 指定事件名（前端用 `addEventListener` 监听），`id` 设置事件 ID（用于断线重连的 `Last-Event-ID`） |
| `ctx.close()`                            | 显式结束 SSE 连接。`handle` 结束时连接也会自动关闭           |
| `ctx.request`                            | 原始 `IncomingMessage`，可读取请求头等信息                   |
| `ctx.response`                           | 原始 `ServerResponse`，高级场景下使用                         |

### 命名事件

通过 `event` 参数发送命名事件，前端可按事件类型分别处理：

```ts
createSseHandler({
  async handle(ctx) {
    ctx.send({ title: '新消息' }, 'notification')
    ctx.send({ progress: 50 }, 'progress')
  }
})
```

前端：

```ts
const es = new EventSource('/sse')
es.addEventListener('notification', e => {
  const data = JSON.parse(e.data)
  console.log('收到通知：', data.title)
})
es.addEventListener('progress', e => {
  const data = JSON.parse(e.data)
  console.log('进度：', data.progress)
})
```

### 断线重连

通过 `id` 参数设置事件 ID，前端断线重连时浏览器会自动发送 `Last-Event-ID` 请求头：

```ts
createSseHandler({
  async handle(ctx) {
    const lastId = ctx.request.headers['last-event-id']
    // 根据 lastId 确定从何处恢复推送
    for (const event of events) {
      ctx.send(event, undefined, event.id)
    }
  }
})
```

### 连接生命周期

- `handle` 开始执行时，SSE 消息头已发送，连接已建立
- 客户端断开连接时，`ctx.send()` 调用变为空操作（自动忽略）
- `handle` 返回或抛异常时，连接自动关闭
- 手动调用 `ctx.close()` 可提前结束连接

---

## 手动实现（高级用法）

如需完全控制底层行为，仍可在普通路由处理器中手动操作 `response` 对象：

```ts
await startWebServer({
  routers: {
    '/sse': async exchange => {
      const { response } = exchange
      response.setHeader('Content-Type', 'text/event-stream')
      response.setHeader('Cache-Control', 'no-cache')
      response.setHeader('Connection', 'keep-alive')

      let counter = 0
      for (let i = 0; i < 10; i++) {
        await new Promise<void>(resolve => setTimeout(resolve, 1000))
        counter++
        response.write(`data: ${JSON.stringify({ message: '实时更新', count: counter })}\n\n`)
        if (counter >= 10) {
          break
        }
      }
      response.end()
    }
  }
})
```
