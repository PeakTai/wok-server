import { PoolConnection } from 'mysql2'
import { MysqlConfig } from '../config'
import { MysqlTxSession } from './tx'
import { Table } from '../table-info'
import { MysqlException } from '../exception'
import {
  DeleteManyOpts,
  FindOpts,
  MixCriteria,
  MysqlPage,
  MysqlPaginateOpts,
  UpdateOpts,
  Updater
} from './ops'

/**
 * 严格 mysql 事务会话，会禁用一些操作.
 */
export class MysqlStrictTxSession extends MysqlTxSession {
  #opsCount = 0
  constructor(config: MysqlConfig, conn: PoolConnection) {
    super(config, conn)
  }
  /**
   * 为操作计数，检查是否操作次数过多.
   */
  #checkAndAddOpsCount() {
    if (this.#opsCount >= 10) {
      throw new MysqlException('Too many operations in a strict transaction.')
    }
    this.#opsCount++
  }

  findById<T>(table: Table<T>, id: string | number): Promise<T | null> {
    this.#checkAndAddOpsCount()
    return super.findById(table, id)
  }

  findByIdIn<T>(table: Table<T>, ids: (string | number)[]): Promise<T[]> {
    if (ids.length > 100) {
      throw new MysqlException(
        `The augument ids length(${ids.length}) passed to findByIdIn in a strict transaction is too large .`
      )
    }
    this.#checkAndAddOpsCount()
    return super.findByIdIn(table, ids)
  }

  existsBy<T>(table: Table<T>, criteria?: MixCriteria<T> | undefined): Promise<boolean> {
    this.#checkAndAddOpsCount()
    return super.existsBy(table, criteria)
  }

  existsById<T>(table: Table<T>, id: string | number): Promise<boolean> {
    this.#checkAndAddOpsCount()
    return super.existsById(table, id)
  }

  deleteById<T>(table: Table<T>, id: string | number): Promise<boolean> {
    this.#checkAndAddOpsCount()
    return super.deleteById(table, id)
  }

  deleteOne<T>(table: Table<T>, criteria: Partial<T>): Promise<boolean> {
    this.#checkAndAddOpsCount()
    return super.deleteOne(table, criteria)
  }

  deleteMany<T>(opts: DeleteManyOpts<T>): Promise<number> {
    throw new MysqlException('Prohibited to use deleteBy in a strict transaction.')
  }

  findAll<T>(table: Table<T>): Promise<T[]> {
    throw new MysqlException('Prohibited to use findAll in a strict transaction.')
  }

  findFirst<T>(table: Table<T>, criteria?: MixCriteria<T> | undefined): Promise<T | null> {
    this.#checkAndAddOpsCount()
    return super.findFirst(table, criteria)
  }

  insert<T>(table: Table<T>, data: T): Promise<T> {
    this.#checkAndAddOpsCount()
    return super.insert(table, data)
  }

  insertMany<T>(table: Table<T>, list: T[]): Promise<void> {
    throw new MysqlException('Prohibited to use insertMany in a strict transaction.')
  }

  update<T>(table: Table<T>, data: T): Promise<T> {
    this.#checkAndAddOpsCount()
    return super.update(table, data)
  }

  updateMany<T>(opts: UpdateOpts<T>): Promise<number> {
    throw new MysqlException('Prohibited to use updateMany in a strict transaction.')
  }

  updateOne<T>(
    table: Table<T>,
    query: Partial<T>,
    updater: Partial<{ [key in keyof T]: ['setNull'] | ['inc', number] | T[key] | undefined }>
  ): Promise<boolean> {
    this.#checkAndAddOpsCount()
    return super.updateOne(table, query, updater)
  }

  partialUpdate<T>(table: Table<T>, data: Updater<T>): Promise<boolean> {
    this.#checkAndAddOpsCount()
    return super.partialUpdate(table, data)
  }

  find<T>(opts: FindOpts<T>): Promise<T[]> {
    throw new MysqlException('Prohibited to use find in a strict transaction.')
  }

  count<T>(table: Table<T>, criteria?: MixCriteria<T> | undefined): Promise<number> {
    throw new MysqlException('Prohibited to use count in a strict transaction.')
  }

  paginate<T>(opts: MysqlPaginateOpts<T>): Promise<MysqlPage<T>> {
    throw new MysqlException('Prohibited to use paginate in a strict transaction.')
  }

  query<T>(sql: string, values?: any[] | undefined): Promise<T[]> {
    throw new MysqlException('Prohibited to use query in a strict transaction.')
  }

  modify(sql: string, values?: any[] | undefined): Promise<number> {
    throw new MysqlException('Prohibited to use modify in a strict transaction.')
  }
}
