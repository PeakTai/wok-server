import { IncomingHttpHeaders, OutgoingHttpHeaders, request } from 'http'
import { startWebServer, stopWebServer } from '../../src'
import { assertAsyncThrows, runTestAsync } from '../utils'
import { equal, ok } from 'assert'
import { resolve } from 'path'

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

describe('静态文件测试2', () => {
  it(
    '静态配置校验测试',
    runTestAsync(async () => {
      process.env.SERVER_TLS_ENABLE = 'false'
      process.env.SERVER_STATIC_CACHE_ENABLE = 'false'
      // 重复路径
      await assertAsyncThrows({
        run: () =>
          startWebServer({
            static: {
              a: { dir: 'test/mvc/static' },
              '/a': { dir: 'test/mvc/static' }
            },
            routers: {}
          }),
        assert(err) {
          ok(err instanceof Error)
          equal(err.message, 'Static path duplicated: a and /a')
        }
      })
      await assertAsyncThrows({
        run: () =>
          startWebServer({
            static: {
              '/a': { dir: 'test/mvc/static' },
              '/a/': { dir: 'test/mvc/static' }
            },
            routers: {}
          }),
        assert(err) {
          ok(err instanceof Error)
          equal(err.message, 'Static path duplicated: /a and /a/')
        }
      })
      // 目录不存在
      await assertAsyncThrows({
        run: () =>
          startWebServer({
            static: {
              '/xyz': { dir: 'test/mvc/xyz' }
            },
            routers: {}
          }),
        assert(err) {
          ok(err instanceof Error)
          equal(
            err.message,
            `Static file configuration error，path ${resolve(
              process.cwd(),
              'test/mvc/xyz'
            )} does not exist，config dir：test/mvc/xyz`
          )
        }
      })
    })
  )
  it(
    '多路径匹配测试',
    runTestAsync(async () => {
      await startWebServer({
        static: {
          '/a': { dir: 'test/mvc/static', cacheAge: 300 },
          '/a/b': { dir: 'test/mvc/static/home', cacheAge: 150 },
          '/b': { dir: 'test/mvc/static', cacheAge: 0 }
        },
        routers: {}
      })
      try {
        // /aa 虽然前缀是 /a ，但是不会匹配成功，最终返回 404
        let res = await get('/aa')
        equal(res.status, 404)

        // 虽然 /a/b/index.html 同时符合 /a 和 /a/b 两个路径前缀，但是 /a/b 优先级更高，最终匹配成功
        res = await get('/a/b/index.html')
        equal(200, res.status)
        equal(
          res.buffer.toString('utf-8'),
          `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>首页测试</title></head><body></body></html>`
        )
        let cacheControl = res.headers['cache-control']
        ok(cacheControl)
        equal(cacheControl.trim(), 'max-age=150')
      } finally {
        await stopWebServer()
      }
    })
  )
})
