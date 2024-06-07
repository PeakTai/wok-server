import { WokServer, WokServerOpts } from './server'

/**
 * 服务实例.
 */
let SERVER: WokServer | undefined

/**
 * 启动 web服务
 * @param opts
 */
export async function startWebServer(opts: WokServerOpts) {
  if (SERVER) {
    throw new Error('The server has already been started!')
  }
  SERVER = new WokServer(opts)
  await SERVER.start()
}
/**
 * 停止 web 服务
 * @returns
 */
export async function stopWebServer() {
  if (!SERVER) {
    return
  }
  SERVER.stop()
  SERVER = undefined
}

process.on('beforeExit', stopWebServer)

export * from './exchange'
export * from './handler'
export * from './interceptor'
export * from './render'
export * from './router'

