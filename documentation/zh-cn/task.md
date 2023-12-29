# 调度任务

任务调度提供了一些发起周期性任务的功能，满足基本需要。

## 环境变量

| 函数名称               | 说明                                                                     |
| :--------------------- | :----------------------------------------------------------------------- |
| scheduleWithFixedRate  | 以固定频率执行任务                                                       |
| scheduleWithFixedDelay | 以固定的延迟时间执行任务，也即每次任务执行完之后都会在一定的间隔后再执行 |
| scheduleDailyTask      | 每天定时执行任务                                                         |

## 使用示例

```ts
// 启动一个固定延迟的任务，10秒后首次执行，每分钟执行一次
const controller = scheduleWithFixedDelay(10, 60, {
  name: '记录在线人数',
  async run() {
    const count = await countAuth()
    await createPcu({
      count,
      time: new Date()
    })
  }
})
// 在必要的时候可以通过函数返回的任务控制器停止掉任务
controller.stop()
```

scheduleWithFixedRate 函数的参数和 scheduleWithFixedDelay 一模一样，
不同的是 scheduleWithFixedRate 的周期是任务的开始时间，每次任务执行开始时间的间隙是一致的，
如果任务执行时间过长以致于超过周期，那么下次任务会立即执行。而 scheduleWithFixedDelay 是保持每次任务执行完，
再间隔指定的时间再会执行下一次任务。

```ts
// 启动一个在每天 1点 30分执行的任务
const controller = scheduleDailyTask(1, 30, {
  name: '学习报表',
  async run() {
    // 逻辑省略
  }
})
```

## 与内置定时器的区别

如果要求不高，也可以使用 Nodejs 内置的 setTimeout 和 setInterval 来执行周期性任务。
任务组件不同的地方就在于，用起来稍微方便一些，常用的功能已经封装好了，运行方法是异步函数。
自动记录任务开始时间和异常信息，对于执行时间过长的任务记录运行时间。
