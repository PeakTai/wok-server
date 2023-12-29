import { getLogger } from '../log'

/**
 * 任务.
 */
export interface Task {
  /**
   * 任务的名称，用于跟踪任务的执行情况，定位错误.
   * 当任务执行时间过长或任务失败时，相关的错误提示信息会显示名称，以便于排查.
   */
  name: string
  /**
   * 任务运行.
   * @returns
   */
  run: () => Promise<void>
}

/**
 * 任务控制器
 */
export class TaskController {
  #stopped = false
  isStopped() {
    return this.#stopped
  }

  stop() {
    this.#stopped = true
  }
}

/**
 * 任务执行，封装任务执行过程中的一些通用信息输出和异常控制.
 * @param task
 * @returns
 */
export async function execTask(task: Task): Promise<{ start: number; cost: number; end: number }> {
  const start = new Date().getTime()
  try {
    getLogger().info(`START TASK：${task.name}`)
    await task.run()
  } catch (e) {
    getLogger().error(`TASK ERROR: ${task.name}`, e)
  }
  const end = new Date().getTime()
  const cost = end - start
  if (cost > 1000 * 60 * 5) {
    getLogger().warn(`Task "${task.name}" takes too long ，cost ${cost}ms`)
  }
  return { start, cost, end }
}
