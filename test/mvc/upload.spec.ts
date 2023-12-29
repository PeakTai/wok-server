import { deepStrictEqual, equal, ok } from 'assert'
import formidable from 'formidable'
import { doRequest, startWebServer, stopWebServer } from '../../src'
import { runTestAsync } from '../utils'

describe('mvc 上传文件处理测试', () => {
  before(async () => {
    await startWebServer({
      routers: {
        '/upload': async exchange => {
          const form = formidable({})
          // 解析请求内容
          const res = form.parse<string, string>(exchange.request)
          const [fields, files] = await res
          // 将读取出来的信息输出
          exchange.respondJson({ fields, files })
        }
      }
    })
  })
  after(async () => {
    await stopWebServer()
  })
  it(
    '使用 formidable 解析',
    runTestAsync(async () => {
      // 构建 multipart/form-data
      const boundary = '---------------------------331175866227061826643431873037'
      const body =
        '--' +
        boundary +
        '\r\nContent-Disposition: form-data; name="city"\r\n\r\n' +
        'shanghai\r\n' +
        '--' +
        boundary +
        '\r\nContent-Disposition: form-data; name="nickname"\r\n\r\n' +
        'David\r\n' +
        '--' +
        boundary +
        '\r\ncontent-disposition: form-data; name="profile"; filename="demo.txt"\r\n' +
        'Content-Type: text/plain\r\n\r\n' +
        'Hello world !\r\n' +
        '--' +
        boundary +
        '--\r\n'
      const res = await doRequest({
        url: 'http://localhost:8080/upload',
        method: 'POST',
        headers: {
          'content-type': `multipart/form-data; boundary=${boundary}`
        },
        body
      })
      equal(res.status, 200)
      const json: any = JSON.parse(res.body.toString('utf-8'))
      const { fields, files } = json
      deepStrictEqual(fields['city'], ['shanghai'])
      deepStrictEqual(fields['nickname'], ['David'])
      ok(files.profile)
      equal(files.profile.length, 1)
      const file = files.profile[0]
      equal(file.mimetype, 'text/plain')
      equal(file.originalFilename, 'demo.txt')
      equal(file.size, Buffer.from('Hello world !').byteLength)
    })
  )
})
