import { existsSync, statSync } from 'fs'
import { IncomingMessage, Server, ServerResponse, createServer } from 'http'
import { Socket } from 'net'
import { networkInterfaces } from 'os'
import { isAbsolute, resolve } from 'path'
import { getLogger } from '../log'
import { accessLogInterceptor } from './access-log'
import { config } from './config'
import { ServerExchange } from './exchange'
import { Interceptor } from './interceptor'
import { renderError } from './render'
import { RouterHandler, Routers } from './router'

/**
 * 静态资源设置.
 */
interface StaticSetting {
  /**
   * 匹配路径，仅支持前缀匹配
   */
  path: string
  /**
   * 目录
   */
  dir: string
  /**
   * 缓存时长，单位秒，根据设定生成消息头 Cache-Control: max-age=时长，设置为小于等于0可关闭
   */
  cacheAge: number
}

/**
 * 处理请求，完成拦截器和路由的流程.
 *
 * @param interceptors 拦截器
 * @param routers 路由
 * @param req
 * @param res
 * @param staticSettings
 */
async function handleRequest(
  interceptors: Interceptor[],
  routers: Routers,
  req: IncomingMessage,
  res: ServerResponse,
  staticSettings: StaticSetting[]
): Promise<void> {
  req.socket.remoteAddress
  const { method } = req
  // cros 支持
  res.setHeader('Access-Control-Allow-Origin', config.corsAllowOrigin)
  res.setHeader('Access-Control-Allow-Headers', config.corsAllowHeaders)
  res.setHeader('Access-Control-Allow-Methods', config.corsAllowMethods)
  if (method === 'OPTIONS') {
    res.statusCode = 200
    res.end()
    return
  }
  const exchange = new ServerExchange(req, res)
  // 顺序执行拦截器
  await handleInterceptor(interceptors, 0, exchange, req, res, routers, staticSettings)
}

/**
 * 处理拦截器.
 * @param interceptors 拦截器
 * @param idx 当前要执行的拦截器下标
 * @param exchange 传输对象
 * @param req
 * @param res
 * @param routers 路由
 * @param staticSettings
 */
async function handleInterceptor(
  interceptors: Interceptor[],
  idx: number,
  exchange: ServerExchange,
  req: IncomingMessage,
  res: ServerResponse,
  routers: Routers,
  staticSettings: StaticSetting[]
) {
  const interceptor = interceptors[idx]
  // 到最后一个了，那么执行路由处理
  if (!interceptor) {
    await handleRouter(exchange, routers, staticSettings)
    return
  }
  await interceptor(exchange, () =>
    handleInterceptor(interceptors, idx + 1, exchange, req, res, routers, staticSettings)
  )
}

/**
 * 处理路由.
 * @param exchange
 * @param routers
 * @param staticSettings
 * @returns
 */
async function handleRouter(
  exchange: ServerExchange,
  routers: Routers,
  staticSettings: StaticSetting[]
) {
  const url = exchange.request.url
  if (url === undefined) {
    return
  }
  // 判定路由
  const idx = url.indexOf('?')
  let path = idx === -1 ? url : url.substring(0, idx)
  const router = routers[path]
  if (!router) {
    // 路由找不不到，尝试静态文件
    if (staticSettings.length) {
      await handleStatic(exchange, routers, path, staticSettings)
    } else {
      respond404(exchange, routers, path)
    }
    return
  }
  // 执行路由
  await router(exchange)
  // 在路由顺利处理的情况下，如果 res 没有 end ，就表示响应没有完成
  // 也就是说路由没有做响应处理，或处理没有完成就结束了，给予错误提示
  if (!exchange.response.writableEnded) {
    throw new Error(`RouterHandler unresponsive, url: ${url}`)
  }
}
/**
 * 处理静态文件
 * @param exchange
 * @param routers
 * @param path
 * @param staticDir
 * @returns
 */
