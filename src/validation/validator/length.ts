import { PropValidator } from '..'
import { getI18n } from '../../i18n'

/**
 * length 校验，可用于字符串或数组.
 * @returns
 */
export function length<T>(opts: {
  min?: number
  max?: number
  message?: string
}): PropValidator<T> {
  const validator = 'length'
  return val => {
    // 不校验空
    if (!val) {
      return { ok: true }
    }
    if (typeof (val as any).length !== 'number') {
      return { ok: false, validator, message: getI18n().buildMsg('validate-err-no-length') }
    }
    const { length } = val as any
    if (typeof length !== 'number') {
      return { ok: false, validator, message: getI18n().buildMsg('validate-err-length-not-number') }
    }
    if (typeof opts.min === 'number' && length < opts.min) {
      return {
        ok: false,
        validator,
        message: opts.message || getI18n().buildMsg('validate-err-min-length', `${opts.min}`)
      }
    }
    if (typeof opts.max === 'number' && length > opts.max) {
      return {
        ok: false,
        validator,
        message: opts.message || getI18n().buildMsg('validate-err-max-length', `${opts.max}`)
      }
    }
    return { ok: true }
  }
}
