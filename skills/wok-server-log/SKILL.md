---
name: wok-server-log
description: wok-server 日志组件使用指南，支持级别控制、文件输出、自定义存储和结构化日志。
license: MIT
metadata:
  author: Peak Tai
  email: peaktai@qq.com
---

# wok-server 日志组件

## 概述

日志组件提供日志记录能力，支持级别过滤、控制台输出、文件写入、自定义存储、日志前缀、JSON/文本双格式。

## 源码与类型定义

安装 `wok-server` 后，可通过以下路径查看源码与类型定义：

- 源码目录：`node_modules/wok-server/src/log/`
- 类型定义：`node_modules/wok-server/types/` （引用 log 组件的 `.d.ts` 文件）

核心源码文件：

| 文件            | 说明                               |
| :-------------- | :--------------------------------- |
| `index.ts`      | 模块入口，`Logger` 类与 `getLogger` |
| `log.ts`        | `Log` 结构定义、`formatLogText`/`formatLogJson` |
| `config.ts`     | 日志配置（环境变量映射）            |
| `level.ts`      | `LogLevel` 枚举与解析              |
| `file.ts`       | 文件存储实现，缓冲写入 + 定时清理    |
| `store.ts`      | 自定义存储接口，`setLogStore`       |
| `date.ts`       | 日期时间格式化                      |

---

## 环境变量

| 环境变量          | 默认值 | 说明                                           |
| :---------------- | :----- | :--------------------------------------------- |
| `LOG_LEVEL`       | INFO   | 日志级别：DEBUG / INFO / WARN / ERROR           |
| `LOG_FILE`        | false  | 是否输出到文件                                  |
| `LOG_FILE_DIR`    | logs   | 日志文件目录（支持相对路径和绝对路径）           |
| `LOG_FILE_MAX_DAYS` | 30   | 日志文件最大保留天数                             |
| `LOG_CONSOLE`     | true   | 是否输出到控制台                                |
| `LOG_FORMAT`      | text   | 输出格式：text 或 json（控制台强制 text）       |

---

## 获取日志对象

```ts
import { getLogger } from 'wok-server'

const logger = getLogger()
const moduleLogger = getLogger('my-module')  // 带前缀
```

`getLogger()` 无参时返回模块级默认单例 `Logger`（共享），传 prefix 时每次返回新实例。prefix 会在每条日志中显示为 `[INFO][my-module]日志内容`。

---

## 日志输出

### 基本方法

```ts
logger.debug('调试信息')
logger.info('普通信息')
logger.warn('警告信息')
logger.warning('警告信息')      // 同 warn
logger.error('错误信息', new Error('details'))
```

### 级别判定（避免不必要的开销）

```ts
logger.isDebugEnabled()         // 是否 DEBUG 级别可用
logger.isInfoEnabled()
logger.isWarnEnabled()
logger.isErrorEnabled()

if (logger.isDebugEnabled()) {
  logger.debug(`复杂构建: ${JSON.stringify(largeObj)}`)
}
```

---

## 日志格式

### text 格式

```
[2025/05/13 14:30:22.456][INFO][my-module]日志内容
```

错误信息附带 stack trace（如果有），以换行拼接。

### json 格式

```json
{"level":2,"content":"日志内容","time":"2025-05-13T06:30:22.456Z","prefix":"my-module"}
```

`LOG_FORMAT=json` 启用。注意控制台强制输出 text 格式，json 仅对文件有效。

---

## 文件日志

### 启用

```bash
LOG_FILE=true
LOG_FILE_DIR=logs
LOG_FILE_MAX_DAYS=30
```

模块加载时，若 `LOG_FILE=true` 则自动将 `fileStore` 注册为日志存储。

### 写入机制

- **缓冲写入**：日志先进入内存队列 `LOG_QUEUE`，延迟 100ms 批量写出，避免频繁 IO
- **超限立即写入**：队列超过 1024 条时立即写入，防止内存溢出
- **按日期分文件**：每天一个文件，文件名格式 `YYYYMMDD.log`
- **自动清理**：启动后每 24 小时检查并删除超过 `LOG_FILE_MAX_DAYS` 天的文件（基于文件 mtime）

### 手动 flush

```ts
import { flushLogsToFile } from 'wok-server'

// 进程退出前确保缓冲日志落盘
process.on('beforeExit', async () => {
  await flushLogsToFile()
})
```

---

## 自定义存储

通过 `setLogStore` 替换默认的文件存储，可将日志发送到消息队列、外部系统等：

```ts
import { setLogStore } from 'wok-server'

setLogStore((log: Log, config: LogConfig) => {
  // log.time   — Date，日志时间
  // log.level  — LogLevel，级别枚举
  // log.content — string，日志正文
  // log.error  — any，可选的异常对象
  // log.prefix — string | undefined，可选的模块前缀
  messageQueue.push(log)
})
```

一旦设置 `setLogStore`，文件存储会被覆盖（即使 `LOG_FILE=true`），两者不可共存。

---

## Log 结构

```ts
interface Log {
  time: Date        // 日志时间
  level: LogLevel   // 级别枚举（DEBUG=1, INFO=2, WARN=3, ERROR=4）
  content: string   // 日志正文
  error?: any       // 可选，关联的异常对象
  prefix?: string   // 可选，模块前缀
}
```

## LogLevel 枚举

```ts
enum LogLevel {
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4
}
```

`parseLogLevel('INFO')` 将字符串转为枚举值，不支持的字符串抛 `Error`。

---

## 内部实现要点

### Logger 类 (`index.ts`)

```ts
class Logger {
  constructor(private prefix?: string) {}
  private log(level: LogLevel, message: string, error?: any) {
    if (level < config.level) return                    // 级别过滤
    const log: Log = { level, content: message, time: new Date(), prefix: this.prefix, error }
    if (config.console) { /* 控制台输出，强制 text 格式 */ }
    const store = getLogStore()
    if (store) store(log, config)                       // 自定义存储
  }
}
```

无 prefix 时使用模块级 defaultLogger 单例，有 prefix 时创建新实例。

### 配置 (`config.ts`)

通过 `registerConfig` 映射环境变量，`level` 在配置阶段通过 `parseLogLevel` 转换为 `LogLevel` 枚举值，`fileDir` 转换为绝对路径。最终配置通过 `Object.freeze` 冻结。

### 文件存储 (`file.ts`)

- 延迟批量写入（100ms 定时器）
- 队列上限 1024 触发立即写入
- 按日期分组写入不同文件
- 24 小时清理周期，基于文件 mtime 判断过期
