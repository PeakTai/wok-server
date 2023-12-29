import { RouterHandler } from '../router'

/**
 * 构建 restful 风格路由
 */
export function restful(opts: {
  get?: RouterHandler
  post?: RouterHandler
  put?: RouterHandler
  patch?: RouterHandler
  delete?: RouterHandler
}): RouterHandler {
  return async exchange => {
    const method = (exchange.request.method || '').toLowerCase()
    let handler: RouterHandler | undefined
    switch (method) {
      case 'get':
        handler = opts.get
        break
      case 'post':
        handler = opts.post
        break
      case 'put':
        handler = opts.put
        break
      case 'patch':
        handler = opts.patch
        break
      case 'delete':
        handler = opts.delete
        break
    }
    if (!handler) {
      exchange.respondErrMsg(`${method} ${exchange.request.url} not found`, 404)
      return
    }
    await handler(exchange)
  }
}
