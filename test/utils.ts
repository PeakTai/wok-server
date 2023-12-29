import { fail } from 'assert'
/**
 * 执行异步测试，套一层只为了可以打印异常信息，方便找到错误
 * @param fn
 */
export function runTestAsync(fn: () => Promise<void>): () => PromiseLike<any> {
  return async function () {
    try {
      await fn()
    } catch (e) {
      console.error(e)
      throw e
    }
  }
}

/**
 * 沉睡
 * @param delay 延迟，单位毫秒
 * @returns
 */
export function sleep(delay: number) {
  return new Promise<void>(resolve => {
    global.setTimeout(resolve, delay)
  })
}

/**
 * 断言异步操作一定会出异常
 * @param run
 */
export async function assertAsyncThrows(opts: {
  run: () => Promise<void>
  assert: (err: any) => void
}) {
  try {
    await opts.run()
  } catch (e) {
    opts.assert(e)
    return
  }
  fail('指定的异步操作没有出异常')
}
