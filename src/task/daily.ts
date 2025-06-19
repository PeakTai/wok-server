import { max, min, notNull, validate } from '../validation'
import { Task, TaskController, execTask } from './task'

/**
 * 每日任务.
 * @param hours 时
 * @param minutes 分
 * @param task 要执行的任务
 * @param timeout 任务超时时间，单位毫秒
 * @returns
 */
export function scheduleDailyTask(
  hours: number,
  minutes: number,
  task: Task,
  timeout?: number
): TaskController {
  // 校验
  validate(
    { hours, minutes },
    {
      hours: [notNull(), min(0), max(23)],
      minutes: [notNull(), min(0), max(59)]
    }
  )
  const taskController = new TaskController()
  const delay = dailyTaskDelay(hours, minutes)
  setTimeout(() => exec(hours, minutes, task, taskController, timeout), delay)
  return taskController
}
/**
 * 计算到下次指定时间点的延迟
 * @param hours
 * @param minutes
 */
export function dailyTaskDelay(hours: number, minutes: number): number {
  const now = new Date()
  let todayTime = new Date()
  todayTime.setHours(hours)
  todayTime.setMinutes(minutes)
  todayTime.setSeconds(0)
  todayTime.setMilliseconds(0)
  // 如果今天还没有到指定的点，今天就执行，否则明天执行
  if (todayTime > now) {
    return todayTime.getTime() - now.getTime()
  }
  // 明天时间
  const oneDayMilliseconds = 1000 * 3600 * 24
  const tomorrowTime = todayTime.getTime() + oneDayMilliseconds
  return tomorrowTime - now.getTime()
}

function exec(
  hours: number,
  minutes: number,
  task: Task,
  controller: TaskController,
  timeout?: number
) {
  Promise.resolve()
    .then(async () => {
      if (controller.isStopped()) {
        return
      }
      await execTask(task, timeout)
      const delay = dailyTaskDelay(hours, minutes)
      setTimeout(() => exec(hours, minutes, task, controller), delay)
    })
    .catch(console.error)
}
