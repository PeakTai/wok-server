import { Stats, createReadStream, existsSync, statSync } from 'fs'
import { readFile, stat } from 'fs/promises'
import { IncomingMessage, ServerResponse } from 'http'
import { isAbsolute, resolve } from 'path'
import { createGzip, gzip } from 'zlib'
import { renderError } from '../render'
import { StaticHeaders, parseHeaders } from './header'
import { decideContentType } from './mime-type'
import { ServerCache } from './server-cache'
import { getConfig, parseSize } from './server-cache-config'

/**
 * 静态资源的映射规则
 */
export type ServerStaticRules = Record<
  /**
   * 要映射的路径
   */
  string,
  {
    /**
     * 文件目录
     */
    dir: string
    /**
     * 客户端缓存时长，单位秒，根据设定生成消息头 Cache-Control: max-age=时长，设置为小于等于0可关闭
     */
    cacheAge?: number
  }
>

/**
 * 处理后的静态资源规则，最终按优先级排列.
 */
interface FlatServerStaticRules {
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
 * 本地文件抽象
 */
interface LocalFile {
  filePath: string
  stats: Stats
  maxAge?: number
}
/**
 * 响应文件抽象
 */
interface ResponseFile {
  /**
   * 最大生存时间
   */
  maxAge?: number
  /**
   * 修改时间
   */
  mtime: Date
  /**
   * 文件大小
   */
  size: number
  mimeType: string
  /**
   * 内容或路径，两者有一个必须存在
   */
  bufferOrPath: Buffer | string
}

export class StaticHandler {
  private readonly DEFAULT_CONTENT_TYPE = 'application/octet-stream'
  private readonly maxFileSize: number
  private cache?: ServerCache
  private rules: FlatServerStaticRules[]
  /**
   * 静态处理器。规则说明：
   * 请求路径仅支持前缀匹配，不支持通配符，比如 /a/demo.html 可以匹配 /a 路径，响应配置的文件目录下的 demo.html 文件。
   * 路径配置是有优先级的，如果访问 /a/b/music.mp3 则会匹配到 /a/b 的配置，而不是 /a ，因为 /a/b 的配置更详细，优先级也更高，
   * 并且如果从 /a/b 配置的目录下没有找到文件，也不会再尝试 /a 的配置。
   *
   * 静态文件同时也支持主页自动映射，比如访问 /a/b/c ，会匹配到 /a/b 的配置，然后在配置的文件目录下寻找文件 c ，
   * 如果找不到则尝试寻找目录 c 下的 index.html 文件。
   * @param rules 规则设置
   */
  constructor(rules: ServerStaticRules) {
    const config = getConfig()
    this.maxFileSize = parseSize(config.maxFileSize)
    if (config.enable) {
      this.cache = new ServerCache({ maxSize: parseSize(config.maxSize), maxAge: config.maxAge })
    }
    this.rules = []
    // 规则解析，路径判定，设置的目录必须存在或可以被创建
    // 重复记录表 ，作用是为了路径去重判定，可以提示哪些路径是重复的
    const duplicateMap = new Map<string, string>()
    for (const entry of Object.entries(rules)) {
      const [path, setting] = entry
      const dir = isAbsolute(setting.dir) ? setting.dir : resolve(process.cwd(), setting.dir)
      if (!existsSync(dir)) {
        throw new Error(
          `Static file configuration error，path ${dir} does not exist，config dir：${setting.dir}`
        )
      }
      const statRes = statSync(dir)
      if (!statRes.isDirectory()) {
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
      this.rules.push({ path: finalPath, dir, cacheAge: setting.cacheAge || 0 })
    }
    // 优先级排序
    this.rules.sort((o1, o2) => {
      let priority1 = o1.path === '/' ? -1 : o1.path.split('/').length
      let priority2 = o2.path === '/' ? -1 : o2.path.split('/').length
      // 如果 o1 优先级高，就应该排前面，返回小于0的值，反之亦然\
      // 前面的优先级值是值越大优先级越高，反过来减
      return priority2 - priority1
    })
  }
  /**
   * 处理静态文件 get 请求
   * @param request
   * @param response
   * @param path
   * @returns 是否能够处理，如果因为找不到文件或其它原因无法处理则返回 false ，由后续流程继续处理
   */
  async handleGet(
    request: IncomingMessage,
    response: ServerResponse,
    path: string
  ): Promise<boolean> {
    // 解析消息头
    const headersInfo = parseHeaders(request.headers)
    // 构建文件信息
    let file = await this.buildRespFile(path, headersInfo)
    if (!file) {
      return false
    }

    // content-type
    response.setHeader('Content-Type', file.mimeType)
    // client cache
    if (file.maxAge === 0) {
      response.setHeader('Cache-Control', 'no-store')
    } else if (file.maxAge) {
      response.setHeader('Cache-Control', `max-age=${file.maxAge}`)
    }
    response.setHeader('Last-Modified', file.mtime.toUTCString())

    // 开始响应，先判定 if-modified-since
    if (headersInfo.ifModifiedSince) {
      if (headersInfo.ifModifiedSince >= file.mtime) {
        response.statusCode = 304
        response.end()
        return true
      }
    }

    if (headersInfo.range) {
      const { start } = headersInfo.range
      if (isNaN(start) || start < 0) {
        renderError(response, `Range not satisfiable，start is ${start}.`, 416)
        return true
      }
      const maxEnd = file.size - 1
      let end = headersInfo.range.end ? headersInfo.range.end : maxEnd
      // 校验 end
      if (end <= start) {
        renderError(response, `Range not satisfiable，end must be greater than start.`, 416)
        return true
      }
      if (end > maxEnd) {
        renderError(response, `Range not satisfiable，end must not be greater than ${maxEnd}.`, 416)
        return true
      }
      // range 是前后都包含的，详细可以参考规范：
      // https://www.rfc-editor.org/rfc/rfc9110#field.range
      // 但是 buffer.subarray 中包含前不包含后，createReadStream 是前后都包含的，需要注意
      // 还需要注意 gzip 编码
      response.setHeader('Content-Range', `bytes ${start}-${end}/${file.size}`)
      response.statusCode = 206
      if (file.bufferOrPath instanceof Buffer) {
        let buffer = file.bufferOrPath.subarray(start, end + 1)
        if (headersInfo.gzip) {
          buffer = await new Promise<Buffer>((resolve, reject) => {
            gzip(buffer, (err, res) => {
              if (err) {
                reject(err)
                return
              }
              resolve(res)
            })
          })
          response.setHeader('Content-Encoding', 'gzip')
        }
        await this.endRespWithBuffer(response, buffer)
      } else {
        const filePath = file.bufferOrPath
        // 文件处理
        await new Promise<void>((resolve, reject) => {
          response.setHeader('Content-Encoding', 'gzip')
          response.once('finish', resolve).once('error', reject)
          if (headersInfo.gzip) {
            createReadStream(filePath, { start, end }).pipe(createGzip()).pipe(response)
          } else {
            createReadStream(filePath, { start, end }).pipe(response)
          }
        })
      }
      return true
    }
    // gzip
    if (headersInfo.gzip) {
      response.setHeader('Content-Encoding', 'gzip')
      if (file.bufferOrPath instanceof Buffer) {
        // buffer 是缓存的文件，gzip 编码缓存的文件即是已经压缩后的文件
        await this.endRespWithBuffer(response, file.bufferOrPath)
      } else {
        createReadStream(file.bufferOrPath).pipe(createGzip()).pipe(response)
      }
      return true
    }
    // 普通的整个文件请求处理
    if (file.bufferOrPath instanceof Buffer) {
      await this.endRespWithBuffer(response, file.bufferOrPath)
    } else {
      const filePath = file.bufferOrPath
      await new Promise<void>((resolve, reject) => {
        response.once('finish', resolve).once('error', reject)
        createReadStream(filePath).pipe(response)
      })
    }
    return true
  }

  /**
   *  处理 head 请求，不响应正文内容，如果文件可以被找到，仅仅响应以下的消息头：
   * Content-Length
   * Content-Type
   * Last-Modified
   * Cache-Control
   *
   * @param path 请求路径
   * @param response
   * @returns 是否成功处理
   */
  async handleHead(path: string, response: ServerResponse): Promise<boolean> {
    // 构建文件信息
    let file = await this.buildRespFile(path, { gzip: false })
    if (!file) {
      return false
    }
    response.setHeader('Content-Length', file.size)
    response.setHeader('Content-Type', file.mimeType)
    response.setHeader('Last-Modified', file.mtime.toUTCString())
    if (file.maxAge === 0) {
      response.setHeader('Cache-Control', 'no-store')
    } else if (file.maxAge) {
      response.setHeader('Cache-Control', `max-age=${file.maxAge}`)
    }
    response.end()
    return true
  }

  async endRespWithBuffer(response: ServerResponse, buffer: Buffer) {
    await new Promise<void>((resolve, reject) => {
      response.write(buffer, err => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
    await new Promise<void>((resolve, reject) => {
      response.end(resolve)
    })
  }

  /**
   * 构建响应文件
   *
   * @param path
   * @param headers
   * @returns
   */
  private async buildRespFile(path: string, headers: StaticHeaders): Promise<ResponseFile | null> {
    if (!this.cache) {
      const file = await this.findFile(path)
      if (!file) {
        return null
      }
      let { mtime } = file.stats
      mtime.setMilliseconds(0)
      return {
        maxAge: file.maxAge,
        mtime: mtime,
        size: file.stats.size,
        bufferOrPath: file.filePath,
        mimeType: decideContentType(file.filePath) || this.DEFAULT_CONTENT_TYPE
      }
    }
    const cacheingGzip = headers.gzip && !headers.range
    const key = cacheingGzip ? `gzip-${path}` : path
    let file: { filePath: string; stats: Stats; maxAge?: number } | undefined
    const cachedVal = await this.cache.computeIfAbsent(key, async () => {
      file = (await this.findFile(path)) || undefined
      if (!file) {
        return null
      }
      // 文件太大不能被缓存
      if (file.stats.size > this.maxFileSize) {
        return null
      }
      let buffer = await readFile(file.filePath)
      // gzip 存储压缩后的文件
      if (cacheingGzip) {
        buffer = await new Promise<Buffer>((resolve, reject) => {
          gzip(buffer, (err, res) => {
            if (err) {
              reject(err)
            } else {
              resolve(res)
            }
          })
        })
      }
      let { mtime } = file.stats
      mtime.setMilliseconds(0)
      return {
        buffer,
        mtime: mtime,
        cacheAge: file.maxAge,
        mimeType: decideContentType(file.filePath) || this.DEFAULT_CONTENT_TYPE
      }
    })
    if (cachedVal) {
      return {
        maxAge: cachedVal.cacheAge,
        mtime: cachedVal.mtime,
        size: cachedVal.buffer.length,
        bufferOrPath: cachedVal.buffer,
        mimeType: cachedVal.mimeType
      }
    }

    // 判定文件大小
    if (file) {
      let { mtime } = file.stats
      mtime.setMilliseconds(0)
      return {
        maxAge: file.maxAge,
        mtime: mtime,
        size: file.stats.size,
        bufferOrPath: file.filePath,
        mimeType: decideContentType(file.filePath) || this.DEFAULT_CONTENT_TYPE
      }
    }
    return null
  }
  /**
   * 根据路径查找文件
   * @param path 访问路径
   * @returns 返回被查询到的文件信息，如果找不到则返回 null
   */
  private async findFile(path: string): Promise<LocalFile | null> {
    let matchedRule: FlatServerStaticRules | undefined
    for (const rule of this.rules) {
      if (rule.path === '/') {
        matchedRule = rule
        break
      }
      if (path.startsWith(rule.path)) {
        matchedRule = rule
        break
      }
    }
    // 匹配失败
    if (!matchedRule) {
      return null
    }
    // 构建地址
    let finalPath = matchedRule.path === '/' ? path : path.substring(matchedRule.path.length)
    if (finalPath.startsWith('/')) {
      finalPath = finalPath.substring(1)
    }
    let filePath = resolve(matchedRule.dir, finalPath)
    if (!existsSync(filePath)) {
      return null
    }
    const fileStat = await stat(filePath)
    // 如果是目录，尝试查找 index.html
    if (fileStat.isDirectory()) {
      const indexPath = resolve(filePath, 'index.html')
      if (!existsSync(indexPath)) {
        return null
      }
      const indexStat = await stat(indexPath)
      if (!indexStat.isFile()) {
        return null
      }
      return { filePath: indexPath, stats: indexStat }
    }
    if (!fileStat.isFile()) {
      return null
    }
    return { filePath, stats: fileStat, maxAge: matchedRule.cacheAge }
  }
}
