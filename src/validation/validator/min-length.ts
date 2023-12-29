import { PropValidator } from '..'
import { getI18n } from '../../i18n'

/**
 * 最小长度校验，可用于字符串或数组.
 * @returns
 */
export function minLength<T>(minLength: number, message?: string): PropValidator<T> {
  const validator = 'minLength'
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
    if (length < minLength) {
      return {
        ok: false,
        validator,
        message: message || getI18n().buildMsg('validate-err-min-length', `${minLength}`)
      }
    }
    return { ok: true }
  }
}
