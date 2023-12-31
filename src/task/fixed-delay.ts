import { max, min, notNull, validate } from '../validation'
import { Task, TaskController, execTask } from './task'

/**
 * 固定延迟执行任务
 * @param initialDelay  第一次执行延迟的时间，单位秒
 * @param delay 每次的延迟时间，单位秒
 * @param task 任务
 */
export function scheduleWithFixedDelay(
  initialDelay: number,
  delay: number,
  task: Task
): TaskController {
  validate(
    { initialDelay, delay },
    {
      initialDelay: [notNull(), min(0), max(3600 * 24)],
      delay: [notNull(), min(1), max(3600 * 24)]
    }
  )
  const controller = new TaskController()
  setTimeout(() => exec(delay, task, controller), initialDelay * 1000)
  return controller
}

function exec(delay: number, task: Task, controller: TaskController) {
  Promise.resolve()
    .then(async () => {
      if (controller.isStopped()) {
        return
      }
      await execTask(task)
      // 下次执行
      setTimeout(() => exec(delay, task, controller), delay * 1000)
    })
    .catch(console.error)
}
