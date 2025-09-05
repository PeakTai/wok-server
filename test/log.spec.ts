import { equal, ok } from 'assert'
import { existsSync, readFileSync, rmSync } from 'fs'
import { EOL } from 'os'
import { resolve } from 'path'
import { formatLogText, getLogger, setLogStore } from '../src'
import { runTestAsync, sleep } from './utils'

/**
 * 构建日志文件的地址
 * @returns
 */
function buildlogFilePath() {
  const date = new Date()
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 转换为1-12
  const day = date.getDate()
  const dateKey = year * 10000 + month * 100 + day
  const fileName = `${dateKey}.log`
  return resolve(process.cwd(), 'logs', fileName)
}
/**
 * 将日志文件读取后转成成行数组
 */
function readLogFilesToLines() {
  const filePath = buildlogFilePath()
  const buffer = readFileSync(filePath, { encoding: 'utf-8' })
  const content = buffer.toString()
  const lines = content.split(EOL)
  return lines.filter(line => !!line.trim())
}

describe('日志', () => {
  before(
    runTestAsync(async () => {
      // 测试完将日志文件删除，让下面的测试重新生成内容
      // 否则在反复测试时，会影响结果的正确性
      const path = buildlogFilePath()
      if (existsSync(path)) {
        rmSync(path)
      }
    })
  )
  after(
    runTestAsync(async () => {
      // 测试完将日志文件删除，否则在反复测试时，会影响结果的正确性
      rmSync(buildlogFilePath())
    })
  )
  it(
    '日志基本测试',
    runTestAsync(async () => {
      const logger = getLogger('测试')
      ok(logger.isInfoEnabled())
      ok(logger.isWarnEnabled())
      ok(logger.isErrorEnabled())
      ok(!logger.isDebugEnabled())
      logger.debug('debug 级别信息')
      logger.info('info 级别日志信息')
      logger.warn('warn 级别日志信息')
      logger.error('error 级别日志信息')
      logger.error('异常对象信息', new Error('错误测试'))
      // 由于文件的写入是异步的，这里等待一段时间
      await sleep(1000)
      // 由于日志设置的级别是 info ,所以 debug 应该不会输出，可以通过文件来验证
      const lines = readLogFilesToLines()
      // 输出的日志会带有日期信息，示例：
      // [2023/09/27 14:27:32.399][INFO]info 级别日志信息
      // 验证结尾即可
      ok(lines[0].endsWith('info 级别日志信息'))
      ok(lines[1].endsWith('warn 级别日志信息'))
      ok(lines[2].endsWith('error 级别日志信息'))
      // debug 日志不会被包含
      ok(!lines.some(line => line.includes('debug 级别信息')))

      // 自定义存储
      const msgs: string[] = []
      setLogStore(log => msgs.push(formatLogText(log)))
      logger.info('第一条')
      logger.warn('第二条')
      logger.debug('第三条')
      logger.error('第四条', '出错了')
      // console.log('自定义日志存储收集的内容', msgs)
      // 再次读取日志文件，由于设置了自定义存储，不会再输出到文件中了
      const lines2 = readLogFilesToLines()
      equal(lines2.length, lines.length)
      ok(msgs[0].endsWith('第一条'))
      ok(msgs[1].endsWith('第二条'))
      // debug 级别不会出现
      ok(!msgs[2].endsWith('第三条'))
      ok(msgs[2].includes('第四条'))
      ok(msgs[2].endsWith('出错了'))
    })
  )
})
