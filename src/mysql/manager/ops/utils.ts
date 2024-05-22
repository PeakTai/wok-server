/**
 * 处理列的值，对特殊类型 json 进行加工处理后返回
 * @param value
 */
export function processColumnValue(value: any) {
  // date 类型 typeof 也是 object ，先排除
  if (value instanceof Date) {
    return value
  }
  // json
  if (typeof value === 'object') {
    return JSON.stringify(value)
  }
  // 其它的情况直接返回
  return value
}
