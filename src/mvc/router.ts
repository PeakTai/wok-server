import { ServerExchange } from './exchange'

/**
 * 路由控制器函数.
 */
export interface RouterHandler {
  (exchange: ServerExchange): Promise<void>
}

/**
 * 路由列表.
 */
export type Routers = Record<string, RouterHandler>
