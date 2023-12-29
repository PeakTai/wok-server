import { equal, ok } from 'assert'
import {
  dailyTaskDelay,
  scheduleDailyTask,
  scheduleWithFixedDelay,
  scheduleWithFixedRate
} from '../src'
import { runTestAsync, sleep } from './utils'

interface TaskTime {
  start: number
  end: number
}
/**
 * 略大于，定时器是甚至 setTimeout 的，无法保证严格的时间正确，会有些许延迟，所以结果的时间都是略大于。
 * 但是并不能简单的判定为大于，这样测试就太不严格了，这个函数就是判定两个时间段数值第一个略大于大二个，
 * 在没有其它程序的情况下，符合 setTimeout 的一丁点延迟.
 */
function aLitteBiggerThan(time1: number, time2: number) {
  const diff = time1 - time2
  return diff >= 0 && diff < 100
}

describe('任务', () => {
  it(
    '固定延迟',
    runTestAsync(async () => {
      // 执行任务，然后将任务每次执行结束和开始时间记录下来
      const start = new Date().getTime()
      const res: TaskTime[] = []
      const controller = scheduleWithFixedDelay(1, 2, {
        name: '固定延迟测试',
        async run() {
          const time: TaskTime = { start: new Date().getTime(), end: 0 }
          await sleep(Math.floor(Math.random() * 1000))
          time.end = new Date().getTime()
          res.push(time)
        }
      })
      //1秒后，任务首次执行，任务执行要1秒内（随机），然后等2秒再执行...
      // 让任务可以执行两次至少需要5秒，这里等待6秒
      await sleep(6000)
      const [r1, r2] = res
      ok(aLitteBiggerThan(r1.start - start, 1000))
      // 第二次的开始时间和第一次的结束时间，相关应该在至少2s
      ok(aLitteBiggerThan(r2.start - r1.end, 2000))

      // 测试任务停止
      controller.stop()
      // 任务的执行时间是随机1秒内的，假如停止的时候还在执行，那么等待两秒，一定会结束
      await sleep(2000)
      // 记录结果数
      const length = res.length
      // 再等待几秒，任务应该不会再被执行
      await sleep(4000)
      equal(res.length, length)
    })
  )
  it(
    '固定频率',
    runTestAsync(async () => {
      const start = new Date().getTime()
      const res: TaskTime[] = []
      const controller = scheduleWithFixedRate(1, 2, {
        name: '固定频率测试',
        async run() {
          const time: TaskTime = { start: new Date().getTime(), end: 0 }
          // 模拟任务执行时间，随机
          await sleep(Math.floor(Math.random() * 1000))
          time.end = new Date().getTime()
          res.push(time)
        }
      })
      // 由于频率固定，所以每次任务的开始时间相差都是大约 2秒
      // 只要任务的时间小于周期，周期就是非常固定的
      // 再加上延迟1秒才开始，等待4秒足够运行两次
      // 第一次跑任务是第1秒，第二次跑任务是第3秒
      await sleep(4000)
      // 应当仅执行了两次
      equal(res.length, 2)
      const [r1, r2] = res
      ok(aLitteBiggerThan(r1.start - start, 1000))
      ok(aLitteBiggerThan(r2.start - r1.start, 2000))

      // 测试任务停止
      controller.stop()
      // 任务的执行时间是随机1秒内的，假如停止的时候还在执行，那么等待1秒，一定会结束
      await sleep(2000)
      // 记录结果数
      const length = res.length
      // 再等待几秒，超过任务的周期时间，任务应该不会再被执行
      await sleep(4000)
      equal(res.length, length)
    })
  )
  it(
    '每日任务',
    runTestAsync(async () => {
      // 验证时间的计算
      // 3 分钟后的时间
      let time = new Date()
      let now = time.getTime()
      time.setMilliseconds(0)
      time.setSeconds(0)
      time = new Date(time.getTime() + 3 * 60 * 1000)
      let taskTime = time.getTime()
      const delay1 = taskTime - now
      const delay2 = dailyTaskDelay(time.getHours(), time.getMinutes())
      ok(delay1 > 0)
      ok(delay2 > 0)
      ok(aLitteBiggerThan(delay1, delay2))

      // 一分钟前的时间，下次的任务时间应该是明天
      time = new Date()
      now = time.getTime()
      time.setMilliseconds(0)
      time.setSeconds(0)
      time = new Date(time.getTime() - 5 * 60 * 1000)
      const delay3 = dailyTaskDelay(time.getHours(), time.getMinutes())
      ok(delay3 > 0)
      ok(delay3 > 3600 * 23 * 1000)
      ok(aLitteBiggerThan(time.getTime() + 3600 * 24 * 1000, now + delay3))

      // 制造一个再过两分钟执行的任务
      // 为什么是两分钟，一分钟的话，如果刚好处在 59 秒 999 毫秒，很可能由于时间差错过了
      let count = 0
      time = new Date(new Date().getTime() + 2 * 60 * 1000)
      const controller = scheduleDailyTask(time.getHours(), time.getMinutes(), {
        name: '每日任务测试',
        async run() {
          count++
        }
      })
      console.log('等待一段时间验证任务结果')
      await sleep(dailyTaskDelay(time.getHours(), time.getMinutes()) + 100)
      controller.stop()
      equal(count, 1)
    })
  )
})
