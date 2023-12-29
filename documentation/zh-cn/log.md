# 日志

日志用于记录信息，支持简单的级别控制，以及写入文件功能。

## 环境变量

| 环境变量名称      | 默认值 | 说明                                                                     |
| :---------------- | :----- | :----------------------------------------------------------------------- |
| LOG_LEVEL         | info   | 日志级别，低于设定级别的日志将不会输出，取值：DEBUG，INFO，WARN,ERROR    |
| LOG_FILE          | false  | 取值 true 或 false ，表示是否开启文件                                    |
| LOG_FILE_MAX_DAYS | 30     | 数文件的保留天数                                                         |
| LOG_FILE_DIR      | logs   | 日志文件存储路径，支持相对路径和绝对路径，相对路径是相对于进程执行目录的 |

## 使用

通过 getLogger() 函数获取日志对象，然后调用日志对象的方法来输出日志。

```ts
const logger = getLogger()

logger.info('普通日志信息')

const err = new Error('错误信息测试')
logger.error('错误日志输出信息', err)

if (logger.isDebugEnabled()) {
  logger.debug('调试日志输出', JSON.stringify(args))
}
```

## 自定义日志存储

通过函数 setLogStore 可以自定义日志的存储，一旦设置，将会覆盖掉文件存储，即使设置了开启文件，日志也不会输出到文件中。

```ts
setLogStore(log => {
  // 可以根据需要将日志内容放入消息队列或独立的文件存储系统中
  messageQueue.push(log)
})
```