async function handleStatic(
  exchange: ServerExchange,
  routers: Routers,
  path: string,
  staticSettings: StaticSetting[]
) {
  // 匹配
  let matchedSetting: StaticSetting | undefined
  for (const setting of staticSettings) {
    if (setting.path === '/') {
      matchedSetting = setting
      break
    }
    if (path.startsWith(setting.path)) {
      matchedSetting = setting
      break
    }
  }
  if (!matchedSetting) {
    respond404(exchange, routers, path)
    return
  }

  let finalPath = matchedSetting.path === '/' ? path : path.substring(matchedSetting.path.length)
  if (finalPath.startsWith('/')) {
    finalPath = finalPath.substring(1)
  }
  const fullPath = resolve(matchedSetting.dir, finalPath)
  if (!existsSync(fullPath)) {
    respond404(exchange, routers, path)
    return
  }
  const stat = statSync(fullPath)
  // 目录，寻找 index.html
  if (stat.isDirectory()) {
    const indexPath = resolve(fullPath, 'index.html')
    if (!existsSync(indexPath)) {
      respond404(exchange, routers, path)
      return
    }
    const indexStat = statSync(indexPath)
    if (!indexStat.isFile()) {
      respond404(exchange, routers, path)
      return
    }
    // Cache-Control
    if (matchedSetting.cacheAge >= 0) {
      exchange.response.setHeader(
        'Cache-Control',
        matchedSetting.cacheAge === 0 ? 'no-store' : `max-age=${matchedSetting.cacheAge}`
      )
    }
    await exchange.respondFile(indexPath, false)
    return
  }
  // 文件直接渲染
  if (stat.isFile()) {
    // Cache-Control
    if (matchedSetting.cacheAge >= 0) {
      exchange.response.setHeader(
        'Cache-Control',
        matchedSetting.cacheAge === 0 ? 'no-store' : `max-age=${matchedSetting.cacheAge}`
      )
    }
    await exchange.respondFile(fullPath, false)
    return
  }
  // 其它类型，404
  respond404(exchange, routers, path)
}

/**
 * 404响应
 *
 * @param exchange
 * @param routers
 * @param path
 */
async function respond404(exchange: ServerExchange, routers: Routers, path: string) {
  const handler = routers['*'] as RouterHandler | undefined
  if (handler) {
    await handler(exchange)
  } else {
    exchange.respondErrMsg(`${path} not found`, 404)
  }
}
/**
 * 获取 ipv4 地址列表
 * @returns
 */
function getIpv4List() {
  const ifs = networkInterfaces()
  const res: string[] = []
  for (const name in ifs) {
    const list = ifs[name]
    if (!list) {
      continue
    }
    res.push(...list.filter(info => info.family === 'IPv4').map(info => info.address))
  }
  return res
}
/**
 * 服务实例.
 */
let SERVER: Server<any> | undefined

/**
 * 启动 web服务
 * @param opts
 */
