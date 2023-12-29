import { ClientSession, Db, Document, Filter, UpdateFilter } from 'mongodb'
import { MongoCollection } from '../collection'
import { MongoDBConfig } from '../config'
import { MongoDocId, MongoDocWithId } from '../doc'
import { MongoDBException } from '../exception'
import { MongoPage } from './base'
import { MongoTxSession } from './tx'

/**
 * 严格事务会话
 */
export class MongoStrictTxSession extends MongoTxSession {
  #opsCount = 0
  constructor(config: MongoDBConfig, db: Db, session: ClientSession) {
    super(config, db, session)
  }
  /**
   * 为操作计数，检查是否操作次数过多.
   */
  #checkAndAddOpsCount() {
    if (this.#opsCount >= 10) {
      throw new MongoDBException('Too many operations in a strict transaction.')
    }
    this.#opsCount++
  }

  findById<T extends Document>(
    coll: MongoCollection<T>,
    id: MongoDocId
  ): Promise<MongoDocWithId<T> | null> {
    this.#checkAndAddOpsCount()
    return super.findById(coll, id)
  }

  findByIdIn<T extends Document>(
    coll: MongoCollection<T>,
    ids: MongoDocId[]
  ): Promise<MongoDocWithId<T>[]> {
    if (ids.length > 100) {
      throw new MongoDBException(
        `The augument ids length(${ids.length}) passed to findByIdIn in a strict transaction is too large .`
      )
    }
    this.#checkAndAddOpsCount()
    return super.findByIdIn(coll, ids)
  }

  existsBy<T extends Document>(
    coll: MongoCollection<T>,
    filter: Filter<MongoDocWithId<T>>
  ): Promise<boolean> {
    this.#checkAndAddOpsCount()
    return super.existsBy(coll, filter)
  }

  deleteById<T extends Document>(coll: MongoCollection<T>, id: MongoDocId): Promise<boolean> {
    this.#checkAndAddOpsCount()
    return super.deleteById(coll, id)
  }

  deleteOne<T extends Document>(coll: MongoCollection<T>, filter: Partial<T>): Promise<boolean> {
    this.#checkAndAddOpsCount()
    return super.deleteOne(coll, filter)
  }

  deleteMany<T extends Document>(
    coll: MongoCollection<T>,
    filter: Filter<MongoDocWithId<T>>
  ): Promise<number> {
    throw new MongoDBException('Prohibited to use deleteMany in a strict transaction.')
  }

  findAll<T extends Document>(coll: MongoCollection<T>): Promise<MongoDocWithId<T>[]> {
    throw new MongoDBException('Prohibited to use findAll in a strict transaction.')
  }

  findFirst<T extends Document>(
    coll: MongoCollection<T>,
    filter: Filter<MongoDocWithId<T>>
  ): Promise<MongoDocWithId<T> | null> {
    this.#checkAndAddOpsCount()
    return super.findFirst(coll, filter)
  }

  insert<T extends Document>(
    coll: MongoCollection<T>,
    data: T & { _id?: MongoDocId | undefined }
  ): Promise<MongoDocWithId<T>> {
    this.#checkAndAddOpsCount()
    return super.insert(coll, data)
  }

  insertMany<T extends Document>(
    coll: MongoCollection<T>,
    list: (T & { _id?: MongoDocId | undefined })[]
  ): Promise<MongoDocWithId<T>[]> {
    throw new MongoDBException('Prohibited to use insertMany in a strict transaction.')
  }

  update<T extends Document>(
    coll: MongoCollection<T>,
    data: MongoDocWithId<T>
  ): Promise<MongoDocWithId<T>> {
    this.#checkAndAddOpsCount()
    return super.update(coll, data)
  }

  partialUpdate<T extends Document>(
    coll: MongoCollection<T>,
    id: MongoDocId,
    updator: UpdateFilter<T>
  ): Promise<boolean> {
    this.#checkAndAddOpsCount()
    return super.partialUpdate(coll, id, updator)
  }

  updateMany<T extends Document>(
    coll: MongoCollection<T>,
    filter: Filter<MongoDocWithId<T>>,
    updator: UpdateFilter<T>
  ): Promise<number> {
    throw new MongoDBException('Prohibited to use updateMany in a strict transaction.')
  }

  find<T extends Document>(
    coll: MongoCollection<T>,
    filter: Filter<MongoDocWithId<T>>,
    opts?:
      | {
          offset?: number | undefined
          limit?: number | undefined
          orderBy?: ['_id' | keyof T, 'asc' | 'desc'][] | undefined
        }
      | undefined
  ): Promise<MongoDocWithId<T>[]> {
    throw new MongoDBException('Prohibited to use find in a strict transaction.')
  }

  count<T extends Document>(
    coll: MongoCollection<T>,
    filter: Filter<MongoDocWithId<T>>
  ): Promise<number> {
    throw new MongoDBException('Prohibited to use count in a strict transaction.')
  }

  paginate<T extends Document>(
    coll: MongoCollection<T>,
    filter: Filter<MongoDocWithId<T>>,
    opts: { pn: number; pz: number; orderBy?: ['_id' | keyof T, 'asc' | 'desc'][] | undefined }
  ): Promise<MongoPage<MongoDocWithId<T>>> {
    throw new MongoDBException('Prohibited to use paginate in a strict transaction.')
  }
}
