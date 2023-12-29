import { PropValidator } from '..'
import { getI18n } from '../../i18n'
/**
 * 最大值校验.
 * @param max 最大值
 * @param msg 错误消息
 */
export function max<T>(max: number, msg?: string): PropValidator<T> {
  const validator = 'max'
  return val => {
    if (val == undefined || val === null) {
      return { ok: true }
    }
    if (typeof val !== 'number') {
      return { ok: false, validator, message: getI18n().buildMsg('validate-err-numer') }
    }
    if (val > max) {
      return {
        ok: false,
        validator,
        message: msg || getI18n().buildMsg('validate-err-max', `${max}`)
      }
    }
    return { ok: true }
  }
}
