/**
 * mysql 异常.
 */
export class MysqlException extends Error {
  constructor(readonly message: string) {
    super(message)
  }
}
