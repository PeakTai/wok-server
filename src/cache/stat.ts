import { getLogger } from '../log'
import { formatDateTime } from '../log/date'
import { config } from './config'

/**
 * 缓存统计.
 */
export class CacheStat {
  /**
   * 开始统计时间
   */
  private start: Date
  private totalGet = 0
  private totalHit = 0

  constructor(private readonly valueMap: Map<string, any>) {
    this.start = new Date()
  }
  /**
   * 添加 get 次数
   * @param hit 是否命中
   */
  addGet(hit: boolean) {
    this.totalGet++
    if (hit) {
      this.totalHit++
    }
  }
  /**
   * 清空统计信息，重新开始统计.
   */
  clear() {
    this.start = new Date()
    this.totalGet = 0
    this.totalHit = 0
  }
  /**
   * 输出日志
   */
  log() {
    getLogger().info(
      `Cache statistics，time window ：${formatDateTime(this.start)} - now， hit ：${
        this.totalHit
      }/${this.totalGet}，capacity：${this.valueMap.size}/${config.maxElements}`
    )
  }
}
