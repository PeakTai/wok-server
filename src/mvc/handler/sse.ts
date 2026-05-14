import { IncomingMessage, ServerResponse } from 'http'
import { ServerExchange } from '../exchange'
import { RouterHandler } from '../router'

export interface SseContext {
  /**
   * 请求信息
   */
  readonly request: IncomingMessage
  /**
   * 响应信息
   */
  readonly response: ServerResponse
  /**
   * 发送 SSE 事件
   * @param data 事件数据，会被 JSON 序列化
   * @param event 事件名称，可选。前端可通过 addEventListener 监听
   * @param id 事件 ID，可选。用于断线重连时的 Last-Event-ID
   */
  send(data: any, event?: string, id?: string): void
  /**
   * 结束 SSE 连接
   */
  close(): void
}

/**
 * 创建 SSE (Server-Sent Events) 处理器.
 * 用于服务端向客户端单向推送实时数据。
 *
 * @param opts
 * @returns
 */
export function createSseHandler(opts: {
  handle: (ctx: SseContext) => Promise<void>
}): RouterHandler {
  return async function (exchange: ServerExchange) {
    const { request, response } = exchange

    response.statusCode = 200
    response.setHeader('Content-Type', 'text/event-stream')
    response.setHeader('Cache-Control', 'no-cache')
    response.setHeader('Connection', 'keep-alive')
    response.setHeader('X-Accel-Buffering', 'no')
    response.flushHeaders()

    let isEnded = false

    const ctx: SseContext = {
      request,
      response,
      send(data: any, event?: string, id?: string) {
        if (isEnded) return
        if (id !== undefined) {
          response.write(`id: ${id}\n`)
        }
        if (event) {
          response.write(`event: ${event}\n`)
        }
        if (Array.isArray(data)) {
          for (const item of data) {
            response.write(`data: ${JSON.stringify(item)}\n`)
          }
        } else {
          response.write(`data: ${JSON.stringify(data)}\n`)
        }
        response.write('\n')
      },
      close() {
        if (isEnded) return
        isEnded = true
        response.end()
      }
    }

    function safeEnd() {
      if (isEnded) return
      isEnded = true
      response.end()
    }

    request.on('close', safeEnd)

    try {
      await opts.handle(ctx)
    } finally {
      safeEnd()
    }
  }
}
