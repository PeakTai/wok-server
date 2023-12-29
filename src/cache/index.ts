import { scheduleWithFixedDelay } from '../task'
import { Cache } from './cache'
import { config } from './config'
import { PurgeTask } from './purge-task'
import { CacheStat } from './stat'

const valueMap = new Map<string, any>()
const stat = new CacheStat(valueMap)
const cache = new Cache(valueMap, stat)

// 清理任务
scheduleWithFixedDelay(config.cleaningInterval, config.cleaningInterval, new PurgeTask(valueMap))

// 统计任务
if (config.statTaskEnabled) {
  scheduleWithFixedDelay(config.statInterval, config.statInterval, {
    name: 'cache statistics',
    async run() {
      stat.log()
      stat.clear()
    }
  })
}

export function getCache() {
  return cache
}
