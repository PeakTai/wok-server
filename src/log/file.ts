import { appendFileSync, existsSync, mkdirSync } from 'fs'
import { readdir, rm } from 'fs/promises'
import { EOL } from 'os'
import { dirname, resolve } from 'path'
import { scheduleDailyTask } from '../task'
import { config } from './config'

let QUEUE: string[] = []

/**
 * 文件存储.
 * @param log
 */
export function fileStore(log: string): void {
  QUEUE.push(log)
  setTimeout(() => {
    try {
      write()
    } catch (e) {
      console.error('Writing log file failed', e)
    }
  }, 0)
}

function buildFilePath() {
  const date = new Date()
  let fileName = `${date.getFullYear()}-`
  const month = date.getMonth() + 1
  fileName += month.toFixed(0).padStart(2, '0')
  fileName += '-'
  const day = date.getDate()
  fileName += day.toFixed(0).padStart(2, '0')
  fileName += '.log'
  return resolve(config.fileDir, fileName)
}

function write() {
  if (!QUEUE.length) {
    return
  }
  const path = buildFilePath()
  const dir = dirname(path)
  if (!existsSync(dir)) {
    mkdirSync(dir)
  }
  const lines = QUEUE.join(EOL)
  appendFileSync(path, lines)
  QUEUE = []
}

if (config.file) {
  /**
   * 清理任务.
   */
  scheduleDailyTask(3, 0, {
    name: 'Log files clear',
    async run() {
      const files = await readdir(config.fileDir)
      const now = new Date().getTime()
      for (const file of files) {
        const dotIdx = file.indexOf('.')
        if (dotIdx === -1) {
          console.warn(`Unable to process the log file: ${file}`)
          return
        }
        const dateStr = file.substring(0, dotIdx)
        const timestamp = Date.parse(dateStr)
        if (isNaN(timestamp)) {
          console.warn(`Unable to process the log file: ${file}`)
          return
        }
        if (timestamp + config.fileMaxDays * 24 * 3600 * 1000 < now) {
          console.warn(`Remove log file： ${file}`)
          await rm(resolve(config.fileDir, file))
        }
      }
    }
  })
}
