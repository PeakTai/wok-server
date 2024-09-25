import { WokServer, WokServerOpts } from './server'

/**
 * 服务实例.
 */
let SERVER: WokServer | undefined

/**
 * 删除服务器静态缓存
 * @param path 路径，必须以斜杠开头，如：/assets/index.js
 */
export async function removeServerStaticCache(path: string) {
  if (SERVER) {
    SERVER.removeServerStaticCache(path)
  }
}

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
export * from './static'
