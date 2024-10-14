import { getLogger } from '../log'
import { formatDateTime } from '../log/date'
import { Interceptor } from './interceptor'

/**
 * 访问日志拦截器，记录请求信息
 * @param exchange
 * @param next
 */
export const accessLogInterceptor: Interceptor = async (exchange, next) => {
  const start = new Date().getTime()
  exchange.response.once('close', () => {
    const userAgent = exchange.request.headers['user-agent']
    const referer = exchange.request.headers['referer']
    const ip = exchange.request.socket.remoteAddress
    const { url, method } = exchange.request
    const status = exchange.response.statusCode
    const rt = new Date().getTime() - start
    getLogger().info(
      `[access-log]${JSON.stringify({
        method,
        url,
        ip,
        userAgent,
        referer,
        start: formatDateTime(new Date(start)),
        rt,
        status
      })}`
    )
  })
  await next()
}
