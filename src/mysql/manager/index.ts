import { TransactionOptions } from 'mongodb'
import { Pool } from 'mysql2'
import { MysqlConfig } from '../config'
import { BaseMysqlManager } from './base'
import { MysqlTxSession } from './tx'
import { promiseGetConnection, promiseQuery } from './utils'
import { MysqlStrictTxSession } from './tx-strict'
import { MysqlException } from '../exception'

/**
 * mysql 管理器，封装数据库操作，提供方便使用的实体类操作方法.
 */
export class MysqlManager extends BaseMysqlManager {
  /**
   * @param mapping 映射
   */
  constructor(
    private readonly config: MysqlConfig,
    /**
     * 连接池.
     */
    private readonly pool: Pool
  ) {
    super({ config, pool })
  }

  /**
   * 事务. 所有事务中的操作都必须使用 exec 函数中提供的 session 对象，直接使用 MysqlManager 上的方法
   * 进行的操作不会在事务中生效.
   * @param ops 逻辑执行函数，内部的所有逻辑都必须在函数内执行完，
   * 不得有操作在函数外异步执行（异步操作不 await，或使用定时器单独执行等），否则不会在事务中生效
   * @param opts 选项，可设置超时时间等
   */
  async tx<T>(
    ops: (session: MysqlTxSession) => Promise<T>,
    opts?: {
      timeout?: number
      isolationLevel?: 'REPEATABLE READ' | 'READ COMMITTED' | 'READ UNCOMMITTED' | 'SERIALIZABLE'
      accessMode?: 'READ WRITE' | 'READ ONLY'
    }
  ): Promise<T> {
    const conn = await promiseGetConnection(this.pool)
    if (opts && opts.isolationLevel) {
      await promiseQuery(
        this.config,
        conn,
        `SET TRANSACTION ISOLATION LEVEL ${opts.isolationLevel}`
      )
    }
    if (opts && opts.accessMode) {
      await promiseQuery(this.config, conn, `SET TRANSACTION ${opts.accessMode}`)
    }
    await new Promise<void>((resolve, reject) => {
      conn.beginTransaction(err => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
    // 构建 session ，然后执行查询
    const session = this.config.transactionStrict
      ? new MysqlStrictTxSession(this.config, conn)
      : new MysqlTxSession(this.config, conn)
    try {
      // 超时抛出异常
      const timeout =
        opts && typeof opts.timeout === 'number' ? opts.timeout : this.config.transactionTimeout
      const result =
        timeout > 0
          ? await Promise.race([
              ops(session),
              new Promise<T>((resolve, reject) => {
                setTimeout(() => {
                  // 立即中止会话，防止再有后续操作
                  session.abort()
                  reject(new MysqlException('Transaction timeout !'))
                }, timeout)
              })
            ])
          : await ops(session)
      await new Promise<void>((resolve, reject) => {
        conn.commit(err => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
      return result
    } catch (e) {
      await new Promise<void>((resolve, reject) => {
        conn.rollback(err => {
          if (err) {
            reject(err)
          } else {
            resolve()
          }
        })
      })
      throw e
    } finally {
      // 无论如何中止会话，离开事务，会话就不能再被使用
      session.abort()
      this.pool.releaseConnection(conn)
    }
  }
}

export { FindOpts, MixCriteria, MysqlCriteria } from './ops'
export { BaseMysqlManager, MysqlTxSession }
