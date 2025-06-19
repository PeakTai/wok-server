import { getLockManager } from '../lock'
import { getLogger } from '../log'
import { max, min, notNull, validate } from '../validation'
import { Task, TaskController, execTask } from './task'

/**
 * 固定延迟执行任务
 * @param initialDelay  第一次执行延迟的时间，单位秒
 * @param delay 每次的延迟时间，单位秒
 * @param task 任务
 * @param timeout 任务超时时间，单位毫秒
 */
export function scheduleWithFixedDelay(
  initialDelay: number,
  delay: number,
  task: Task,
  timeout?: number
): TaskController {
  validate(
    { initialDelay, delay },
    {
      initialDelay: [notNull(), min(0), max(3600 * 24)],
      delay: [notNull(), min(1), max(3600 * 24)]
    }
  )
  const controller = new TaskController()
  setTimeout(() => exec(delay, task, controller, timeout), initialDelay * 1000)
  return controller
}

function exec(delay: number, task: Task, controller: TaskController, timeout?: number) {
  Promise.resolve()
    .then(async () => {
      if (controller.isStopped()) {
        return
      }
      await execTask(task, timeout)
      // 下次执行
      setTimeout(() => exec(delay, task, controller), delay * 1000)
    })
    .catch(e => {
      getLogger().error(`EXEC TASK ERROR: ${task.name}`, e)
    })
    .catch(console.error)
}
