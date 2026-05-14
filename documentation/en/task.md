# Task Scheduling

Task scheduling provides functionality to initiate periodic tasks, meeting basic needs.

## Environment Variables

| Function Name            | Description                                                                 |
| :----------------------- | :-------------------------------------------------------------------------- |
| scheduleWithFixedRate    | Execute task at fixed rate                                                  |
| scheduleWithFixedDelay   | Execute task with fixed delay, i.e., wait for specified interval after each task completion |
| scheduleDailyTask        | Execute task at fixed time daily                                            |

## Usage Examples

```ts
// Start a fixed delay task, first execution after 10 seconds, then every minute
const controller = scheduleWithFixedDelay(10, 60, {
  name: 'Record online users',
  async run() {
    const count = await countAuth()
    await createPcu({
      count,
      time: new Date()
    })
  }
})
// Stop the task when necessary through the returned controller
controller.stop()
```

The scheduleWithFixedRate function has the same parameters as scheduleWithFixedDelay. The difference is that scheduleWithFixedRate uses the task start time as the cycle, and the interval between each task's start time is consistent. If the task execution time exceeds the cycle, the next task will execute immediately. scheduleWithFixedDelay waits for the specified interval after each task completes before executing the next one.

```ts
// Start a task that runs daily at 1:30
const controller = scheduleDailyTask(1, 30, {
  name: 'Study report',
  async run() {
    // Logic omitted
  }
})
```

## Difference from Built-in Timers

If requirements are not high, you can also use Node.js's built-in setTimeout and setInterval for periodic tasks. The task component is more convenient to use, with commonly used functions already encapsulated, and the run method is an async function. It automatically records task start time and exception information, and logs execution time for long-running tasks.