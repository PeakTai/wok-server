# Lock

Locks coordinate multiple asynchronous operation flows, allowing these flows to execute sequentially. This is very useful in concurrent request scenarios. A request may have many asynchronous operations during processing. Under concurrent conditions, operations from different requests may interleave. If there are modification operations, errors may occur, such as inventory reduction and lottery draws.

## Usage

Use the getLockManager function to get the lock manager object, and call the tryLock method to attempt to acquire a lock and execute logic upon successful acquisition.

Simple scenario example code:

```ts
import { getLockManager } from 'wok-server'

interface Form {
  id: string
  quantity: number
}
// Create JSON handler, simulate inventory reduction request
createJsonHandler<Form>({
  validation: {
    id: [notBlank()],
    quantity: [notNull(), min(1), max(10)]
  },
  async handle(body, exchange) {
    const lock = getLockManager()
    const res = lock.tryLock({
      // Lock identifier, same identifiers create competition
      key: `reduce-quantity-${body.id}`,
      // Maximum wait time in seconds, tryLock returns false if lock not acquired within 2 seconds
      waitSeconds: 2,
      // Lock expiration time, set to hold lock for maximum 600 seconds to prevent deadlock
      // If timeout occurs, other processes can acquire the lock regardless of whether run function completes
      expiresInSeconds: 600,
      // Execution function, executed if lock acquired successfully
      // In concurrent request scenarios, requests that don't acquire the lock wait and execute in queue
      async run() {
        const product = await findProductById(body.id)
        if (product.quantity < body.quantity) {
          throw new BusinessException('Insufficient inventory')
        }
        await reduceQuantity(body.id, body.quantity)
      }
    })
    // tryLock returns boolean indicating whether lock was acquired successfully
    // If lock not acquired, provide business prompt
    if (!res) {
      throw new BusinessException('System busy, please try again later')
    }
  }
})
```