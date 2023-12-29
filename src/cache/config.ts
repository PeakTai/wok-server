import { registerConfig } from '../config'
import { max, min, notNull } from '../validation'

/**
 * 缓存的配置
 */
interface CacheConfig {
  /**
   * 默认的存活时长，取值：1-3600，默认 60。存活时间应该尽可能的短，尤其是当缓存的内容比较大时，
   * 否则缓存的内容长时间占用内存，会对 gc 造成影响。
   */
  defaultExpireInSeconds: number
  /**
   * 是否启用统计任务，启用后每隔指定的时间打印一次缓存统计信息，用于了解缓存的情况.
   */
  statTaskEnabled: boolean
  /**
   * 统计任务执行的周期,单位秒，取值 60-3600。统计周期也即是时间窗口，
   * 每个周期都是独立的，只统计这个周期内的缓存使用情况。
   */
  statInterval: number
  /**
   * 最大元素数量，为了控制缓存占用的内存空间，可以将 maxElements 设置的低一些。
   */
  maxElements: number
  /**
   * 数据清理任务执行周期，单位秒.取值 1-3600，清理任务完成两件事：删除过期数据和驱逐多余记录。
   * 如果项目规模小，缓存的内容非常少，可以将间隔设置长一些，降低频率.
   * 如果缓存的内容很多，频率需要高一些，及时将无效数据清理掉。
   * 否则缓存会长时间占用很高的内存无法被回收，回收器完成检查却需要很长时间，影响gc效率.
   */
  cleaningInterval: number
}

const ENV_PREFIX = 'CACHE'

export const config = registerConfig<CacheConfig>(
  {
    defaultExpireInSeconds: 60,
    statTaskEnabled: false,
    statInterval: 300,
    maxElements: 1024,
    cleaningInterval: 60
  },
  ENV_PREFIX,
  {
    defaultExpireInSeconds: [notNull(), min(1), max(3600)],
    statTaskEnabled: [notNull()],
    statInterval: [notNull(), min(1), max(3600 * 24)],
    maxElements: [notNull(), min(1), max(Number.MAX_VALUE)],
    cleaningInterval: [notNull(), min(1), max(3600)]
  }
)
