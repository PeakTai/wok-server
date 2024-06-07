export interface CacheVal {
  /**
   * 文件内容
   */
  buffer: Buffer
  /**
   * 媒体类型
   */
  mimeType: string
  /**
   * 修改时间
   */
  mtime: Date
  /**
   * 客户端缓存时间
   */
  cacheAge?: number
}

/**
 * 缓存内容
 */
interface CacheContent extends CacheVal {
  /**
   * 过期时间
   */
  expireAt: number
}

/**
 * 文件的服务器缓存
 */
export class ServerCache {
  /**
   * 当前的缓存内容大小，单位字节
   */
  private size = 0
  /**
   * 缓存内容
   */
  private readonly cacheMap = new Map<string, CacheContent>()

  /**
   * promise 表，作用是处理异步并发问题，如果有相同的 key 同时请求，保证异步的 provider 只执行一次
   */
  private promiseMap = new Map<string, Promise<CacheVal | null>>()

  constructor(
    private readonly opts: {
      /**
       * 最大缓存大小，超出后将出触发清除缓存操作
       */
      maxSize: number
      /**
       * 缓存时长，单位秒
       */
      maxAge: number
    }
  ) {}
  /**
   * 获取缓存
   */
  get(key: string): CacheVal | null {
    const data = this.cacheMap.get(key)
    if (data) {
      if (data.expireAt < Date.now()) {
        this.cacheMap.delete(key)
        return null
      }
      return data
    }
    return null
  }
  /**
   * 设置缓存内容，如果缓存内容超过最大缓存大小，则触发清除缓存操作
   * @param key
   * @param value
   * @returns
   */
  set(key: string, value: CacheVal) {
    const expireAt = Date.now() + this.opts.maxAge * 1000
    const content = value as CacheContent
    content.expireAt = expireAt
    this.cacheMap.set(key, content)
    this.size += content.buffer.length
    if (this.size > this.opts.maxSize) {
      setTimeout(() => this.clean(), 0)
    }
  }
  /**
   * 删除缓存
   */
  remove(key: string) {
    const data = this.cacheMap.get(key)
    if (data) {
      this.cacheMap.delete(key)
      this.size -= data.buffer.length
    }
  }
  /**
   * 如果缓存不存在，则计算缓存内容并放入缓存
   * @param key
   * @param provider 计算函数，返回值将放入缓存，如果返回 null 则表示未能计算出缓存内容，不进行缓存
   */
  async computeIfAbsent(
    key: string,
    provider: () => Promise<CacheVal | null>
  ): Promise<CacheVal | null> {
    const data = this.get(key)
    if (data) {
      return data
    }
    // 如果已经在处理中，则直接返回 promise
    const ep = this.promiseMap.get(key)
    if (ep) {
      return ep
    }
    const promise = Promise.resolve().then(async () => {
      try {
        const res = await provider()
        if (res) {
          this.set(key, res)
        }
        return res
      } finally {
        this.promiseMap.delete(key)
      }
    })
    this.promiseMap.set(key, promise)
    return promise
  }
  /**
   * 清理无用的缓存内容
   */
  private clean() {
    // 先清理掉过期的
    const keys = Array.from(this.cacheMap.keys())
    for (const key of keys) {
      const data = this.cacheMap.get(key)
      if (data) {
        if (data.expireAt < Date.now()) {
          this.cacheMap.delete(key)
          this.size -= data.buffer.length
        }
      }
    }
    if (this.size < this.opts.maxSize) {
      return
    }
    const keys2 = Array.from(this.cacheMap.keys())
    // 再逐个清理，直到空间不会超出最大缓存大小
    for (const key of keys2) {
      if (this.size < this.opts.maxSize * 0.8) {
        break
      }
      const data = this.cacheMap.get(key)
      if (data) {
        this.cacheMap.delete(key)
        this.size -= data.buffer.length
      }
    }
  }

  /**
   * 清除缓存内容
   */
  clear() {
    this.cacheMap.clear()
    this.size = 0
  }
}
