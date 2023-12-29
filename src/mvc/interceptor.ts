import { ServerExchange } from './exchange'

/**
 * 拦截器.
 */
export interface Interceptor {
  /**
   * @param exchange 传输对象，提供获取请求信息和通用的响应数据功能
   * @param next 执行后面的流程，可能是下一个拦截器，也可能是路由
   */
  (exchange: ServerExchange, next: () => Promise<void>): Promise<void>
}
