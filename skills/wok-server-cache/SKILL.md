---
name: wok-server-cache
description: wok-server 缓存组件使用指南，提供内存缓存功能，支持过期时间、随机淘汰策略和统计信息。
license: MIT
metadata:
  author: Peak Tai
  email: peaktai@qq.com
---

# wok-server 缓存组件

## 概述

缓存组件提供基于内存的简单缓存，采用**随机淘汰**驱逐策略，支持过期时间。适合缓存少量短期数据。

如需大量数据缓存或避免影响 GC，应考虑外部方案（Redis 等）或堆外内存（Buffer）。

## 源码与类型定义

安装 `wok-server` 后，可通过以下路径查看源码与类型定义：

- 源码目录：`node_modules/wok-server/src/cache/`
- 类型定义：`node_modules/wok-server/types/` （引用 cache 组件的 `.d.ts` 文件）

核心源码文件：

| 文件              | 说明                           |
| :---------------- | :----------------------------- |
| `cache.ts`        | Cache 类，核心缓存逻辑          |
| `config.ts`       | 缓存配置，环境变量映射          |
| `purge-task.ts`   | 清理任务，删除过期和多余数据     |
| `stat.ts`         | 命中率统计                      |
| `index.ts`        | 模块入口，导出 `getCache` 函数  |

---

## 获取缓存实例

```ts
import { getCache } from 'wok-server'
const cache = getCache()
```

`getCache()` 返回全局单例的 `Cache` 实例，模块加载时即完成初始化并启动后台清理任务。

---

## 环境变量

| 环境变量                        | 说明                         | 默认值 |
| :------------------------------ | :--------------------------- | :----- |
| `CACHE_DEFAULT_EXPIRE_IN_SECONDS` | 默认过期时间（秒），1-3600   | 60     |
| `CACHE_STAT_TASK_ENABLED`       | 是否启用统计任务              | false  |
| `CACHE_STAT_INTERVAL`           | 统计周期（秒），1-86400      | 300    |
| `CACHE_CLEANING_INTERVAL`       | 清理间隔（秒），1-3600       | 60     |
| `CACHE_MAX_ELEMENTS`            | 最大元素数，1-Number.MAX_VALUE | 1024   |

---

## 基本操作

### put — 写入缓存

```ts
cache.put(key: string, val: any, expiresInSeconds?: number): void
```

- `key`：缓存键
- `val`：缓存值，任意类型
- `expiresInSeconds`：过期时间（秒），可选，不传则使用 `CACHE_DEFAULT_EXPIRE_IN_SECONDS` 的默认值（默认 60 秒）

```ts
cache.put('abc', 123)                // 默认 60 秒过期
cache.put('d', 2233, 1)              // 1 秒后过期
```

### get — 读取缓存

```ts
cache.get<T>(key: string): T | undefined
```

- 命中返回缓存值，过期或不存在返回 `undefined`
- 读取时会检查过期时间，已过期则自动删除并返回 `undefined`

```ts
const value = cache.get<number>('abc')  // 123 或 undefined
```

### remove — 删除缓存

```ts
cache.remove(key: string): void
```

```ts
cache.remove('abc')
```

### clear — 清空全部缓存

```ts
cache.clear(): void
```

清空所有缓存数据，同时重置统计信息。

---

## computeIfAbsent — 不存在则计算

```ts
cache.computeIfAbsent<T>(
  key: string,
  provider: () => Promise<T> | T,
  expiresInSeconds?: number
): Promise<T>
```

如果 `key` 对应的缓存存在且未过期，直接返回缓存值；否则调用 `provider` 计算值，写入缓存并返回。

**并发安全**：相同 `key` 的并发调用只会触发一次 `provider` 执行，其他调用复用同一个 Promise 结果。

```ts
const user = await cache.computeIfAbsent(
  `get-user-${userId}`,
  () => findUserById(userId),
  120  // 可选，过期时间秒
)
```

---

## 驱逐与清理

### 清理任务

模块加载时自动启动清理任务，按 `CACHE_CLEANING_INTERVAL` 的周期执行，完成两件事：

1. **删除过期数据**：遍历并删除 `expireAt < now` 的记录
2. **驱逐多余记录**：如果清理后元素数仍超过 `CACHE_MAX_ELEMENTS`，从头开始删除多余条目

驱逐策略为**随机淘汰**（因 Map 的 key 顺序不保证，等同于随机），不支持设置其他驱逐策略。

### 统计任务

当 `CACHE_STAT_TASK_ENABLED=true` 时，按 `CACHE_STAT_INTERVAL` 周期输出统计日志：

```
[2023/09/27 11:31:35.690][INFO]Cache statistics，time window ：2023/09/27 11:31:35.442 - now， hit ：4/4，capacity：120/100
```

统计包含：
- **time window**：统计周期时间窗口
- **hit**：命中次数 / 总 get 次数
- **capacity**：当前元素数 / 最大容量

---

## 内部实现要点

### Cache 类 (`cache.ts`)

```ts
export class Cache {
  private promiseMap = new Map<string, Promise<any>>()

  constructor(
    private readonly valueMap: Map<string, CacheContent>,
    private readonly stat?: CacheStat
  ) {}
  // put / get / remove / clear / computeIfAbsent ...
}
```

- 底层是 `Map<string, CacheContent>`，`CacheContent` 包含 `val`（值）和 `expireAt`（过期时间戳）
- `promiseMap` 用于 `computeIfAbsent` 的并发去重

### PurgeTask (`purge-task.ts`)

实现 `Task` 接口，`run()` 方法中遍历 Map 删除过期条目，超出容量限制则从 Map 头部开始驱逐。

### CacheStat (`stat.ts`)

记录 `totalGet` 和 `totalHit`，`log()` 输出统计信息到日志，`clear()` 重置统计窗口。

### 模块初始化 (`index.ts`)

```ts
const valueMap = new Map<string, any>()
const stat = config.statTaskEnabled ? new CacheStat(valueMap) : undefined
const cache = new Cache(valueMap, stat)

scheduleWithFixedDelay(config.cleaningInterval, config.cleaningInterval, new PurgeTask(valueMap))

if (config.statTaskEnabled) {
  scheduleWithFixedDelay(config.statInterval, config.statInterval, {
    name: 'Cache statistics',
    async run() { stat?.log(); stat?.clear() }
  })
}

export function getCache() { return cache }
```

模块加载即完成：创建 Map → 创建 Cache 实例 → 启动清理定时任务 → 可选启动统计任务。`getCache()` 返回的始终是同一个实例。

---

## 性能注意事项

- 缓存数据过多会影响 GC：回收器无法回收被缓存的对象，但标记和整理工作仍有大量消耗
- 建议将 `CACHE_CLEANING_INTERVAL` 设置得小一些，及时清理无效数据
- 缓存记录时尽可能将过期时间设置得短一些
- 谨慎评估 `CACHE_MAX_ELEMENTS`，根据服务器内存合理设置
- 大量数据缓存场景应使用外部缓存服务（Redis 等）
