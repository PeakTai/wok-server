import { ServerResponse } from 'http'

/**
 * 渲染 json 格式数据.
 * @param response 响应信息
 * @param text 文本
 * @param status 状态码，默认 200
 * @returns
 */
export function renderText(response: ServerResponse, text: string, status = 200) {
  response.setHeader('content-type', 'text/plain; charset=UTF-8')
  response.statusCode = status
  response.end(text)
}
