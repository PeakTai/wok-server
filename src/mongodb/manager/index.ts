import { Db, MongoClient, ReadConcernLike, ReadPreferenceLike, WriteConcern } from 'mongodb'
import { MongoDBConfig } from '../config'
import { MongoDBException } from '../exception'
import { BaseMongoManager } from './base'
import { MongoTxSession } from './tx'
import { MongoStrictTxSession } from './tx-strict'

/**
 * mysql 分页查询结果
 */
export interface MongoPage<T> {
  total: number
  list: T[]
}

/**
 * mongodb 管理器，目前尚未实现事务的处理.
 */
export class MongoDBManager extends BaseMongoManager {
  /**
   * mongodb 管理器构建
   * @param db 库
   */
  constructor(config: MongoDBConfig, db: Db, private readonly client: MongoClient) {
    super(config, db)
  }
  /**
   * 事务操作。mongodb 的版本必须在 4.0 以上，连接的必须是副本集节点或分片集群的mongos节点。
   * @param ops 操作逻辑，所有事务相关的操作都必须使用函数提供的 session 对象
   * @param opts mongo 事务选项
   */
  async tx<T>(
    ops: (session: MongoTxSession) => Promise<T>,
    opts?: {
      /** 超时时间，单位毫秒，设置后会覆盖全局设置，设置为0表示不限制 */
      timeout?: number
      /** A default read concern for commands in this transaction */
      readConcern?: ReadConcernLike
      /** A default writeConcern for commands in this transaction */
      writeConcern?: WriteConcern
      /** A default read preference for commands in this transaction */
      readPreference?: ReadPreferenceLike
    }
  ): Promise<T> {
    const timeout =
      opts && typeof opts.timeout === 'number' ? opts.timeout : this.config.transactionTimeout
    const nativeSession = this.client.startSession()
    nativeSession.startTransaction(opts)
    const txSesssion = this.config.transactionStrict
      ? new MongoStrictTxSession(this.config, this.db, nativeSession)
      : new MongoTxSession(this.config, this.db, nativeSession)
    try {
      const result =
        timeout > 0
          ? await Promise.race([
              ops(txSesssion),
              new Promise<T>((resolve, reject) => {
                setTimeout(() => {
                  // 立即中止会话，防止再有后续操作
                  txSesssion.abort()
                  reject(new MongoDBException('Transaction timeout !'))
                }, timeout)
              })
            ])
          : await ops(txSesssion)
      await nativeSession.commitTransaction()
      return result
    } catch (error) {
      await nativeSession.abortTransaction()
      // 将原错误抛出，如果有需要，调用处可对异常做进一步的处理
      throw error
    } finally {
      // 无论如何中止会话，离开事务，会话就不能再被使用
      txSesssion.abort()
      await nativeSession.endSession()
    }
  }
}

export { BaseMongoManager, MongoTxSession }
