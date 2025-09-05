# 日志

日志用于记录信息，支持简单的级别控制，以及写入文件功能。

## 环境变量

| 环境变量名称      | 默认值 | 说明                                                                              |
| :---------------- | :----- | :-------------------------------------------------------------------------------- |
| LOG_LEVEL         | info   | 日志级别，低于设定级别的日志将不会输出，取值：DEBUG，INFO，WARN,ERROR             |
| LOG_FILE          | false  | 取值 true 或 false ，表示是否开启文件                                             |
| LOG_FILE_MAX_DAYS | 30     | 数文件的保留天数                                                                  |
| LOG_FILE_DIR      | logs   | 日志文件存储路径，支持相对路径和绝对路径，相对路径是相对于进程执行目录的          |
| LOG_CONSOLE       | true   | 是否输出日志到控制台,0.5 版本新增加                                               |
| LOG_FORMAT        | text   | 输出日志的格式，可设置为 json 或 text, 0.5 版本新增加，注意控制台是强制输出文本的 |


## 使用

通过 getLogger() 函数获取日志对象，然后调用日志对象的方法来输出日志。

```ts
const logger = getLogger()

logger.info('普通日志信息')

const err = new Error('错误信息测试')
logger.error('错误日志输出信息', err)

if (logger.isDebugEnabled()) {
  logger.debug(`调试日志输出, args: ${JSON.stringify(args)}`)
}
```

## 判定是否支持某个日志级别

日志对象提供了 isDebugEnabled、isInfoEnabled、isWarnEnabled、isErrorEnabled 方法来判定是否支持某个日志级别。

```ts
if (logger.isDebugEnabled()) {
  logger.debug('调试日志输出')
}
```

这些方法的作用是判断当前是否支持某个级别，然后再做处理，如果不支持就不构建日志内容。
一些情况下，可以避免构建日志信息所带来的不必要的开销。

## 给日志增加前缀

0.5 版本开始，getLogger 函数支持增加前缀，比如：

```ts
const logger = getLogger('my-module')
```

这样输出的日志会增加前缀 `[my-module]`，方便区分不同模块的日志。

例如，默认无前缀的日志是这样的：

```
[2024/08/19 16:27:18.214][INFO]Mysql migration
```

增加前缀后是这样的：

```
[2024/08/19 16:27:18.214][INFO][my-module]Mysql migration
```


## 自定义日志存储

通过函数 setLogStore 可以自定义日志的存储，一旦设置，将会覆盖掉文件存储，即使设置了开启文件，日志也不会输出到文件中。

从 0.5 版本开始，日志做了结构化，存储函数的参数是日志对象和配置信息，而不是一个字符串了。


```ts
setLogStore((log: Log, config: LogConfig) => {
  // log 的类型是 Log
  // config 的类型是 LogConfig
  // 可以根据需要将日志内容放入消息队列或独立的文件存储系统中
  messageQueue.push(log)
})
```

Log 的定义如下：

```ts
export interface Log {
  /**
   * 日志的时间
   */
  time: Date
  /**
   * 日志的等级
   */
  level: LogLevel
  /**
   * 日志的内容
   */
  content: string
  /**
   * 异常信息
   */
  error?: any
  /**
   * 前缀信息
   */
  prefix?: string
}
```

LogConfig 类型则是包含了前面的环境变量配置信息，用于获取配置信息来决定如何处理日志。
