import { getLogger } from '../log'
import { Task } from '../task'
import { CacheContent } from './cache'
import { config } from './config'

/**
 * 缓存清理任务
 */
export class PurgeTask implements Task {
  readonly name = 'Cache purge'

  constructor(private readonly valueMap: Map<string, CacheContent>) {}

  async run(): Promise<void> {
    let removeCount = 0
    for (const entry of this.valueMap.entries()) {
      const [key, value] = entry
      if (value.expireAt < new Date().getTime()) {
        this.valueMap.delete(key)
        removeCount++
      }
    }
    if (removeCount > 0) {
      getLogger().info(
        `A total of ${removeCount} expired cache ${
          removeCount > 1 ? 'records' : 'record'
        } have been cleared.`
      )
    }

    // 如果过期的都清理掉，但是元素总数仍然超出，则删除多余元素，删除是从头开始删除的
    // 看上去是按put顺序清理最早的，实际上随机的，重复 set 相同的 key，key 的位置是不会变的，不保证 key 的顺序
    // 所以，缓存是随机驱逐的
    // 目前没有考虑支持其它的策略，因为需要额外记录信息，清理的逻辑也可能更复杂
    // nodejs 是单线程模式的，规模上去后，可能需要执行较长的时间带来阻塞
    if (this.valueMap.size > config.maxElements) {
      let diff = this.valueMap.size - config.maxElements
      let evictedCount = 0
      for (const key of this.valueMap.keys()) {
        this.valueMap.delete(key)
        evictedCount++
        if (evictedCount >= diff) {
          break
        }
      }
      getLogger().info(
        `A total of ${evictedCount} cache ${
          evictedCount > 1 ? 'records' : 'record'
        } have been evicted.`
      )
    }
  }
}
