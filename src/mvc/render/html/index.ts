import { ServerResponse } from 'http'
import { HtmlStuct, generateHtmlCode } from './html'

/**
 * 渲染 html
 * @param response
 * @param html
 * @param status
 */
export function renderHtml(response: ServerResponse, html: HtmlStuct | string, status = 200) {
  response.statusCode = status
  response.setHeader('content-type', 'text/html; charset=utf-8')
  response.end(typeof html === 'string' ? html : generateHtmlCode(html))
}

export * from './html'
