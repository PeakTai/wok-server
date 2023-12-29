/**
 * MongoDB 异常.
 */
export class MongoDBException extends Error {
  constructor(readonly message: string) {
    super(message)
  }
}
