import { ServerResponse } from 'http'

/**
 * 渲染 json 格式数据.
 * @param response 响应信息
 * @param json json对象
 * @param status 状态码，默认 200
 * @returns
 */
export function renderJson(response: ServerResponse, json: any, status = 200) {
  response.setHeader('content-type', 'application/json; charset=UTF-8')
  response.statusCode = status
  response.end(JSON.stringify(json))
}

/**
 * 渲染错误信息，json 格式
 * @param response
 * @param message
 * @param status
 */
export function renderError(response: ServerResponse, message: string, status = 400) {
  renderJson(response, { message }, status)
}
