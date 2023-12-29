/**
 * 校验异常.
 */
export class ValidationException {
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
  ) {}

  /**
   * 对错误的完整描述信息，用于日志记录.
   */
  desc() {
    return `Field "${this.propertyPath}" failed to validate by validator ${this.validator} ，value：${this.val}，info：${this.errMsg}`
  }

  get message() {
    return this.desc()
  }
}
