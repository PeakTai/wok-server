import { IncomingHttpHeaders, request as requestHttp } from 'http'
import { request as requestHttps } from 'https'
import { URL } from 'url'

/**
 * 请求选项.
 */
export interface HttpRequestOpts {
  /**
   * 链接地址.
   */
  url: string
  /**
   * 查询参数，附加在链接地址上
   */
  query?: Record<string, string[] | string>
  /**
   * 正文，可以是序列化好的字符串或二进制内容.
   */
  body?: string | Buffer
  /**
   * 消息头
   */
  headers?: IncomingHttpHeaders
  /**
   * 请求方法
   */
  method: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'DELETE' | 'CONNECT' | 'OPTIONS' | 'TRACE' | 'PATCH'
  /**
   * 超时时间，单位毫秒，默认 5000
   */
  timeout?: number
  /**
   * 是否跟随重定向
   */
  followRedirect?: boolean
}
/**
 * 响应信息.
 */
export interface HttpResponseInfo {
  /**
   * 状态码
   */
  status: number
  /**
   * 消息头.
   */
  headers: IncomingHttpHeaders
  /**
   * 响应正文
   */
  body: Buffer
}

/**
 * 发送 http 请求.
 * @param opts
 * @returns
 */
export function doRequest(opts: HttpRequestOpts): Promise<HttpResponseInfo> {
  return new Promise<HttpResponseInfo>((resolve, reject) => {
    const url = new URL(opts.url)
    // query
    if (opts.query) {
      Object.entries(opts.query).forEach(entry => {
        const [key, val] = entry
        if (typeof val === 'string') {
          url.searchParams.append(key, val)
        } else if (Array.isArray(val)) {
          val.forEach(v => url.searchParams.append(key, v))
        } else {
          throw new Error(`The value is neither of string nor string[] type：${val}`)
        }
      })
    }
    const request = url.protocol === 'https:' ? requestHttps : requestHttp
    const req = request(
      url,
      {
        method: opts.method,
        headers: opts.headers,
        timeout: opts.timeout && opts.timeout > 0 ? opts.timeout : 5000,
        rejectUnauthorized: false
      },
      res => {
        const chunks: any[] = []
        res.on('error', reject)
        res.on('data', chunk => chunks.push(chunk))
        res.on('end', () => {
          // 重定向支持
          if (opts.followRedirect) {
            // 301、302、303、307、308
            if (
              res.statusCode === 301 ||
              res.statusCode === 302 ||
              res.statusCode === 303 ||
              res.statusCode === 307 ||
              res.statusCode === 308
            ) {
              if (res.headers.location) {
                // 重新请求，但是重定向标记改为 false ，只重定向一次，防止无限重定向造成死循环
                resolve(
                  doRequest(
                    Object.assign({}, opts, { url: res.headers.location, followRedirect: false })
                  )
                )
                return
              }
            }
          }
          const buffer = Buffer.concat(chunks)
          resolve({
            status: res.statusCode || 0,
            body: buffer,
            headers: res.headers
          })
        })
      }
    )
    req.on('error', reject)
    req.on('timeout', () => reject('Request timeout'))
    if (opts.body) {
      req.write(opts.body)
    }
    req.end()
  })
}
/**
 * 发送 json 格式的 post 请求，body 是未序列化的普通对象，表示要发送的请求数据.
 * @param opts
 */
export async function postJson<T>(
  opts: Pick<HttpRequestOpts, 'url' | 'query' | 'headers' | 'timeout'> & { body: any }
): Promise<T> {
  const headers = Object.assign({}, opts.headers || {}, {
    'Content-Type': 'application/json; charset=utf-8'
  })
  const res = await doRequest({
    url: opts.url,
    query: opts.query,
    headers: headers,
    timeout: opts.timeout,
    method: 'POST',
    body: JSON.stringify(opts.body),
    followRedirect: false
  })
  if (res.status !== 200) {
    if (res.body.byteLength < 1024) {
      throw new Error(
        `Request failed，status code：${res.status}，url：${opts.url}，body：${res.body.toString(
          'utf-8'
        )}`
      )
    } else {
      throw new Error(`Request failed，status code：${res.status}，url：${opts.url}`)
    }
  }
  const bodyText = res.body.toString('utf8')
  if (!bodyText) {
    return {} as T
  }
  return JSON.parse(bodyText)
}

/**
 * get 请求获取 json 格式数据.
 * @param opts
 */
export async function getJson<T>(
  opts: Pick<HttpRequestOpts, 'url' | 'query' | 'headers' | 'timeout'>
): Promise<T> {
  const res = await doRequest({
    url: opts.url,
    query: opts.query,
    headers: opts.headers,
    timeout: opts.timeout,
    method: 'GET',
    followRedirect: true
  })
  if (res.status !== 200) {
    if (res.body.byteLength < 1024) {
      throw new Error(
        `Request failed，status code：${res.status}，url：${opts.url}，body：${res.body.toString(
          'utf-8'
        )}`
      )
    } else {
      throw new Error(`Request failed，status code：${res.status}，url：${opts.url}`)
    }
  }
  const bodyText = res.body.toString('utf8')
  if (!bodyText) {
    return {} as T
  }
  return JSON.parse(bodyText)
}
