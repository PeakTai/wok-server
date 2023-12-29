import { equal, ok, throws } from 'assert'
import {
  ConfigException,
  ValidationException,
  max,
  maxLength,
  min,
  notBlank,
  notNull,
  registerConfig
} from '../src'
import { runTestAsync } from './utils'

describe('配置', () => {
  it(
    '环境变量配置',
    runTestAsync(async () => {
      /**
       * 配置定义，可省略
       */
      interface CustomConfig {
        appId: string
        appSecret: string
        ssl: boolean
        timeout: number
      }

      // 调用 registerConfig 与环境变量映射
      // 返回映射后的配置对象
      const config = registerConfig<CustomConfig>(
        // 第一个参数是默认的配置对象，必须要有默认
        { appId: '', appSecret: 'default', ssl: true, timeout: 3000 },
        // 第二个参数是配置前缀
        'custom',
        // 第三个参数是校验规则，可选，详细可以参照校验组件
        {
          appSecret: [notBlank()],
          ssl: [notNull()],
          timeout: [notNull(), min(1000), max(3600)]
        }
      )

      ok(config)
      equal('', config.appId)
      equal('default', config.appSecret)
      ok(config.ssl)
      equal(3000, config.timeout)

      // 设置环境变量，进行覆盖
      process.env.C2_APP_ID = 'ak123'
      process.env.C2_APP_SECRET = 'u8ujj'
      process.env.C2_SSL = 'false'
      process.env.C2_TIMEOUT = '33'
      const c2 = registerConfig<CustomConfig>(
        { appId: '', appSecret: 'default', ssl: true, timeout: 5000 },
        'c2'
      )
      ok(c2)
      equal('ak123', c2.appId)
      equal('u8ujj', c2.appSecret)
      ok(c2.ssl === false)
      equal(33, c2.timeout)

      // 校验错误测试
      process.env.C3_PROD_NAME = 'Large e-commerce platform'
      throws(
        () =>
          registerConfig({ maxElements: 1000, prodName: 'unknown' }, 'c3', {
            maxElements: [notNull(), min(1), max(2000)],
            prodName: [notBlank(), maxLength(10)]
          }),
        err => {
          ok(err instanceof ConfigException)
          return true
        }
      )
    })
  )
})
