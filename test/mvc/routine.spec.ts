import { deepStrictEqual, equal, ok } from 'assert'
import { IncomingHttpHeaders } from 'http'
import { ValidationException, doRequest, startWebServer, stopWebServer } from '../../src'
import { runTestAsync } from '../utils'
import { htmlHandler } from './html-handler'
import { jsonHandler } from './json-handler'
import { getJsonData, updateJsonData, getCacheJsonData } from './json-cache-handlers'

async function postJson(
  url: string,
  body: any
): Promise<{
  status: number
  headers: IncomingHttpHeaders
  body: any
}> {
  const res = await doRequest({
    url,
    body: JSON.stringify(body),
    method: 'POST',
    headers: {
      'accept-language': 'zh-CN',
      'Content-Type': 'application/json; charset=utf-8'
    }
  })
  const bodyText = res.body.toString('utf8')
  return {
    status: res.status,
    headers: res.headers,
    body: bodyText ? JSON.parse(bodyText) : {}
  }
}

describe('mvc 常规测试', async () => {
  before(
    runTestAsync(async () => {
      process.env.SERVER_TLS_ENABLE = 'false'
      process.env.SERVER_STATIC_CACHE_ENABLE = 'false'
      // 服务的环境变量设置
      await startWebServer({
        routers: {
          '/text': async exchange => exchange.respondText('hello'),
          '/json': jsonHandler,
          '/json/data/get': getJsonData,
          '/json/data/cache/get': getCacheJsonData,
          '/json/data/update': updateJsonData,
          '/html': htmlHandler,
          '*': async exchange => exchange.respondText('404', 404)
        },
        interceptors: [
          // 拦截器简单处理要校验异常
          async (exchange, next) => {
            try {
              await next()
            } catch (e) {
              if (e instanceof ValidationException) {
                exchange.respondErrMsg(e.errMsg, 400)
                return
              }
              if (e instanceof Error) {
                exchange.respondErrMsg(e.message, 500)
                return
              }
              exchange.respondErrMsg('服务器内部错误', 500)
            }
          }
        ]
      })
    })
  )
  after(
    runTestAsync(async () => {
      await stopWebServer()
    })
  )
  it(
    '响应纯文本',
    runTestAsync(async () => {
      const resp = await doRequest({
        url: 'http://localhost:8080/text',
        method: 'GET'
      })
      equal(resp.status, 200)
      equal(resp.headers['content-type'], 'text/plain; charset=UTF-8')
      const text = resp.body.toString('utf-8')
      equal(text, 'hello')
    })
  )
  it(
    '响应 JSON',
    runTestAsync(async () => {
      const url = 'http://localhost:8080/json'

      // 不使用 post 方法，将会返回 405 状态码
      const res1 = await doRequest({ url, method: 'GET' })
      equal(res1.status, 405)

      let res = await postJson(url, {})
      // 校验未通过，经过拦截器的处理，应该返回 400
      equal(res.status, 400)
      equal(res.body.message, '昵称不能为空')

      res = await postJson(url, { nickname: 'p' })
      equal(res.status, 400)
      equal(res.body.message, '昵称必须在2-16个字符之间')

      res = await postJson(url, { nickname: 'jack', skills: [] })
      equal(res.status, 400)
      equal(res.body.message, '长度不得小于 1')

      res = await postJson(url, { nickname: 'jack', skills: ['Java'], age: 48 })
      equal(res.status, 400)
      equal(res.body.message, '年龄不得超过38')

      // 所有参数校验通的情况
      res = await postJson(url, { nickname: 'jack', skills: ['Java'], age: 33 })
      equal(res.status, 200)
      // 请求的信息会被返回，并增加 id 字段
      equal(res.body.nickname, 'jack')
      deepStrictEqual(res.body.skills, ['Java'])
      equal(res.body.age, 33)
      equal(res.body.id, '001')

      // 出异常的情况
      res = await postJson(url, { nickname: 'Satan', skills: ['Java'], age: 35 })
      equal(res.status, 500)
      equal(res.body.message, '名字不可以叫 Satan')
    })
  )
  it(
    'JSON 缓存',
    runTestAsync(async () => {
      // 先请求一次详情，这样就有缓存了
      // 然后调用接口修改进行修改，再请求还是老样子，证明是缓存
      // 再调用一次修改接口，设置清理缓存的参数，然后请求详情是最新数据，说明缓存清理成功
      const detailUrl = 'http://localhost:8080/json/data/get'
      const detailCacheUrl = 'http://localhost:8080/json/data/cache/get'
      const updateUrl = 'http://localhost:8080/json/data/update'
      const res = await postJson(detailCacheUrl, {})
      equal(res.status, 200)
      equal(res.body.id, '007')
      equal(res.body.name, '测试数据')
      equal(res.body.createBy, '纪老师')

      await postJson(updateUrl, {
        name: '新的名字'
      })
      // 请求到的仍然是缓存数据
      const res2 = await postJson(detailCacheUrl, {})
      equal(res2.status, 200)
      equal(res2.body.name, '测试数据')

      // 无缓存的数据是最新的
      const res3 = await postJson(detailUrl, {})
      equal(res3.status, 200)
      equal(res3.body.name, '新的名字')

      // 修改同时清理缓存
      await postJson(updateUrl, {
        name: '这是新的名字',
        clearCache: true
      })

      // 这次缓存接口返回的也是最新的数据
      const res4 = await postJson(detailCacheUrl, {})
      equal(res4.status, 200)
      equal(res4.body.name, '这是新的名字')
    })
  )
  it(
    '响应 html',
    runTestAsync(async () => {
      const url = 'http://localhost:8080/html'
      let res = await doRequest({
        url,
        method: 'GET'
      })
      equal(res.status, 200)
      equal(res.headers['content-type'], 'text/html; charset=utf-8')
      let html = res.body.toString('utf-8')
      equal(
        html,
        '<html lang="zh"><head><title>主页</title></head>' +
          '<body><div class="layout"><h1>各种商品，应有尽有</h1><div>请选择种类</div></div></body></html>'
      )

      res = await doRequest({
        url: url + '?tab=服装',
        method: 'GET'
      })
      equal(res.status, 200)
      html = res.body.toString('utf-8')
      equal(
        html,
        '<html lang="zh"><head><title>主页-服装</title></head>' +
          '<body><div class="layout"><h1>各种商品，应有尽有</h1><div>服装区</div></div></body></html>'
      )

      res = await doRequest({
        url: url + '?tab=数码',
        method: 'GET'
      })
      equal(res.status, 200)
      html = res.body.toString('utf-8')
      equal(
        html,
        '<html lang="zh"><head><title>主页-数码</title></head>' +
          '<body><div class="layout"><h1>各种商品，应有尽有</h1><div>数码区</div></div></body></html>'
      )
    })
  )
  it(
    '404',
    runTestAsync(async () => {
      const res = await doRequest({ url: 'http://localhost:8080/cccc/xxxx', method: 'GET' })
      equal(res.status, 404)
      const text = res.body.toString('utf-8')
      equal(text, '404')
    })
  )
})
