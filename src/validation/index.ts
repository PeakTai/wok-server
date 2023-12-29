import { ValidationException } from './exception'
/**
 * 校验结果。message：错误信息，反馈给调用处；validator 校验器名称，用于记录错误信息来自哪个校验器，
 * 以便于程序在出错时知道信息来自哪里。
 */
export type ValidationResult =
  | { ok: true }
  | {
      ok: false
      message: string
      validator: string
      /**
       * 如果校验的是层级深的对象，内部的属性发生了错误，可用于标记属性的路径
       */
      propPath?: string[]
    }
/**
 * 校验器.
 */
export type PropValidator<T> = (val: T) => ValidationResult

/**
 * 对象的校验选项
 */
export type ValidationOpts<T> = Partial<{ [key in keyof T]: PropValidator<T[key]>[] }>

/**
 * 校验对象.
 * @param obj
 */
export function validate<T>(obj: T, opts: ValidationOpts<T>) {
  for (const entry of Object.entries(opts)) {
    const [prop, validators] = entry
    const val = obj[prop as keyof T]
    for (const validator of validators as PropValidator<any>[]) {
      const result = validator(val)
      if (!result.ok) {
        const propPath = [prop]
        if (result.propPath) {
          propPath.push(...result.propPath)
        }
        throw new ValidationException(result.message, result.validator, propPath.join('.'), val)
      }
    }
  }
}

// 导出
export * from './exception'
export * from './validator'
