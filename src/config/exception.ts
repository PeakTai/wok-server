/**
 * 配置异常.
 */
export class ConfigException extends Error {
  constructor(readonly message: string) {
    super(message)
  }
}