export async function startWebServer(opts: {
  /**
   * 路由配置.
   */
  routers: Routers
  /**
   * 拦截器，在路由处理前可以做一些额外操作.
   */
  interceptors?: Interceptor[]
  /**
   * 前置控制器，在服务启动之前，对服务做一些额外的操作。比如可以连接 socket.io 或者一些其它
   * 支持 nodejs 原生 http 服务的组件.
   * @param server
   * @returns
   */
  preHandler?: (server: Server<any>) => Promise<void>
  /**
   * 静态文件设置，key 是访问路径，value 是相关设置. 如果希望根目录映射，可以将 key 的值设置为 /。
   * 访问路径和目录的设置都是不允许重复的。
   */
  static?: Record<
    string,
    {
      /**
       * 目录
       */
      dir: string
      /**
       * 缓存时长，单位秒，根据设定生成消息头 Cache-Control: max-age=时长，设置为小于等于0可关闭
       */
      cacheAge?: number
    }
  >
}) {
  if (SERVER) {
    throw new Error('The server has already been started!')
  }
  // 检查静态文件配置，做一些预处理的操作，在处理静态资源的请求时不必再做这些处理
  const staticSettings: StaticSetting[] = []
  if (opts.static) {
    // 重复记录表 ，作用是为了路径去重判定，可以提示哪些路径是重复的
    const duplicateMap = new Map<string, string>()
    for (const entry of Object.entries(opts.static)) {
      const [path, setting] = entry
      const dir = isAbsolute(setting.dir) ? setting.dir : resolve(process.cwd(), setting.dir)
      if (!existsSync(dir)) {
        throw new Error(
          `Static file configuration error，path ${dir} does not exist，config dir：${setting.dir}`
        )
      }
      const stat = statSync(dir)
      if (!stat.isDirectory()) {
        throw new Error(
          `Static file configuration error，path ${dir} is not a directory，config dir：${setting.dir}`
        )
      }
      let finalPath = path.startsWith('/') ? path : '/' + path
      // 保持以 / 结尾，为了匹配方便
      if (!finalPath.endsWith('/')) {
        finalPath += '/'
      }
      if (duplicateMap.has(finalPath)) {
        throw new Error(`Static path duplicated: ${duplicateMap.get(finalPath)} and ${path}`)
      }
      duplicateMap.set(finalPath, path)
      staticSettings.push({ path: finalPath, dir, cacheAge: setting.cacheAge || 0 })
    }
    // 优先级排序
    staticSettings.sort((o1, o2) => {
      let priority1 = o1.path === '/' ? -1 : o1.path.split('/').length
      let priority2 = o2.path === '/' ? -1 : o2.path.split('/').length
      // 如果 o1 优先级高，就应该排前面，返回小于0的值，反之亦然\
      // 前面的优先级值是值越大优先级越高，反过来减
      return priority2 - priority1
    })
  }

  // 如果启用请求日志，增加拦截器
  let interceptors: Interceptor[] = []
  if (config.accessLog) {
    interceptors.push(accessLogInterceptor)
  }
  if (opts.interceptors) {
    interceptors.push(...opts.interceptors)
  }
  SERVER = createServer((req, res) => {
    res.on('error', error => {
      // 如果响应流发生错误，只能把信息记录下来
      getLogger().error(`Response Error：${req.url}`, error)
    })
    handleRequest(interceptors, opts.routers, req, res, staticSettings).catch(error => {
      getLogger().error(`Handle request failed：${req.url}`, error)
      if (!res.writableEnded) {
        // 响应 500
        renderError(res, error.message ? error.message : 'Internal Server Error', 500)
      }
    })
  })
  SERVER.setTimeout(config.timeout)
  SERVER.on('timeout', (socket: Socket) => {
    socket.end(
      'HTTP/1.1 408 Timeout\ncontent-type: application/json; charset=utf-8\n\n{"message":"Request timeout"}'
    )
  })
  if (opts.preHandler) {
    await opts.preHandler(SERVER)
  }
  const server = SERVER
  await new Promise<void>((resolve, reject) => {
    server.on('error', e => {
      if ((e as any).code === 'EADDRINUSE') {
        reject(`端口号 ${config.port} 已经被占用`)
      } else {
        reject(e)
      }
    })
    server.listen(config.port, resolve)
  })

  console.log('App running at: ')
  getIpv4List().forEach(ip => {
    console.log(`http://${ip}:${config.port}`)
  })

  process.on('beforeExit', () => {
    if (server.listening) {
      server.close()
    }
  })
}
/**
 * 停止 web 服务
 * @returns
 */
export async function stopWebServer() {
  if (!SERVER) {
    return
  }
  if (SERVER.listening) {
    const server = SERVER
    await new Promise<void>((res, rej) => {
      server.close(err => {
        if (err) {
          rej(err)
        } else {
          res()
        }
      })
    })
  }
  SERVER = undefined
}

export * from './exchange'
export * from './handler'
export * from './render'
export * from './router'
export * from './interceptor'
