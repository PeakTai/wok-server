import { config } from 'dotenv'
import { validate, ValidationOpts } from '../validation'
import { convert } from './convert'
import { ConfigException } from './exception'

// 初始化 .env 文件
config()

/**
 * 环境变量配置表.
 */
const configEnvMap = new Map<string, any>()

/**
 * 获取配置
 * @param envPrefix
 */
export function getConfig<T>(envPrefix: string): T | undefined {
  return configEnvMap.get(envPrefix)
}

/**
 * 注册配置信息.
 * @param defaultConfig 默认值, 模块会根据默认值来映射环境变量，默认值所有的属性都不能是 undefined，否则无法映射.
 * @param envPrefix 环境变量前缀.
 * @param validation 校验规则，如果有值，初始化的时候会对配置进行校验
 * @returns 映射了环境变量后的配置
 */
export function registerConfig<T extends {}>(
  defaultConfig: T,
  envPrefix: string,
  validation?: ValidationOpts<T>
): T {
  if (configEnvMap.has(envPrefix)) {
    throw new ConfigException(`The prefix "${envPrefix}" has already been registered`)
  }
  const config = generateConfig(defaultConfig, envPrefix, validation)
  configEnvMap.set(envPrefix, config)
  return config
}

/**
 * 根据环境变量来生成配置对象，与 registerConfig 的参数是一致的，和 registerConfig 不同的是
 * generateConfig 可以多次重复使用，方便在运行时更改环境变量后再生成配置，而调用 registerConfig
 * 一旦注册后不能再被更改。之所以这样设计是为了方便程序的测试，模拟不同的环境来运行程序，和其它的
 * 一些特殊需求。
 * @param defaultConfig
 * @param envPrefix
 * @param validation
 */
export function generateConfig<T extends {}>(
  defaultConfig: T,
  envPrefix: string,
  validation?: ValidationOpts<T>
) {
  // 环境变量匹配
  for (const propName in defaultConfig) {
    const defaultVal = defaultConfig[propName]
    const envName = buildEnvName(envPrefix, propName)
    const envVal = process.env[envName]
    console.log(
      `[CONFIG]prefix：${envPrefix}，env variable：${envName} ,value：${envVal}，mapping property：${propName}`
    )
    if (!envVal) {
      continue
    }
    const finalVal = convert(envVal, defaultVal)
    ;(defaultConfig as any)[propName] = finalVal
  }
  // 校验
  if (validation) {
    try {
      validate(defaultConfig, validation)
    } catch (e) {
      console.error(e)
      throw new ConfigException(
        `Error in verifying configuration information, configuration prefix：${envPrefix}`
      )
    }
  }
  return defaultConfig
}

function buildEnvName(envPrefix: string, propName: string) {
  let part2 = propName.replace(/[A-Z]+/g, subStr => `_${subStr}`)
  if (part2.startsWith('_')) {
    part2 = part2.substring(1)
  }
  return `${envPrefix.toUpperCase()}_${part2.toUpperCase()}`
}

export * from './exception'
