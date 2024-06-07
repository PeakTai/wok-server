import { generateConfig } from '../../config'
import { PropValidator, max, min, notNull } from '../../validation'

/**
 * 服务器缓存配置
 * Server Cache Configuration
 */
export interface ServerCacheConfig {
  /**
   * Enable or disable caching,default is false (disabled)
   */
  enable: boolean
  /**
   *  The maximum age of the cache in seconds
   */
  maxAge: number
  /**
   * The maximum size of the cache in bytes
   * or a string representing a number followed by a unit of measure (e.g. 100k, 10m, 1g)
   */
  maxSize: number | string
  /**
   * The maximum size of a file in the cache in bytes
   * or a string representing a number followed by a unit of measure (e.g. 100k, 10m, 1g)
   */
  maxFileSize: number | string
}

export function parseSize(size: number | string): number {
  if (typeof size === 'number') {
    return size
  }
  const match = size.match(/^(\d+)([kmg]?)$/i)
  if (!match) {
    throw new Error(`Invalid size: ${size}`)
  }
  const [, num, unit] = match
  let sizeNum = parseInt(num, 10)
  switch (unit.toLowerCase()) {
    case 'k':
      sizeNum *= 1024
      break
    case 'm':
      sizeNum *= 1024 * 1024
      break
    case 'g':
      sizeNum *= 1024 * 1024 * 1024
      break
    default:
      break
  }
  return sizeNum
}

function validateSize(max: number | string): PropValidator<number | string> {
  const maxNum = parseSize(max)
  const validator = 'size'
  return val => {
    if (val === null || val === undefined) {
      return { ok: true }
    }
    const sizeNum = typeof val === 'number' ? val : parseSize(val)
    if (sizeNum < 1) {
      return { ok: false, validator, message: `size must greater than 1` }
    }
    if (sizeNum > maxNum) {
      return { ok: false, validator, message: `size must less than ${max}` }
    }
    return { ok: true }
  }
}
/**
 * 获取缓存的配置信息
 * @returns
 */
export function getConfig() {
  return generateConfig<ServerCacheConfig>(
    {
      enable: false,
      maxAge: 600,
      maxSize: '100m',
      maxFileSize: '10m'
    },
    'SERVER_STATIC_CACHE',
    {
      enable: [notNull()],
      maxAge: [notNull(), min(1), max(31536000)],
      maxSize: [notNull(), validateSize('1024g')],
      maxFileSize: [notNull(), validateSize('1g')]
    }
  )
}
