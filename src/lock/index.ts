import { randomUUID } from 'crypto'

export interface LockInfo {
  /**
   * 一个随机值，用于验证锁是否为当前程序所拥有
   */
  value: string
  /**
   * 锁过期的时间
   */
  expiresAt: number
}

/**
 * 锁管理器，主要用于将不确定的顺序且有冲突的异步操作顺序执行，
 * 防止异步流程庞大穿插执行造成的数据混乱和错误，常见于请求的处理。
 */
class ServerLockManager {
  /**
   * 存储锁信息的表，值是一个随机值，用于验证锁是否为当前程序所拥有
   */
  private lockMap = new Map<string, LockInfo>()

  constructor() {
    // 定期清理，将过期的信息移除，防止内存泄漏
    setTimeout(() => {
      const keysToBeDeleted: string[] = []
      const now = Date.now()
      for (const entry of this.lockMap.entries()) {
        const [key, info] = entry
        if (info.expiresAt < now) {
          keysToBeDeleted.push(key)
        }
      }
      if (keysToBeDeleted.length) {
        for (const key of keysToBeDeleted) {
          this.lockMap.delete(key)
        }
      }
    }, 10000)
  }

  /**
   * 尝试竞争锁，如果成功获取到锁，则执行 run 函数
   * @param opts
   * @returns 是否获取到锁
   */
  async tryLock(opts: {
    /**
     * 竞争锁的标识，相同的 key 会处于竞争关系，从而按顺序执行
     */
    key: string
    /**
     * 等待秒数，如果没有获取锁，要等待的时间，单位秒。
     * 不设置的情况下则不会等待，获取不到锁就立即返回。
     */
    waitSeconds?: number
    /**
     * 运行函数，成功获取锁就会执行
     * @returns
     */
    run: () => Promise<void>
    /**
     * 过期时间，单位秒。目的是防止一个程序长期占用锁，导致其它程序获取不到锁一直不能被执行
     * 导致的死锁问题。锁一旦过期，当前程序就不再拥有锁，其它程序就可以获取到锁。默认 60 秒。
     */
    expiresInSeconds?: number
  }): Promise<boolean> {
    const value = randomUUID().toString()
    const expiresInSeconds =
      typeof opts.expiresInSeconds === 'number' && opts.expiresInSeconds > 0
        ? opts.expiresInSeconds
        : 60
    const expiresAt = Date.now() + expiresInSeconds * 1000
    const waitSeconds =
      typeof opts.waitSeconds === 'number' && opts.waitSeconds > 0 ? opts.waitSeconds : 0
    const res = await this.waitLock({
      key: opts.key,
      value,
      expiresAt,
      waitSeconds
    })
    if (!res) {
      return false
    }
    try {
      await opts.run()
    } finally {
      // 解锁
      const info = this.lockMap.get(opts.key)
      if (info && info.value === value) {
        this.lockMap.delete(opts.key)
      }
    }
    return true
  }
  /**
   * 等待锁
   * @param opts
   */
  private async waitLock(opts: {
    /**
     * 竞争锁的标识，相同的 key 会处于竞争关系，从而按顺序执行
     */
    key: string
    /**
     * 值
     */
    value: string
    /**
     * 等待秒数，如果没有获取锁，要等待的时间，单位秒。
     */
    waitSeconds: number
    /**
     * 过期时间
     */
    expiresAt: number
  }): Promise<boolean> {
    let start = Date.now()
    while (true) {
      const info = this.lockMap.get(opts.key)
      // 锁不存在或已经过期
      if (!info || info.expiresAt < Date.now()) {
        // 成功获取到锁
        this.lockMap.set(opts.key, {
          value: opts.value,
          expiresAt: opts.expiresAt
        })
        return true
      }
      if (info.value === opts.value) {
        return true
      }
      if (Date.now() - start > opts.waitSeconds * 1000) {
        break
      }
      await this.sleep()
    }
    return false
  }
  /**
   * 沉睡
   * @returns
   */
  private sleep() {
    return new Promise<void>((resolve, reject) => {
      setTimeout(resolve, 0)
    })
  }
}

let lockManager: ServerLockManager | undefined

/**
 * 获取锁管理器。锁管理器提供一个简单的异步并发控制，用于将不确定的顺序的有冲突的异步操作顺序执行，
 * 防止异步流程庞大穿插执行造成的数据混乱和错误，常见于请求的处理。
 * @returns
 */
export function getLockManager(): ServerLockManager {
  if (!lockManager) {
    lockManager = new ServerLockManager()
  }
  return lockManager
}
