/**
 * 校验异常.
 */
export class ValidationException extends Error {
  constructor(
    /**
     * 异常信息，如 “不能为空” 之类的.
     */
    readonly errMsg: string,
    /**
     * 校验器名称，如 length 、notNull 之类的.
     */
    readonly validator: string,
    /**
     * 校验出错的路径.
     */
    readonly propertyPath: string,
    /**
     * 值
     */
    readonly val: any
  ) {
    super(
      `Field "${propertyPath}" failed to validate by validator ${validator} ，value：${val}，info：${errMsg}`
    )
  }
}
