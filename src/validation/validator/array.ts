import { PropValidator, ValidationOpts } from '..'
import { getI18n } from '../../i18n'

/**
 * 校验数组的条目.
 */
export function array<J>(opts: ValidationOpts<J>): PropValidator<J[]> {
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
      const item = val[i] as J
      for (const validation of Object.entries(opts)) {
        const [prop, validators] = validation
        const val = item[prop as keyof J]
        for (const validate of validators as PropValidator<any>[]) {
          const result = validate(val)
          if (!result.ok) {
            const propPath = [`[${i}]`, prop]
            if (result.propPath) {
              propPath.push(...result.propPath)
            }
            return { ok: false, validator, message: result.message, propPath }
          }
        }
      }
    }
    return { ok: true }
  }
}
