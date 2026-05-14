# WebSocket

MVC 组件本身未内置 WebSocket 处理，但通过 `startWebServer` 的 `preHandler` 参数可整合支持原生 `http` 模块的 WebSocket 库（如 socket.io）。

`preHandler` 在服务启动前执行，接收原生 `http.Server` 实例，可在此时挂载 WebSocket 服务。

```ts
import { Server } from 'socket.io'

await startWebServer({
  routers: {
    // 路由配置省略...
  },
  preHandler: async server => {
    const io = new Server(server)
    io.of('/chat').on('connection', socket => {
      socket.on('message', data => {
        /* 处理自定义事件 */
      })
      socket.on('disconnect', () => {
        /* 连接断开处理 */
      })
    })
  }
})
```

### 注意事项

- WebSocket 路径（如 `/chat`）与路由路径不会冲突。客户端以 HTTP 协议请求时走路由处理，以 WebSocket 协议请求时走 socket.io 处理。但不推荐使用相同的路径。
