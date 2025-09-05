import { existsSync, statSync } from 'fs'
import { readdir, rm, appendFile, mkdir } from 'fs/promises'
import { EOL } from 'os'
import { dirname, resolve, isAbsolute } from 'path'
import { config, LogConfig } from './config'
import { formatLogJson, formatLogText, Log } from './log'

// 日志队列
let LOG_QUEUE: Log[] = []
// 最大缓冲数量
const MAX_QUEUE_SIZE = 1024
// 写入定时器
let WRITE_TIMER: NodeJS.Timeout | null = null
// 延迟写入时间（毫秒）
const WRITE_DELAY = 100
// 是否已经安排了清理任务
let CLEANUP_SCHEDULED = false
// 清理任务定时器
let CLEANUP_TIMER: NodeJS.Timeout | null = null

/**
 * 文件存储.
 * @param log 日志对象
 * @param logConfig 日志配置
 */
export function fileStore(log: Log, logConfig: LogConfig): void {
  // 将日志添加到队列
  LOG_QUEUE.push(log)

  // 如果队列超过最大缓冲数量，立即写入
  if (LOG_QUEUE.length >= MAX_QUEUE_SIZE) {
    writeLogs(logConfig).catch(e => console.error('Writing log file failed', e))

    // 在写入前检查是否需要安排清理任务
    if (!CLEANUP_SCHEDULED) {
      scheduleCleanupTask(logConfig)
    }
    return
  }

  // 安排延迟写入
  if (!WRITE_TIMER) {
    WRITE_TIMER = setTimeout(() => {
      WRITE_TIMER = null
      writeLogs(logConfig).catch(e => console.error('Writing log file failed', e))
    }, WRITE_DELAY)
  }

  // 如果启用了文件存储并且还没有安排清理任务，则安排清理任务
  if (!CLEANUP_SCHEDULED) {
    scheduleCleanupTask(logConfig)
  }
}

/**
 * 根据日期构建日志文件路径
 * @param logConfig 日志配置
 * @param dateKey 数字键 (格式：年*10000 + 月*100 + 日)
 * @returns 日志文件路径
 */
function buildFilePathByDate(logConfig: LogConfig, dateKey: number): string {
  const fileName = `${dateKey}.log`
  // 确保目录是绝对路径
  let fileDir = logConfig.fileDir
  if (!isAbsolute(fileDir)) {
    fileDir = resolve(process.cwd(), fileDir)
  }
  return resolve(fileDir, fileName)
}

/**
 * 根据日期对象计算数字键
 * @param date 日期对象
 * @returns 数字键 (格式：年*10000 + 月*100 + 日)
 */
function calculateDateKey(date: Date): number {
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 转换为1-12
  const day = date.getDate()
  return year * 10000 + month * 100 + day
}

/**
 * 写入日志到文件
 * @param logConfig 日志配置
 */
async function writeLogs(logConfig: LogConfig): Promise<void> {
  if (!LOG_QUEUE.length || !logConfig.file) {
    return
  }

  // 复制队列并清空原始队列
  const logsToWrite = [...LOG_QUEUE]
  LOG_QUEUE = []

  // 按日期对日志进行分组 - 使用数字键提升性能
  const logsByDate = new Map<number, Log[]>()

  logsToWrite.forEach(log => {
    const logDate = new Date(log.time)
    // 直接使用日期对象计算数字键
    const dateKey = calculateDateKey(logDate)
    const dateLogs = logsByDate.get(dateKey)
    if (dateLogs) {
      dateLogs.push(log)
    } else {
      logsByDate.set(dateKey, [log])
    }
  })

  // 为每个日期组写入对应的日志文件
  for (const [dateKey, dateLogs] of logsByDate.entries()) {
    // 直接使用数字键构建文件路径
    const filePath = buildFilePathByDate(logConfig, dateKey)
    const dir = dirname(filePath)

    // 确保目录存在
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }

    // 格式化并写入该日期的所有日志
    const lines = dateLogs
      .map(log => (logConfig.format === 'json' ? formatLogJson(log) : formatLogText(log)))
      .join(EOL)

    try {
      await appendFile(filePath, lines)
    } catch (error) {
      console.error(`Failed to write logs for date ${dateKey}:`, error)
      // 继续处理下一个日期的日志，不中断整个写入过程
    }
  }
}

/**
 * 执行日志清理任务
 * @param logConfig 日志配置
 */
async function performCleanupTask(logConfig: LogConfig): Promise<void> {
  try {
    let dir = logConfig.fileDir
    if (!isAbsolute(dir)) {
      dir = resolve(process.cwd(), dir)
    }

    // 确保目录存在
    if (!existsSync(dir)) {
      return
    }

    const files = await readdir(dir)
    const now = new Date().getTime()
    const maxAge = logConfig.fileMaxDays * 24 * 3600 * 1000

    for (const file of files) {
      try {
        // 获取文件的完整路径
        const filePath = resolve(dir, file)

        // 获取文件的最后修改时间
        const fileStats = statSync(filePath)
        const lastModifiedTime = fileStats.mtime.getTime()

        // 检查文件是否过期（最后修改时间早于最大保留天数）
        if (lastModifiedTime + maxAge < now) {
          console.warn(`Remove log file： ${file}`)
          await rm(filePath)
        }
      } catch (error) {
        console.error(`Failed to process log file ${file}:`, error)
        // 继续处理下一个文件，不中断清理过程
        continue
      }
    }
  } catch (error) {
    console.error('Error during log cleanup:', error)
  } finally {
    // 清理完成后，重置清理任务安排状态
    CLEANUP_SCHEDULED = false
  }
}

/**
 * 安排日志清理任务
 * @param logConfig 日志配置
 */
function scheduleCleanupTask(logConfig: LogConfig): void {
  CLEANUP_SCHEDULED = true

  // 清除现有的清理定时器
  if (CLEANUP_TIMER) {
    clearTimeout(CLEANUP_TIMER)
  }

  // 设置清理任务在一天后执行
  const delay = 24 * 60 * 60 * 1000
  CLEANUP_TIMER = setTimeout(() => {
    CLEANUP_TIMER = null
    performCleanupTask(logConfig).catch(e => console.error('Cleanup task failed', e))
  }, delay)
}

/**
 * 确保所有日志都被写入文件
 * 可以在应用程序关闭时调用
 */
export async function flushLogsToFile(): Promise<void> {
  if (WRITE_TIMER) {
    clearTimeout(WRITE_TIMER)
    WRITE_TIMER = null
  }

  await writeLogs(config)
}
