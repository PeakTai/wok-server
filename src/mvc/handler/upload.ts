import { IncomingHttpHeaders } from 'http'
import { ServerExchange } from '../exchange'
import { QueryString } from '../query'
import { RouterHandler } from '../router'

/**
 * 上传请求传输对象.
 */
export interface UploadRouterExchange {
  /**
   * 请求地址
   */
  url: string
  /**
   * 请求头
   */
  headers: IncomingHttpHeaders
  /**
   * querystring 解析结果
   */
  query: QueryString
}

/**
 * 创建上传处理器. 上传要求一次只能传输一个文件，并且请求正文就是文件二进制内容。
 * 必须是 post 请求，额外的参数只能通过 queryString 或 header 来传递。
 * 和 postman 中的 binary 模式是一致的，这样上传文件性能会好一些，但是局限性也很大。
 *
 * @param opts
 * @param <RES> 响应json数据类型
 * @returns
 */
export function createUploadHandler<RES = void>(opts: {
  /**
   * 处理请求.
   * @param body 正文内容
   * @param exchange 请求传输对象，用于获取请求的基本信息
   * @returns
   */
  handle: (body: Buffer, exchange: UploadRouterExchange) => Promise<RES>
}): RouterHandler {
  return async function (exchange: ServerExchange) {
    if (!exchange.request.method || exchange.request.method.toUpperCase() !== 'POST') {
      exchange.respondErrMsg('Method Not Allowed', 405)
      return
    }
    const body = await exchange.bodyBuffer()
    const { url, headers } = exchange.request
    const res = await opts.handle(body, {
      url: url || '',
      headers,
      query: exchange.parseQueryString()
    })
    if (!res) {
      exchange.respond({ statusCode: 200 })
      return
    }
    exchange.respondJson(res)
  }
}
