---
name: wok-server-lock
description: wok-server 锁组件使用指南，协调并发请求中的异步操作，防止数据竞争。
license: MIT
metadata:
  author: Peak Tai
  email: peaktai@qq.com
---

# wok-server 锁组件

## 概述

锁组件基于内存实现简单的异步并发控制，用于将不确定顺序、有冲突的异步操作按顺序执行。典型场景：减库存、抽奖等并发修改操作。

**注意**：这是进程内锁，只能协调单进程内的异步流程。如果需要分布式锁，应使用外部方案（如 Redis）。

## 源码与类型定义

安装 `wok-server` 后，可通过以下路径查看源码与类型定义：

- 源码目录：`node_modules/wok-server/src/lock/`
- 类型定义：`node_modules/wok-server/types/` （引用 lock 组件的 `.d.ts` 文件）

核心源码文件：

| 文件            | 说明                               |
| :-------------- | :--------------------------------- |
| `index.ts`      | `ServerLockManager`、`getLockManager` |

---

## 使用

```ts
import { getLockManager } from 'wok-server'

const lockManager = getLockManager()
```

`getLockManager()` 返回全局单例 `ServerLockManager`。

---

## tryLock — 竞争锁

```ts
function tryLock(opts: {
  key: string
  run: () => Promise<void>
  waitSeconds?: number
  expiresInSeconds?: number
}): Promise<boolean>
```

| 参数               | 说明                                                                 |
| :----------------- | :------------------------------------------------------------------- |
| `key`              | 锁标识，相同 key 产生竞争关系，排队执行                               |
| `run`              | 获取锁成功后执行的异步函数                                            |
| `waitSeconds`      | 等待秒数（可选），不设置或 ≤0 则获取不到立即返回 `false`              |
| `expiresInSeconds` | 锁过期时间（秒），默认 60。防止持有者异常退出导致死锁                  |

返回值 `boolean`：`true` 表示成功获取锁并执行完毕，`false` 表示等待超时未获取到锁。

---

## 完整示例

```ts
import { createJsonHandler, getLockManager, notBlank, notNull, min, max } from 'wok-server'

interface Form {
  id: string
  quantity: number
}

createJsonHandler<Form>({
  validation: {
    id: [notBlank()],
    quantity: [notNull(), min(1), max(10)]
  },
  async handle(body) {
    const lock = getLockManager()
    const acquired = await lock.tryLock({
      key: `reduce-quantity-${body.id}`,
      waitSeconds: 2,
      expiresInSeconds: 600,
      async run() {
        const product = await findProductById(body.id)
        if (product.quantity < body.quantity) {
          throw new BusinessException('库存不足')
        }
        await reduceQuantity(body.id, body.quantity)
      }
    })
    if (!acquired) {
      throw new BusinessException('系统繁忙，请稍后重试')
    }
  }
})
```

---

## 内部实现要点

### 锁结构

```ts
interface LockInfo {
  value: string    // 随机 UUID，验证锁归属
  expiresAt: number // 过期时间戳（ms）
}
```

底层为 `Map<string, LockInfo>`，`key` 是锁标识，`value` 是随机值 + 过期时间。

### 竞争流程

`tryLock` → `waitLock`（循环尝试获取锁）：

1. 检查 `lockMap` 中是否存在对应 key
2. 不存在或已过期 → `lockMap.set(key, { value, expiresAt })` → 获取成功
3. 存在且未过期 → 等待一次 `setTimeout(0)`（让出事件循环）→ 继续循环
4. 超时 `waitSeconds` → 返回 `false`

### 锁释放

`run()` 执行完（成功或抛异常）后，在 `finally` 中验证 `value` 一致后 `delete(key)` 释放锁。

### 死锁防护

- **过期机制**：每个锁有 `expiresAt`，到期后其他竞争者可以覆盖获取
- **定期清理**：`ServerLockManager` 构造时启动 10 秒间隔的过期锁清理，防止 `lockMap` 内存泄漏

### sleep 实现

```ts
private sleep() {
  return new Promise<void>(resolve => setTimeout(resolve, 0))
}
```

通过 `setTimeout(0)` 让出事件循环，给其他异步操作（包括锁持有者的 `run()` 执行和释放）创造执行机会。
