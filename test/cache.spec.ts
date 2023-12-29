import { equal, notEqual, ok } from 'assert'
import { getCache } from '../src'
import { runTestAsync, sleep } from './utils'

describe('缓存测试', () => {
  it(
    '常规功能',
    runTestAsync(async function () {
      const cache = getCache()
      cache.put('abc', 123)
      let value = cache.get('abc')
      equal(value, 123)
      const data = {
        name: 'Jack',
        dept: 'developer'
      }
      cache.put('abc', data)
      value = cache.get('abc')
      notEqual(value, 123)
      equal(value, data)

      // 过期时间
      cache.put('d', 2233, 1)
      value = cache.get('d')
      equal(value, 2233)
      await sleep(1100)
      value = cache.get('d')
      ok(value === undefined)

      // 删除
      cache.put('ff', new Date())
      value = cache.get('ff')
      ok(value instanceof Date)
      cache.remove('ff')
      value = cache.get('ff')
      ok(value === undefined)

      // 清空
      cache.put('id1', 1122)
      cache.put('id2', 2233)
      cache.put('id3', 3344)
      value = cache.get('id3')
      ok(value)
      cache.clear()
      ok(!cache.get('id1'))
      ok(!cache.get('id2'))
      ok(!cache.get('id3'))

      let count = 0
      const value2 = await cache.computeIfAbsent('k3', async () => {
        count++
        await sleep(1000)
        return 'abcd'
      })
      equal(value2, 'abcd')
      equal(count, 1)
      // 多次异步调用也只会执行一次
      count = 0
      const res = await Promise.all(
        [...new Array(100).keys()].map(() =>
          cache.computeIfAbsent('k4', async () => {
            count++
            await sleep(1000)
            return 'jjjjjj'
          })
        )
      )
      for (const val of res) {
        equal(val, 'jjjjjj')
      }
      equal(count, 1)
    })
  )

  it(
    '驱逐',
    runTestAsync(async function () {
      // 现在设置的缓存清理周期是 5s，最大100条记录
      // 放置数据，然后等待 5s，再验证被回收的情况
      const cache = getCache()
      cache.clear()
      // 这里的索引倒放的， 1-100 是最后放入的
      // 如果中间没有其它的操作，那么先放入的会被驱逐，刚好 1-100 被保留下来，101-120被删除
      for (let i = 120; i > 0; i--) {
        cache.put(`key-${i}`, i, 20)
      }
      equal(cache.get(`key-1`), 1)
      equal(cache.get(`key-50`), 50)
      equal(cache.get(`key-100`), 100)
      equal(cache.get(`key-120`), 120)
      // 沉睡超过5秒，等待任务执行完成，清理任务应该执行很快的
      await sleep(5100)
      ok(cache.get(`key-120`) === undefined)
      ok(cache.get(`key-110`) === undefined)
      ok(cache.get(`key-101`) === undefined)
      equal(cache.get(`key-1`), 1)
      equal(cache.get(`key-50`), 50)
      equal(cache.get(`key-100`), 100)

      await sleep(3000)
      // 注，缓存的统计是8秒一次，但是无法自动验证，需要人工观察控制台输出
      // 共 get 10 次，有3次 undefined ，命中应该是 7 次
      // 元素数量应该是满 100 的
    })
  )
})
