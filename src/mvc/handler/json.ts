import { IncomingMessage } from 'http'
import { getCache } from '../../cache'
import { getI18n } from '../../i18n'
import { validate, ValidationOpts } from '../../validation'
import { ServerExchange } from '../exchange'
import { RouterHandler } from '../router'

export interface JsonHandlerExchange {
  /**
   * 请求信息
   */
  request: IncomingMessage
}

/**
 * 创建 json 处理器..
 * @param <REQ> 表示请求的 json 数据格式类型
 * @param <RES> 表示响应的类型，可选，如果不需要响应 json 数据，则方法可以不返回任何值
 * @param opts
 * @returns
 */
export function createJsonHandler<REQ, RES = void>(opts: {
  /**
   * 缓存设置，通过框架的 cache 模块来缓存响应信息，只能缓存有效的响应信息，如果没有响应正文则不会进行缓存,
   * 参数和 handle 是一样的
   * @param body
   * @param exchange
   * @returns 返回缓存的 key 和缓存秒数
   */
  cache?: (
    body: REQ,
    exchange: JsonHandlerExchange
  ) =>
    | Promise<{ key: string; expiresInSeconds?: number }>
    | { key: string; expiresInSeconds?: number }
  /**
   * 校验信息，可选，用于检查请求信息.对于一些特殊情况，无法使用校验器的，可以在 handle 中继续处理.
   */
  validation?: ValidationOpts<REQ> | (() => ValidationOpts<REQ>)
  /**
   * 处理请求.
   * @param body 正文内容
   * @param exchange 请求传输对象，用于获取请求的基本信息
   * @returns
   */
  handle: (body: REQ, exchange: JsonHandlerExchange) => Promise<RES>
}): RouterHandler {
  return async function (exchange: ServerExchange) {
    if (!exchange.request.method || exchange.request.method.toUpperCase() !== 'POST') {
      exchange.respondErrMsg('Method Not Allowed', 405)
      return
    }
    const body: REQ = await exchange.bodyJson()
    if (opts.validation) {
      // 切换语言
      getI18n().switchByRequest(exchange.request.headers)
      if (typeof opts.validation === 'function') {
        validate(body, opts.validation())
      } else {
        validate(body, opts.validation)
      }
    }
    // 缓存处理
    if (opts.cache) {
      const cacheInfo = await opts.cache(body, exchange)
      const buffer = getCache().get(cacheInfo.key)
      if (buffer && buffer instanceof Buffer) {
        renderJsonBuffer(exchange, buffer)
      } else {
        const res = await opts.handle(body, { request: exchange.request })
        if (!res) {
          // 无结果不缓存
          exchange.respond({ statusCode: 200 })
          return
        }
        const buffer = Buffer.from(JSON.stringify(res), 'utf-8')
        getCache().put(cacheInfo.key, buffer, cacheInfo.expiresInSeconds)
        renderJsonBuffer(exchange, buffer)
      }
      return
    }
    const res = await opts.handle(body, { request: exchange.request })
    if (!res) {
      exchange.respond({ statusCode: 200 })
      return
    }
    exchange.respondJson(res)
  }
}

function renderJsonBuffer(exchange: ServerExchange, buffer: Buffer) {
  const { response } = exchange
  response.setHeader('content-type', 'application/json; charset=UTF-8')
  response.statusCode = 200
  response.end(buffer)
}
