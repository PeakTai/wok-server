import { readFileSync } from 'fs'
import { IncomingMessage, Server, ServerResponse, createServer } from 'http'
import { Server as HttpsServer, createServer as createHttpsServer } from 'https'
import { Socket } from 'net'
import { networkInterfaces } from 'os'
import { isAbsolute, resolve } from 'path'
import { getLogger } from '../log'
import { accessLogInterceptor } from './access-log'
import { WebConfig, getConfig } from './config'
import { ServerExchange } from './exchange'
import { Interceptor } from './interceptor'
import { renderError } from './render'
import { RouterHandler, Routers } from './router'
import { ServerStaticRules, StaticHandler } from './static'
import { notBlank, validate } from '../validation'

/**
 * mvc 服务选项
 */
export interface WokServerOpts {
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
   * 静态资源配置
   */
  static?: ServerStaticRules
}

function resolvePath(path: string) {
  if (isAbsolute(path)) {
    return path
  }
  return resolve(process.cwd(), path)
}

/**
 * web 服务
 */
export class WokServer {
  private readonly config: WebConfig
  private readonly server: Server<any> | HttpsServer<any>
  private readonly interceptors: Interceptor[]
  private readonly routers: Routers
  private readonly defaultRouter?: RouterHandler
  private readonly staticHandler?: StaticHandler

  constructor(private readonly opts: WokServerOpts) {
    this.config = getConfig()
    // https
    let tls:
      | {
          key: Buffer

          cert: Buffer
        }
      | undefined
    if (this.config.tlsEnable) {
      validate(this.config, {
        tlsCert: [notBlank()],
        tlsKey: [notBlank()]
      })
      tls = {
        cert: readFileSync(resolvePath(this.config.tlsCert)),
        key: readFileSync(resolvePath(this.config.tlsKey))
      }
    }
    // 路由
    this.routers = opts.routers
    this.defaultRouter = this.routers['*']
    // 拦截器
    this.interceptors = []
    if (this.config.accessLog) {
      this.interceptors.push(accessLogInterceptor)
    }
    if (opts.interceptors) {
      this.interceptors.push(...opts.interceptors)
    }
    // 静态处理
    if (opts.static) {
      this.staticHandler = new StaticHandler(opts.static)
    }
    // 主服务
    if (!tls) {
      this.server = createServer((req, res) => {
        res.setHeader('Server', 'Wok Server')
        res.on('error', error => {
          // 如果响应流发生错误，只能把信息记录下来
          getLogger().error(`Response Error：${req.url}`, error)
        })
        this.handleRequest(req, res).catch(error => {
          getLogger().error(`Handle request failed：${req.url}`, error)
          if (!res.writableEnded) {
            // 响应 500
            renderError(res, error.message ? error.message : 'Internal Server Error', 500)
          }
        })
      })
    } else {
      this.server = createHttpsServer(
        {
          key: tls.key,
          cert: tls.cert
        },
        (req, res) => {
          res.setHeader('Server', 'Wok Server')
          res.on('error', error => {
            // 如果响应流发生错误，只能把信息记录下来
            getLogger().error(`Response Error：${req.url}`, error)
          })
          this.handleRequest(req, res).catch(error => {
            getLogger().error(`Handle request failed：${req.url}`, error)
            if (!res.writableEnded) {
              // 响应 500
              renderError(res, error.message ? error.message : 'Internal Server Error', 500)
            }
          })
        }
      )
    }
    this.server.setTimeout(this.config.timeout)
    this.server.on('timeout', (socket: Socket) => {
      socket.end(
        'HTTP/1.1 408 Timeout\r\ncontent-type: application/json; charset=utf-8\r\n\r\n{"message":"Request timeout"}'
      )
    })
  }

  /**
   * 处理请求，完成拦截器和路由的流程.
   *
   * @param req
   * @param res
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    req.socket.remoteAddress
    const { method } = req
    // cros 支持
    res.setHeader('Access-Control-Allow-Origin', this.config.corsAllowOrigin)
    res.setHeader('Access-Control-Allow-Headers', this.config.corsAllowHeaders)
    res.setHeader('Access-Control-Allow-Methods', this.config.corsAllowMethods)
    if (method === 'OPTIONS') {
      res.statusCode = 200
      res.end()
      return
    }
    const exchange = new ServerExchange(req, res)
    // 顺序执行拦截器
    await this.handleInterceptor(0, exchange, req, res)
  }

  /**
   * 处理拦截器.
   * @param idx 当前要执行的拦截器下标
   * @param exchange 传输对象
   * @param req
   * @param res
   */
  private async handleInterceptor(
    idx: number,
    exchange: ServerExchange,
    req: IncomingMessage,
    res: ServerResponse
  ) {
    const interceptor = this.interceptors[idx]
    // 到最后一个了，那么执行路由处理
    if (!interceptor) {
      await this.handleRouter(exchange)
      return
    }
    await interceptor(exchange, () => this.handleInterceptor(idx + 1, exchange, req, res))
  }

  /**
   * 处理路由.
   * @param exchange
   * @param routers
   * @param staticSettings
   * @returns
   */
  private async handleRouter(exchange: ServerExchange) {
    const url = exchange.request.url
    if (url === undefined) {
      return
    }
    // 判定路由
    const idx = url.indexOf('?')
    let path = idx === -1 ? url : url.substring(0, idx)
    const router = this.routers[path]
    if (!router) {
      // 路由找不不到，尝试静态文件
      if (this.staticHandler) {
        const method = (exchange.request.method || '').toLowerCase()
        if (method === 'head') {
          if (await this.staticHandler.handleHead(path, exchange.response)) {
            return
          }
        }
        if (method === 'get') {
          if (await this.staticHandler.handleGet(exchange.request, exchange.response, path)) {
            return
          }
        }
      }
      this.respond404(exchange, path)
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
   * 404响应
   *
   * @param exchange
   * @param path
   */
  private async respond404(exchange: ServerExchange, path: string) {
    if (this.defaultRouter) {
      await this.defaultRouter(exchange)
    } else {
      exchange.respondErrMsg(`${path} not found`, 404)
    }
  }

  /**
   * 启动
   */
  async start() {
    if (this.opts.preHandler) {
      await this.opts.preHandler(this.server)
    }
    await new Promise<void>((resolve, reject) => {
      this.server.on('error', e => {
        if ((e as any).code === 'EADDRINUSE') {
          reject(`Port ${this.config.port} is already in use.`)
        } else {
          reject(e)
        }
      })
      this.server.listen(this.config.port, resolve)
    })
    console.log('App running at: ')
    let portOmitted =
      (this.server instanceof HttpsServer && this.config.port === 443) ||
      (this.server instanceof Server && this.config.port === 80)
    this.getIpv4List().forEach(ip => {
      if (portOmitted) {
        console.log(`http://${ip}`)
      } else {
        console.log(`http://${ip}:${this.config.port}`)
      }
    })
  }

  /**
   * 获取 ipv4 地址列表
   * @returns
   */
  private getIpv4List() {
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
   * 停止
   */
  async stop() {
    if (!this.server.listening) {
      return
    }
    await new Promise<void>((res, rej) => {
      this.server.close(err => {
        if (err) {
          rej(err)
        } else {
          res()
        }
      })
    })
  }
}
