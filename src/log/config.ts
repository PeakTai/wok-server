import { isAbsolute, resolve } from 'path'
import { LogLevel, parseLogLevel } from './level'
import { config as configEnv } from 'dotenv'

/**
 * 日志配置的定义
 */
export interface LogConfig {
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
  level: LogLevel
}

configEnv()

/**
 * 默认配置信息.
 */
const config: LogConfig = {
  file: process.env.LOG_FILE === 'true',
  fileDir: process.env.LOG_FILE_DIR || 'logs',
  fileMaxDays: 30,
  level: parseLogLevel(process.env.LOG_LEVEL || 'info')
}

// 目录处理
if (!isAbsolute(config.fileDir)) {
  config.fileDir = resolve(process.cwd(), config.fileDir)
}

// 天数
if (process.env.LOG_FILE_MAX_DAYS) {
  const days = parseInt(process.env.LOG_FILE_MAX_DAYS)
  if (!isNaN(days)) {
    config.fileMaxDays = days
  }
}

export { config }
