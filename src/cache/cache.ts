import { config } from './config'
import { CacheStat } from './stat'

/**
 * 缓存内容
 */
export interface CacheContent {
  /**
   * 保存的值
   */
  val: any
  /**
   * 过期时间
   */
  expireAt: number
}

export class Cache {
  /**
   * promise 表，作用是处理异步并发问题，如果有相同的 key 同时请求，保证异步的 provider 只执行一次
   */
  private promiseMap = new Map<string, Promise<any>>()

  constructor(
    private readonly valueMap: Map<string, CacheContent>,
    private readonly stat: CacheStat
  ) {}

  /**
   * 放入缓存
   * @param key
   * @param val
   * @param expiresInSeconds
   */
  put(key: string, val: any, expiresInSeconds?: number) {
    const finalExpiresInSeconds =
      typeof expiresInSeconds === 'number' ? expiresInSeconds : config.defaultExpireInSeconds
    this.valueMap.set(key, {
      val,
      expireAt: new Date().getTime() + finalExpiresInSeconds * 1000
    })
  }

  /**
   * 获取缓存值
   * @param key
   * @returns
   */
  get<T>(key: string): T | undefined {
    const content = this.valueMap.get(key)
    if (!content) {
      this.stat.addGet(false)
      return undefined
    }
    if (content.expireAt < new Date().getTime()) {
      this.stat.addGet(false)
      this.valueMap.delete(key)
      return undefined
    }
    this.stat.addGet(true)
    return content.val
  }
  /**
   * 清除所有缓存
   */
  clear() {
    this.valueMap.clear()
    this.stat.clear()
  }

  /**
   * 删除.
   * @param key
   */
  remove(key: string) {
    this.valueMap.delete(key)
  }

  /**
   * 在缓存值不存在时计算缓存的值，然后放入并返回.
   * @param key
   * @param provider
   * @param expiresInSeconds
   */
  async computeIfAbsent<T>(
    key: string,
    provider: () => Promise<T> | T,
    expiresInSeconds?: number
  ): Promise<T> {
    const content = this.valueMap.get(key)
    if (content && content.expireAt >= new Date().getTime()) {
      this.stat.addGet(true)
      return content.val
    }
    this.stat.addGet(false)
    // 如果已经在处理中，则直接返回 promise
    const ep = this.promiseMap.get(key)
    if (ep) {
      return ep
    }
    // 创建新的异步流程
    const promise = Promise.resolve().then(async () => {
      const finalExpireInSeconds =
        typeof expiresInSeconds === 'number' ? expiresInSeconds : config.defaultExpireInSeconds
      // 计算值
      const res = provider()
      const val = res instanceof Promise ? await res : res
      this.put(key, val, finalExpireInSeconds)
      this.promiseMap.delete(key)
      return val
    })
    this.promiseMap.set(key, promise)
    return promise
  }
}
