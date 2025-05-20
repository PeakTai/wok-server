import { getLogger } from '../log'
import { max, min, notNull, validate } from '../validation'
import { Task, TaskController, execTask } from './task'

/**
 * 固定延迟执行任务
 * @param initialDelay  第一次执行延迟的时间，单位秒
 * @param period 每次的延迟时间，单位秒
 * @param task 任务
 */
export function scheduleWithFixedRate(
  initialDelay: number,
  period: number,
  task: Task
): TaskController {
  validate(
    { initialDelay, period },
    {
      initialDelay: [notNull(), min(0), max(3600 * 24)],
      period: [notNull(), min(1), max(3600 * 24)]
    }
  )

  const taskController = new TaskController()
  setTimeout(() => exec(period, task, taskController), initialDelay * 1000)
  return taskController
}

function exec(fixedDelay: number, task: Task, controller: TaskController) {
  Promise.resolve()
    .then(async () => {
      if (controller.isStopped()) {
        return
      }
      const res = await execTask(task)
      // 下次执行
      let delay = res.start + fixedDelay * 1000 - new Date().getTime()
      if (delay < 0) {
        delay = 0
      }
      setTimeout(() => exec(fixedDelay, task, controller), delay)
    })
    .catch(e => {
      getLogger().error(`EXEC TASK ERROR: ${task.name}`, e)
    })
    .catch(console.error)
}
