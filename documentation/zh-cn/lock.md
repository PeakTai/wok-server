# 锁

锁的作用是协调多个异步操作流程，使这些流程可以按顺序执行，在并发请求时会很有用。
一个请求的处理过程中可能有很多个异步操作，并发情况下，不同请求中的操作就会穿插执行，
如果有修改操作，有可能会造成错误，比如减库存和抽奖等。

## 使用

使用 getLockManager 函数可以获取锁管理对象，调用 tryLock 方法来尝试上锁并在成功获取锁后执行逻辑。

简单的场景示例代码：

```ts
import { getLockManager } from 'wok-server'

interface Form {
  id: string
  quantity: number
}
// 创建 json 主动处理器，模拟减库存请求
createJsonHandler<Form>({
  validation: {
    id: [notBlank()],
    quantity: [notNull(), min(1), max(10)]
  },
  async handle(body, exchange) {
    const lock = getLockManager()
    const res = lock.tryLock({
      // 锁的标识，标识相同产生竞争关系
      key: `reduce-quantity-${body.id}`,
      // 最多等待两秒，两秒内如果获取不到锁 tryLock 函数就返回 false
      waitSeconds: 2,
      // 锁的过期时间，这里设置最多只能拥有锁 600 秒，防止死锁
      // 如果超时就可以被其它的程序获取到锁，不管 run 函数执行完没有
      expiresInSeconds: 600,
      // 执行函数，获取锁成功就会被执行
      // 在请求并发的情况下，没有获取锁的请求处理则会等待，然后排队执行
      async run() {
        const product = await findProductById(body.id)
        if (product.quantity < body.quantity) {
          throw new BusinessException('库存不足')
        }
        await reduceQuantity(body.id,body.quantity)
      }
    })
    // tryLock 返回的结果是 boolean 类型，表示此次是否成功获取到锁
    // 没有获取到锁，给业务提示
    if (!res) {
      throw new BusinessException('系统繁忙，请稍后重试')
    }
  }
})
```