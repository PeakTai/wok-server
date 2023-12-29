import { PoolConnection } from 'mysql2'
import { BaseMysqlManager } from './base'
import { MysqlConfig } from '../config'
import { MysqlException } from '../exception'

/**
 * mysql 事务会话.
 */
export class MysqlTxSession extends BaseMysqlManager {
  /**
   * 中止标识
   */
  #aborted = false

  constructor(config: MysqlConfig, conn: PoolConnection) {
    super({ config, connection: conn })
  }

  protected queryWithConnection<T>(queryFn: (conn: PoolConnection) => Promise<T>): Promise<T> {
    if (this.#aborted) {
      throw new MysqlException('Session has been aborted!')
    }
    return super.queryWithConnection(queryFn)
  }
  /**
   * 中止，被中止后的会话不能再进行任何操作
   */
  abort() {
    this.#aborted = true
  }
}
