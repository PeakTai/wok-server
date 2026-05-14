---
name: wok-server-task
description: wok-server 任务调度组件使用指南，提供固定频率、固定延迟和每日定时三种调度模式。
license: MIT
metadata:
  author: Peak Tai
  email: peaktai@qq.com
---

# wok-server 任务调度组件

## 概述

任务调度组件提供周期性任务功能，封装了启动、执行、超时、异常记录和耗时告警。提供三种调度模式。

## 源码与类型定义

安装 `wok-server` 后，可通过以下路径查看源码与类型定义：

- 源码目录：`node_modules/wok-server/src/task/`
- 类型定义：`node_modules/wok-server/types/` （引用 task 组件的 `.d.ts` 文件）

核心源码文件：

| 文件             | 说明                               |
| :--------------- | :--------------------------------- |
| `index.ts`       | 模块聚合导出                       |
| `task.ts`        | `Task` 接口、`TaskController`、`execTask` |
| `fixed-delay.ts` | `scheduleWithFixedDelay` 固定延迟  |
| `fixed-rate.ts`  | `scheduleWithFixedRate` 固定频率    |
| `daily.ts`       | `scheduleDailyTask` 每日定时       |

---

## 三种调度模式

### scheduleWithFixedDelay — 固定延迟

```ts
function scheduleWithFixedDelay(
  initialDelay: number,  // 首次延迟（秒），0-86400
  delay: number,         // 每次间隔（秒），1-86400
  task: Task,
  timeout?: number       // 任务超时（ms），可选
): TaskController
```

**每次任务执行完毕后等待 `delay` 秒再执行下一次**。适合对间隔有严格要求的场景。

```ts
import { scheduleWithFixedDelay } from 'wok-server'

const controller = scheduleWithFixedDelay(10, 60, {
  name: '记录在线人数',
  async run() {
    const count = await countAuth()
    await createPcu({ count, time: new Date() })
  }
})

controller.stop()  // 停止任务
```

### scheduleWithFixedRate — 固定频率

```ts
function scheduleWithFixedRate(
  initialDelay: number,  // 首次延迟（秒），0-86400
  period: number,        // 执行周期（秒），1-86400
  task: Task,
  timeout?: number       // 任务超时（ms），可选
): TaskController
```

参数完全相同，区别在于：**以任务的开始时间计算周期**。如果任务执行时间超过周期，下次任务立即执行。与固定延迟区别的核心在于内部 `exec` 中的 `setTimeout` 计算方式不同——固定频率使用 `res.start + period - now`，首次执行时记录 `start` 时间戳。

### scheduleDailyTask — 每日定时

```ts
function scheduleDailyTask(
  hours: number,    // 时（0-23）
  minutes: number,  // 分（0-59）
  task: Task,
  timeout?: number
): TaskController
```

```ts
const dc = scheduleDailyTask(1, 30, {
  name: '学习报表',
  async run() { /* 每天 1:30 执行 */ }
})
```

计算逻辑：当前时间在当天目标时间之前 → 当天执行；否则推迟到明天。

---

## Task 接口与 TaskController

```ts
interface Task {
  name: string              // 任务名称，用于日志跟踪
  run: () => Promise<void>  // 异步执行函数
}

class TaskController {
  isStopped(): boolean      // 是否已停止
  stop(): void              // 停止任务，当前正在执行的不会被中断
}
```

---

## 内置日志行为

`execTask` 函数统一封装了任务的执行过程：

- **开始时**：DEBUG 日志 `START TASK：{name}`
- **成功完成**：DEBUG 日志记录耗时
- **执行 > 5 分钟**：WARN 日志 `Task "{name}" takes too long`
- **异常**：ERROR 日志 `TASK ERROR: {name}`（包含异常详情）
- **超时**：如果设置了 timeout 并超时，`Promise.race` 抛出超时错误，被 catch 记录

---

## 参数校验

所有调度函数都会对传入的延迟/周期参数进行校验：

```ts
validate(
  { initialDelay, delay },
  {
    initialDelay: [notNull(), min(0), max(3600 * 24)],
    delay: [notNull(), min(1), max(3600 * 24)]
  }
)
```

参数不合法时直接抛出 `ValidationException`。

---

## 内部实现要点

### 调度循环

两个固定模式的差异仅在循环逻辑：

- **FixedDelay**：`await execTask → setTimeout(exec, delay)` — 等上次执行完再开始计时
- **FixedRate**：`const res = await execTask → setTimeout(exec, res.start + period - now)` — 用开始时间计算，可能立即执行

两者都在首次使用 `setTimeout` 延迟 `initialDelay` 秒，之后通过递归 `setTimeout`（而非 `setInterval`）控制，避免任务积压。

### execTask 超时机制

通过 `Promise.race([task.run(), timeoutPromise])` 实现。超时后外部 catch 记录 ERROR 日志，不会中断调度循环。
