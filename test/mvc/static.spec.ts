import { IncomingHttpHeaders, OutgoingHttpHeaders, request } from 'http'
import { startWebServer, stopWebServer } from '../../src'
import { equal, ok } from 'assert'

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

describe('静态文件测试', () => {
  before(async () => {
    await startWebServer({
      static: {
        '/': { dir: 'test/mvc/static', cacheAge: 300 }
      },
      routers: {
        '/api': async ex => ex.respondJson({ msg: '接口响应信息' }),
        '/demo.txt': async ex => ex.respondText('这个会覆盖静态文件')
      }
    })
  })
  after(async () => {
    await stopWebServer()
    console.log('静态文件测试完成')
  })
  it('静态文件与路由优先级测试', async () => {
    // 路由应该不受影响，并且路由优先
    let res = await get('/api')
    equal(res.status, 200)
    let json = JSON.parse(res.buffer.toString('utf-8'))
    equal(json.msg, '接口响应信息')

    res = await get('/demo.txt')
    equal(res.status, 200)
    equal(res.buffer.toString('utf-8'), '这个会覆盖静态文件')
  })
  it('静态文件 cache 缓存时间测试', async () => {
    const res = await get('/test1.txt')
    const text = res.buffer.toString('utf-8')
    equal(text, '静态文本测试')
    // 消息头
    const cacheControl = res.headers['cache-control']
    ok(!!cacheControl)
    // Cache-Control: max-age=时长
    equal(cacheControl.trim(), 'max-age=300')
  })
  it('静态文件 range 消息头测试', async () => {
    let res = await get('/l2-dir/Free_Test_Data_1MB_MP3.mp3')
    // 正常获取应该返回全部内容，不会有 Content-Range
    equal(res.buffer.byteLength, 1051422)
    equal(res.status, 200)
    // 指定范围
    res = await get('/l2-dir/Free_Test_Data_1MB_MP3.mp3', {
      Range: 'bytes=200-999'
    })
    let contentRange = res.headers['content-range']
    ok(!!contentRange)
    ok(contentRange.startsWith('bytes'))
    let range = contentRange.substring(5).trim()
    equal(range, '200-999/1051422')
    equal(res.status, 206)
    // 前后都包含
    equal(res.buffer.byteLength, 999 - 200 + 1)
    // 只指定 start
    res = await get('/l2-dir/Free_Test_Data_1MB_MP3.mp3', {
      Range: 'bytes=999-'
    })
    contentRange = res.headers['content-range']
    ok(!!contentRange)
    ok(contentRange.startsWith('bytes'))
    range = contentRange.substring(5).trim()
    equal(range, '999-1051421/1051422')
    equal(res.status, 206)
    // 前后都包含
    equal(res.buffer.byteLength, 1051421 - 999 + 1)
    // 测试不合法的 range
    res = await get('/l2-dir/Free_Test_Data_1MB_MP3.mp3', {
      Range: 'bytes=-3-'
    })
    equal(res.status, 416)
    equal(res.buffer.toString('utf-8'), '{"message":"Range not satisfiable，start is NaN"}')
    res = await get('/l2-dir/Free_Test_Data_1MB_MP3.mp3', {
      Range: 'bytes=788-1051422'
    })
    equal(res.status, 416)
    equal(
      res.buffer.toString('utf-8'),
      '{"message":"Range not satisfiable，end must not be greater than 1051421"}'
    )
  })
  it('静态文件首页测试', async () => {
    // 如果直接访问一个目录的地址，则会返回这个目录下的 index.html 中的内容，否则返回４０４
    let res = await get('/home')
    equal(res.status, 200)
    equal(res.headers['content-type'], 'text/html')
    equal(
      res.buffer.toString('utf-8'),
      `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>首页测试</title></head><body></body></html>`
    )

    // 不存在的路径也测试一下, l2-dir 这个目录下没有 index.html
    res = await get('/l2-dir')
    equal(res.status, 404)
  })
})
