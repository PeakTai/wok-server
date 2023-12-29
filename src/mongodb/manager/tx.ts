import { ClientSession, Db } from 'mongodb'
import { MongoDBConfig } from '../config'
import { MongoDBException } from '../exception'
import { BaseMongoManager } from './base'
/**
 * 事务会话
 */
export class MongoTxSession extends BaseMongoManager {
  /**
   * 中止标识
   */
  #aborted = false

  constructor(config: MongoDBConfig, db: Db, session: ClientSession) {
    super(config, db, session)
  }

  protected timingQuery<T, D extends { op: string; coll: string }>(opts: {
    query: () => Promise<T>
    desc: () => D
  }): Promise<T> {
    if (this.#aborted) {
      throw new MongoDBException('Session has been aborted!')
    }
    return super.timingQuery(opts)
  }

  /**
   * 中止，被中止后的会话不能再进行任何操作
   */
  abort() {
    this.#aborted = true
  }
}
