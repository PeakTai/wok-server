import { PropValidator } from '..'
import { getI18n } from '../../i18n'
/**
 * 枚举，校验值必须是指定列表中的一个.
 * @param list 支持的值列表，仅支持数字和字符串类型
 * @param msg
 * @returns
 */
export function enumerate<T>(list: (number | string)[], msg?: string): PropValidator<T> {
  const validator = 'enumerate'
  return val => {
    if (!val) {
      return { ok: true }
    }
    if (!list.some(item => item === val)) {
      return {
        ok: false,
        validator,
        // must be one of [1,2,3]
        message: msg || getI18n().buildMsg('validate-err-enum', `[${list.join(',')}]`)
      }
    }
    return { ok: true }
  }
}
