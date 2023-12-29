import { getI18n } from '../../i18n'
import { validate, ValidationOpts } from '../../validation'
import { ServerExchange } from '../exchange'
import { RouterHandler } from '../router'

/**
 * 创建 json 处理器..
 * @param <REQ> 表示请求的 json 数据格式类型
 * @param <RES> 表示响应的类型，可选，如果不需要响应 json 数据，则方法可以不返回任何值
 * @param opts
 * @returns
 */
export function createJsonHandler<REQ, RES = void>(opts: {
  /**
   * 校验信息，可选，用于检查请求信息.对于一些特殊情况，无法使用校验器的，可以在 handle 中继续处理.
   */
  validation?: ValidationOpts<REQ>
  /**
   * 处理请求.
   * @param body 正文内容
   * @param exchange 请求传输对象，用于获取请求的基本信息
   * @returns
   */
  handle: (body: REQ, exchange: ServerExchange) => Promise<RES>
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
      validate(body, opts.validation)
    }
    const res = await opts.handle(body, exchange)
    if (!res) {
      exchange.respond({ statusCode: 200 })
      return
    }
    exchange.respondJson(res)
  }
}
