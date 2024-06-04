import { PropValidator, ValidationOpts } from '..'

/**
 * 普通对象校验.
 * @param opts
 * @returns
 */
export function plainObject<T>(opts: ValidationOpts<Exclude<T, undefined>>): PropValidator<T> {
  const validator = 'plainObject'
  return val => {
    if (!val) {
      return { ok: true }
    }
    for (const entry of Object.entries(opts)) {
      const [prop, validators] = entry
      const v = val[prop as keyof T]
      for (const validate of validators as PropValidator<any>[]) {
        const result = validate(v)
        if (!result.ok) {
          const propPath = [prop]
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
