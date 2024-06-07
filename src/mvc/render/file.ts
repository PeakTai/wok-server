import { createReadStream, existsSync } from 'fs'
import { stat } from 'fs/promises'
import { IncomingMessage, ServerResponse } from 'http'
import { basename } from 'path'
import { createGzip } from 'zlib'
import { decideContentType } from '../static'
import { renderError } from './json'


/**
 * 响应一个文件.
 * @param request  请求信息
 * @param response 响应信息
 * @param filePath 文件路径，如果文件不存在，则会响应 404
 * @param download 是否下载
 */
export async function renderFile(
  request: IncomingMessage,
  response: ServerResponse,
  filePath: string,
  download = false
): Promise<void> {
  if (!existsSync(filePath)) {
    renderError(response, 'Cannot find file.', 404)
    return
  }
  const fileName = basename(filePath)

  let isDownload = false
  let contentType: string | undefined
  if (download) {
    isDownload = true
  } else {
    contentType = decideContentType(fileName)
    if (!contentType) {
      isDownload = true
    }
  }

  if (isDownload) {
    response.setHeader('Content-Type', 'application/octet-stream')
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(fileName)}"`
    )
  } else if (contentType) {
    response.setHeader('Content-Type', contentType)
  }
  const statRes = await stat(filePath)
  // 支持 If-Modified-Since
  // 由于只是简单的文件映射，没有 etag，不能支持 If-None-Match
  // 缓存校验只能支持时间的比对，修改时间是文件系统本来就有的
  if (request.headers['if-modified-since']) {
    const modifiedSince = new Date(request.headers['if-modified-since'])
    // 判定日期是否有效
    if (modifiedSince instanceof Date && !isNaN(modifiedSince.getTime())) {
      // 比较更改日期，只精确到秒, UTC 格式只精确到秒，但是 mtime 是包含毫秒的
      const { mtime } = statRes
      mtime.setMilliseconds(0)
      if (modifiedSince >= mtime) {
        response.statusCode = 304
        response.setHeader('Last-Modified', statRes.mtime.toUTCString())
        response.end()
        return
      }
    }
  }

  // 支持 Range
  // https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Range
  const rangeHeader = request.headers['range']
  if (!rangeHeader) {
    response.setHeader('Last-Modified', statRes.mtime.toUTCString())
    return streamFile(filePath, request, response)
  }
  // 解析，range 示例：bytes=200-1000, 2000-6576, 19000-
  // 多段的情况，暂时不做支持，非常麻烦，段数多还可能会有效率问题
  // 如果不是字节范围不是以字节为单位，暂时也不做支持
  const ranges = rangeHeader.split(',')
  let range = ranges.length ? ranges[0] : undefined
  if (!range) {
    return streamFile(filePath, request, response)
  }
  range = range.trim()
  if (!range.startsWith('bytes=')) {
    return streamFile(filePath, request, response)
  }
  range = range.substring(6)
  const strs = range.split('-')
  let start = strs[0] ? parseInt(strs[0], 10) : NaN
  let end = strs[1] ? parseInt(strs[1], 10) : NaN
  // 解析文件
  if (isNaN(start) || start < 0) {
    // 范围不合法，返回 416
    renderError(response, `Range not satisfiable，start is ${start}`, 416)
    return
  }
  if (isNaN(end)) {
    end = statRes.size - 1
  } else if (end > statRes.size - 1) {
    // 范围不合法，返回 416
    renderError(
      response,
      `Range not satisfiable，end must not be greater than ${statRes.size - 1}`,
      416
    )
    return
  }
  // 注：Range 和 Content-Range 还有 createReadStream 中的字节范围，都是前后全包含的
  // Content-Range: bytes 42-1233/1234
  response.setHeader('Content-Range', `bytes ${start}-${end}/${statRes.size}`)
  return streamFile(filePath, request, response, { start, end })
}

function streamFile(
  filePath: string,
  request: IncomingMessage,
  response: ServerResponse,
  opts?: { start?: number; end?: number }
): Promise<void> {
  return new Promise<void>((res, rej) => {
    if (opts && typeof opts.start === 'number') {
      // 部分返回 206
      response.statusCode = 206
    } else {
      // 全部返回 200
      response.statusCode = 200
    }
    // 支持 gzip
    const acceptEncoding = request.headers['accept-encoding'] as string
    if (acceptEncoding) {
      // Accept-Encoding: br;q=1.0, gzip;q=0.8, *;q=0.1
      const acceptEncodings = acceptEncoding
        .trim()
        .split(',')
        .map(item => item.trim())
        .map(item => item.split(';')[0])
      if (acceptEncodings.includes('gzip') || acceptEncodings.includes('*')) {
        response.setHeader('Content-Encoding', 'gzip')
        createReadStream(filePath, opts).pipe(createGzip()).pipe(response)
        response.once('finish', res).once('error', rej)
        return
      }
    }
    createReadStream(filePath, opts).pipe(response)
    response.once('finish', res).once('error', rej)
  })
}
