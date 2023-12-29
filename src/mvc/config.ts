import { registerConfig } from '../config'
import { length, max, min, notBlank, notNull } from '../validation'

/**
 * mvc 模块配置.
 */
export interface WebConfig {
  /**
   * 端口号
   */
  port: number
  /**
   * 超时时间
   */
  timeout: number
  /**
   * 是否开启访问日志.
   */
  accessLog: boolean
  /**
   * 跨域允许的源域名
   */
  corsAllowOrigin: string
  /**
   * 跨域允许的消息头
   */
  corsAllowHeaders: string
  /**
   * 跨域允许的请求方法
   */
  corsAllowMethods: string
}

export const config = registerConfig<WebConfig>(
  {
    port: 8080,
    timeout: 30000,
    accessLog: false,
    corsAllowHeaders: '*',
    corsAllowMethods: '*',
    corsAllowOrigin: '*'
  },
  'SERVER',
  {
    port: [notNull(), min(80), max(65535)],
    timeout: [notNull(), min(1000), max(60000)],
    accessLog: [notNull()],
    corsAllowOrigin: [notBlank()],
    corsAllowHeaders: [notBlank()],
    corsAllowMethods: [notBlank()]
  }
)
