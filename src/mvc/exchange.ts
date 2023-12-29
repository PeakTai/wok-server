import { IncomingMessage, ServerResponse } from 'http'
import { QueryString } from './query'
import { HtmlStuct, renderError, renderFile, renderHtml, renderJson } from './render'
import { renderText } from './render/text'

/**
 * 服务的数据交换对象.
 */
export class ServerExchange {
  #bufferPromise?: Promise<Buffer>

  constructor(readonly request: IncomingMessage, readonly response: ServerResponse) {}

  bodyBuffer(): Promise<Buffer> {
    if (this.#bufferPromise) {
      return this.#bufferPromise
    }
    this.#bufferPromise = new Promise<Buffer>((resolve, reject) => {
      if (this.request.readableEnded) {
        throw new Error('Request has ended!')
      }
      let body: Buffer[] = []
      this.request
        .resume()
        .on('error', reject)
        .on('data', chunk => body.push(chunk))
        .on('end', () => resolve(Buffer.concat(body)))
    })
    return this.#bufferPromise
  }

  async bodyText(): Promise<string> {
    const buffer = await this.bodyBuffer()
    return buffer.toString('utf-8')
  }

  async bodyJson<T>(): Promise<T> {
    const buffer = await this.bodyBuffer()
    const bodyText = buffer.toString('utf-8')
    if (!bodyText || !bodyText.trim()) {
      return {} as any
    }
    return JSON.parse(bodyText)
  }
  /**
   * 响应纯文本
   * @param text 文本内容
   * @param status 状态码，可选，默认 200
   */
  respondText(text: string, status?: number) {
    renderText(this.response, text, status)
  }

  /**
   * 响应 json
   * @param json 任意可被 json 序列化的对象
   * @param status 状态码，可选，默认 200
   */
  respondJson(json: any, status?: number) {
    renderJson(this.response, json, status)
  }
  /**
   * 响应错误信息提示，提供一个统一的格式封装，json 格式
   * @param message 消息
   * @param status 状态码，默认 400 ，表示业务错误
   * @returns
   */
  respondErrMsg(message: string, status?: number) {
    renderError(this.response, message, status)
  }
  /**
   * 响应文件
   * @param filePath 文件路径，绝对路径
   * @param download 是否下载模式
   * @returns
   */
  respondFile(filePath: string, download?: boolean) {
    return renderFile(this.request, this.response, filePath, download)
  }
  /**
   * 响应 html
   * @param html html 内容，一个特定结构的对象或者是字符串
   * @param status 状态码，可选，默认 200
   */
  respondHtml(html: HtmlStuct | string, status?: number) {
    renderHtml(this.response, html, status)
  }

  /**
   * 响应
   * @param opts
   */
  respond(opts: {
    /**
     * 状态码.
     */
    statusCode: number
    /**
     * 响应正文内容.
     */
    body?: string | Buffer | Uint8Array
    /**
     * 自定义消息头
     */
    headers?: Record<string, string>
  }) {
    this.response.statusCode = opts.statusCode
    if (opts.headers) {
      for (const key in opts.headers) {
        this.response.setHeader(key, opts.headers[key])
      }
    }
    if (opts.body) {
      this.response.write(opts.body)
    }
    this.response.end()
  }

  /**
   * 解析 queryString
   * @returns
   */
  parseQueryString() {
    return new QueryString(this.request.url || '')
  }
}
