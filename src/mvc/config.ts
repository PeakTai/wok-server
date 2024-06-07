import { generateConfig } from '../config'
import { max, min, notBlank, notNull } from '../validation'

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
  /**
   * 是否激活安全传输层
   */
  tlsEnable: boolean
  /**
   * pem 格式证书公钥文件路径
   */
  tlsCert: string
  /**
   * pem 格式证书私钥文件路径
   */
  tlsKey: string
}

export function getConfig() {
  return generateConfig<WebConfig>(
    {
      port: 8080,
      timeout: 30000,
      accessLog: false,
      corsAllowHeaders: '*',
      corsAllowMethods: '*',
      corsAllowOrigin: '*',
      tlsEnable: false,
      tlsKey: '',
      tlsCert: ''
    },
    'SERVER',
    {
      port: [notNull(), min(80), max(65535)],
      timeout: [notNull(), min(1000), max(60000)],
      accessLog: [notNull()],
      corsAllowOrigin: [notBlank()],
      corsAllowHeaders: [notBlank()],
      corsAllowMethods: [notBlank()],
      tlsEnable: [notNull()]
    }
  )
}
