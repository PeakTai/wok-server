import { equal } from 'assert'
import { writeFile } from 'fs/promises'
import { IncomingHttpHeaders, OutgoingHttpHeaders, request } from 'http'
import { resolve } from 'path'
import { gunzip } from 'zlib'
import { removeServerStaticCache, startWebServer, stopWebServer } from '../../src'
import { runTestAsync, sleep } from '../utils'

interface RespInfo {
  status: number
  headers: IncomingHttpHeaders
  buffer: Buffer
}
/**
 * get 请求
 * @param path
 */
async function get(path: string, headers?: OutgoingHttpHeaders): Promise<RespInfo> {
  return new Promise<RespInfo>((resolve, rej) => {
    const req = request(
      {
        hostname: 'localhost',
        port: 8080,
        path,
        method: 'GET',
        headers
      },
      res => {
        const bfs: any[] = []
        res.on('data', chunk => bfs.push(chunk))
        res.on('end', () =>
          resolve({ headers: res.headers, buffer: Buffer.concat(bfs), status: res.statusCode || 0 })
        )
      }
    )
    req.on('error', err => rej(err))
    req.end()
  })
}

describe('静态文件缓存测试', () => {
  before(
    runTestAsync(async () => {
      process.env.SERVER_TLS_ENABLE = 'false'
      // 通过环境变量启动静态缓存
      process.env.SERVER_STATIC_CACHE_ENABLE = 'true'
      process.env.SERVER_STATIC_CACHE_MAX_AGE = '5'
      process.env.SERVER_STATIC_CACHE_MAX_FILE_SIZE = '1m'
      process.env.SERVER_STATIC_CACHE_MAX_SIZE = '10m'
      await startWebServer({
        static: {
          '/': { dir: 'test/mvc/static', cacheAge: 300 }
        },
        routers: {}
      })
    })
  )
  after(
    runTestAsync(async () => {
      // 把测试文件改回去，不影响后面的测试
      await writeFile(resolve(process.cwd(), 'test/mvc/static/test1.txt'), '静态文本测试')
      await writeFile(
        resolve(process.cwd(), 'test/mvc/static/gzip-cache-test.txt'),
        '服务器缓存gzip文件测试'
      )
      await stopWebServer()
    })
  )

  // 通过修改文件来验证，响应信息使用的是缓存内容，而不是最新内容
  // 测试完成后要将文件改回去
  it(
    '静态文件缓存内容与有效期',
    runTestAsync(async () => {
      const res = await get('/test1.txt')
      const text = res.buffer.toString('utf-8')
      equal(text, '静态文本测试')
      // 再次请求应该会有缓存
      // 对文件进行修改
      const testFilePath = resolve(process.cwd(), 'test/mvc/static/test1.txt')
      await writeFile(testFilePath, '修改后的测试内容')
      // 请求到的文件内容还是老样子
      const res2 = await get('/test1.txt')
      const text2 = res2.buffer.toString('utf-8')
      equal(text2, '静态文本测试')
      // 等待缓存失效
      await sleep(6000)
      // 再获取就是新的内容
      const res3 = await get('/test1.txt')
      const text3 = res3.buffer.toString('utf-8')
      equal(text3, '修改后的测试内容')
    })
  )
  it(
    '主动删除静态文件缓存',
    runTestAsync(async () => {
      // 将文件内容重置
      const testFilePath = resolve(process.cwd(), 'test/mvc/static/test1.txt')
      await writeFile(testFilePath, '静态文本测试')
      removeServerStaticCache('/test1.txt')

      const res = await get('/test1.txt')
      const text = res.buffer.toString('utf-8')
      equal(text, '静态文本测试')
      // 再次请求应该会有缓存
      // 对文件进行修改
      await writeFile(testFilePath, '修改后的测试内容')
      // 请求到的文件内容还是老样子
      const res2 = await get('/test1.txt')
      const text2 = res2.buffer.toString('utf-8')
      equal(text2, '静态文本测试')
      // 主动清理服务器缓存
      removeServerStaticCache('/test1.txt')
      // 再获取就是新的内容
      const res3 = await get('/test1.txt')
      const text3 = res3.buffer.toString('utf-8')
      equal(text3, '修改后的测试内容')
    })
  )
  it(
    '文件缓存 gzip 测试',
    runTestAsync(async () => {
      // gzip 和 没有 gzip 缓存是不一样的，分别存储在两个不同的 key 中
      const res = await get('/gzip-cache-test.txt')
      const text = res.buffer.toString('utf-8')
      equal(text, '服务器缓存gzip文件测试')

      // 进行修改，再次获取是相同的，但是 gzip 编码的就是新的，不会共用缓存
      const testFilePath = resolve(process.cwd(), 'test/mvc/static/gzip-cache-test.txt')
      await writeFile(testFilePath, 'gzip测试新版本内容')

      const res2 = await get('/gzip-cache-test.txt')
      const text2 = res2.buffer.toString('utf-8')
      equal(text2, '服务器缓存gzip文件测试')

      const res3 = await get('/gzip-cache-test.txt', {
        'Accept-Encoding': 'gzip, deflate, br'
      })
      equal(res3.status, 200)
      const encoding = res3.headers['content-encoding']
      equal(encoding, 'gzip')
      const text3 = (await unzip(res3.buffer)).toString('utf-8')
      // gzip 编码获取的是新版本，不受前面缓存的影响
      equal(text3, 'gzip测试新版本内容')

      // 再次对文件进行修改，然后进行 gzip 编码的请求，证明 gzip 也是有缓存的
      await writeFile(testFilePath, 'gzip再次更新')
      const res4 = await get('/gzip-cache-test.txt', {
        'Accept-Encoding': 'gzip, deflate, br'
      })
      equal(res4.status, 200)
      equal(res4.headers['content-encoding'], 'gzip')
      const text4 = (await unzip(res4.buffer)).toString('utf-8')
      equal(text4, 'gzip测试新版本内容')

      // 等待缓存刷新
      await sleep(6000)
      const res5 = await get('/gzip-cache-test.txt', {
        'Accept-Encoding': 'gzip, deflate, br'
      })
      equal(res5.status, 200)
      equal(res5.headers['content-encoding'], 'gzip')
      const text5 = (await unzip(res5.buffer)).toString('utf-8')
      equal(text5, 'gzip再次更新')
    })
  )
})

function unzip(buffer: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    gunzip(buffer, (err, res2) => {
      if (err) {
        reject(err)
      } else {
        resolve(res2)
      }
    })
  })
}
