import { PropValidator } from '..'
import { getI18n } from '../../i18n'

/**
 * 校验数组的条目.
 */
export function array<T>(opts: PropValidator<T>[]): PropValidator<T[] | undefined> {
  const validator = 'array'
  return val => {
    if (!val) {
      return { ok: true }
    }
    if (!Array.isArray(val)) {
      return { ok: false, validator, message: getI18n().buildMsg('validate-err-array') }
    }
    // 条目处理
    for (let i = 0; i < val.length; i++) {
      const item = val[i] as T
      for (const validation of opts) {
        const result = validation(item)
        if (!result.ok) {
          const propPath = [`[${i}]`]
          if (result.propPath) {
            propPath.push(...result.propPath)
          }
          return { ok: false, validator, message: result.message, propPath }
        }
      }
    }
    return { ok: true }
  }
}
