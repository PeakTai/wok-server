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
  const userAgent = exchange.request.headers['user-agent']
  const ip = exchange.request.socket.remoteAddress
  const { url, method } = exchange.request
  exchange.response.once('close', () => {
    const status = exchange.response.statusCode
    const rt = new Date().getTime() - start
    getLogger().info(
      `[access-log]${JSON.stringify({
        method,
        url,
        ip,
        userAgent,
        start: formatDateTime(new Date(start)),
        rt,
        status
      })}`
    )
  })
  await next()
}
