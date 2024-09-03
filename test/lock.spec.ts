import { equal, ok } from 'assert'
import { getLockManager } from '../src'
import { runTestAsync, sleep } from './utils'

describe('锁测试', () => {
  it(
    '顺序处理',
    runTestAsync(async () => {
      const lock = getLockManager()

      let count = 0

      // 测试函数，含有多个异步操作
      async function test() {
        return lock.tryLock({
          key: 'test',
          waitSeconds: 10,
          async run() {
            let c = count
            count++
            await sleep(500)
            // count 一定是 c + 1 , 别的异步操作不会在这个过程中进行处理
            equal(count, c + 1)
            count++
            await sleep(300)
            equal(count, c + 2)
          }
        })
      }

      const res = await Promise.all([test(), test(), test()])
      ok(res[0])
      ok(res[1])
      ok(res[2])
      // 执行3次函数，共加了6次
      equal(count, 6)
    })
  )

  it(
    '竞争',
    runTestAsync(async () => {
      const lock = getLockManager()

      async function test1() {
        return lock.tryLock({
          key: 'test2',
          async run() {
            await sleep(500)
          }
        })
      }

      const res = await Promise.all([test1(), test1(), test1(), test1(), test1()])
      // 只有一个可以获取到锁
      const successedCount = res.filter(item => item).length
      equal(1, successedCount)

      // 执行完成后，锁被释放，再获取一定可以获取到
      const res2 = lock.tryLock({
        key: 'test2',
        async run() {
          await sleep(100)
        }
      })
      ok(res2)

      // 等待时间验证
      async function test2(waitSeconds: number) {
        return lock.tryLock({
          key: 'test3',
          waitSeconds,
          async run() {
            await sleep(2000)
          }
        })
      }

      // 先执行一次获取到锁
      const res3 = test2(100)

      const res4 = await Promise.all([
        // 等待 1s ，第一个函数还在持有锁，获取不到
        test2(1),
        // 2s 后第一个函数释放锁，等待 3s 可以获取到
        test2(3)
      ])

      ok(!res4[0])
      ok(res4[1])
      ok(await res3)
    })
  )

  it(
    '过期',
    runTestAsync(async () => {
      const lock = getLockManager()
      // 获取锁，锁2s后过期，但是执行过程有 3s
      const res1 = lock.tryLock({
        key: 'test4',
        expiresInSeconds: 2,
        async run() {
          await sleep(3000)
        }
      })
      await sleep(1000)
      const res2 = await lock.tryLock({
        key: 'test4',
        async run() {
          console.log('获取不到锁，不会被输出')
        }
      })
      ok(!res2)
      // 再等待1.2 s ，共等待 2.2秒，锁已经过期
      await sleep(1200)
      const res3 = await lock.tryLock({
        key: 'test4',
        async run() {
          console.log('锁过期，成功获取到锁')
        }
      })
      ok(res3)

      ok(await res1)
    })
  )
})
