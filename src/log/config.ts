import { isAbsolute, resolve } from 'path'
import { registerConfig } from '../config'
import { min, notBlank, notNull } from '../validation'
import { LogLevel, parseLogLevel } from './level'

/**
 * 日志配置的定义
 */
interface EnvConfig {
  /**
   * 是否输出到文件，如果为 true ，则会在根目录下生成 logs 目录存放日志文件.
   */
  file: boolean
  /**
   * 文件目录
   */
  fileDir: string
  /**
   * 文件最大保存天数.需要开启文件才有效.
   */
  fileMaxDays: number
  /**
   * 要输出的日志级别.
   */
  level: string
}

const envConfig = registerConfig<EnvConfig>(
  {
    file: false,
    fileDir: 'logs',
    fileMaxDays: 30,
    level: 'INFO'
  },
  'LOG',
  {
    file: [notNull()],
    fileDir: [notBlank()],
    fileMaxDays: [min(1)],
    level: [notBlank()]
  }
)

export type LogConfig = Omit<EnvConfig, 'level'> & { level: LogLevel }

let { fileDir, level } = envConfig
// 目录处理
if (!isAbsolute(fileDir)) {
  fileDir = resolve(process.cwd(), fileDir)
}

export const config: LogConfig = Object.freeze({
  file: envConfig.file,
  fileDir,
  fileMaxDays: envConfig.fileMaxDays,
  level: parseLogLevel(level)
})
