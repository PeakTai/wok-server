import { IncomingHttpHeaders } from 'http'
/**
 * 解析 range 消息头，如果解析失败，返回 null
 */
function parseRange(rangeHeader: string): null | { start: number; end?: number } {
  // 解析，range 示例：bytes=200-1000, 2000-6576, 19000-
  // 多段的情况，暂时不做支持，非常麻烦，段数多还可能会有效率问题
  // 如果不是字节范围不是以字节为单位，暂时也不做支持
  const ranges = rangeHeader.split(',')
  if (!ranges.length) {
    return null
  }
  let range = ranges[0].trim()
  if (!range.startsWith('bytes=')) {
    return null
  }
  range = range.substring(6)
  const strs = range.split('-')
  let start = strs[0] ? parseInt(strs[0], 10) : NaN
  let end = strs[1] ? parseInt(strs[1], 10) : undefined
  return { start, end }
}

/**
 * 静态资源消息头信息
 */
export interface StaticHeaders {
  /**
   * If-Modified-Since 消息头，测试文件是否在某个时间后修改后
   */
  ifModifiedSince?: Date
  /**
   * 文件部分读取
   */
  range?: { start: number; end?: number }
  /**
   * 是否接受 gzip 压缩，如果支持则压缩后返回
   */
  gzip: boolean
}

/**
 * 解析消息头，返回静态文件处理需要的信息
 * @param headers
 */
export function parseHeaders(headers: IncomingHttpHeaders) {
  // 是否支持 gzip
  const acceptEncoding = headers['accept-encoding'] as string
  let acceptGzip = false
  if (acceptEncoding) {
    // Accept-Encoding: br;q=1.0, gzip;q=0.8, *;q=0.1
    const acceptEncodings = acceptEncoding
      .trim()
      .split(',')
      .map(item => item.trim())
      .map(item => item.split(';')[0])
    if (acceptEncodings.includes('gzip') || acceptEncodings.includes('*')) {
      acceptGzip = true
    }
  }
  let res: StaticHeaders = {
    gzip: acceptGzip
  }

  // 支持 If-Modified-Since
  // 由于只是简单的文件映射，没有 etag，不能支持 If-None-Match
  const ifModifiedSince = headers['if-modified-since']
  if (ifModifiedSince) {
    const modifiedSince = new Date(ifModifiedSince)
    if (modifiedSince instanceof Date && !isNaN(modifiedSince.getTime())) {
      res.ifModifiedSince = modifiedSince
    }
  }

  // 支持 Range
  // https://developer.mozilla.org/zh-CN/docs/Web/HTTP/Headers/Range
  const rangeHeader = headers['range']
  if (rangeHeader) {
    const rangeRes = parseRange(rangeHeader)
    if (rangeRes) {
      res.range = rangeRes
    }
  }

  return res
}
