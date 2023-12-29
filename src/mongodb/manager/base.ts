import { ClientSession, Db, Document, Filter, SortDirection, UpdateFilter } from 'mongodb'
import { getLogger } from '../../log'
import { min, notNull, validate } from '../../validation'
import { MongoCollection } from '../collection'
import { MongoDBConfig } from '../config'
import { MongoDocId, MongoDocWithId } from '../doc'
import { MongoDBException } from '../exception'

/**
 * mysql 分页查询结果
 */
export interface MongoPage<T> {
  total: number
  list: T[]
}

/**
 * mongodb 管理器基类，提供基本的操作功能.
 */
export abstract class BaseMongoManager {
  /**
   * mongodb 管理器构建
   * @param db 库
   * @param session 要绑定的会话，用于事务
   */
  constructor(
    protected config: MongoDBConfig,
    protected readonly db: Db,
    private session?: ClientSession
  ) {}

  getCollection<T extends Document>(collInfo: MongoCollection<T>) {
    return this.db.collection<T>(collInfo.collectionName)
  }
  /**
   * 查询计时
   * @param opts
   */
  protected async timingQuery<T, D extends { op: string; coll: string }>(opts: {
    // 查询处理逻辑
    query: () => Promise<T>
    // 信息描述,当查询较慢时打印到日志中
    desc: () => D
  }): Promise<T> {
    const start = new Date().getTime()
    try {
      return await opts.query()
    } finally {
      if (this.config.slowQueryWarn) {
        const cost = new Date().getTime() - start
        if (cost > this.config.slowQueryMs) {
          getLogger().warn(`[mongodb slow query] ${cost}ms ${JSON.stringify(opts.desc())}`)
        }
      }
    }
  }

  async findById<T extends Document>(
    coll: MongoCollection<T>,
    id: MongoDocId
  ): Promise<MongoDocWithId<T> | null> {
    return this.timingQuery({
      query: async () => {
        const res = await this.getCollection(coll).findOne({ _id: id } as Filter<T>, {
          limit: 1,
          session: this.session
        })
        return res as MongoDocWithId<T> | null
      },
      desc: () => ({
        op: 'findById',
        coll: coll.collectionName,
        id
      })
    })
  }

  /**
   * 根据id列表查询
   * @param coll
   * @param ids
   * @returns
   */
  findByIdIn<T extends Document>(
    coll: MongoCollection<T>,
    ids: MongoDocId[]
  ): Promise<MongoDocWithId<T>[]> {
    return this.timingQuery({
      query: async () => {
        const res = this.getCollection(coll).find<MongoDocWithId<T>>(
          { _id: { $in: ids } } as Filter<T>,
          { session: this.session }
        )
        return res.toArray()
      },
      desc() {
        return {
          op: 'findByIdIn',
          coll: coll.collectionName,
          ids
        }
      }
    })
  }

  /**
   * 根据id判定是否存在
   * @param coll
   * @param id
   */
  async existsById<T extends Document>(coll: MongoCollection<T>, id: MongoDocId): Promise<boolean> {
    const res = await this.findById(coll, id)
    return !!res
  }
  /**
   * 按指定的条件来判定是否存在记录
   * @param coll
   * @param filter
   */
  async existsBy<T extends Document>(
    coll: MongoCollection<T>,
    filter: Filter<MongoDocWithId<T>>
  ): Promise<boolean> {
    return this.timingQuery({
      query: async () => {
        const res = await this.getCollection(coll).findOne(filter as Filter<T>, {
          limit: 1,
          session: this.session
        })
        return !!res
      },
      desc() {
        return {
          op: 'existsBy',
          coll: coll.collectionName,
          filter
        }
      }
    })
  }
  /**
   * 按id进行删除
   * @param coll
   * @param id
   * @returns
   */
  async deleteById<T extends Document>(coll: MongoCollection<T>, id: MongoDocId): Promise<boolean> {
    return this.timingQuery({
      query: async () => {
        const res = await this.getCollection(coll).deleteOne({ _id: id } as Filter<T>, {
          session: this.session
        })
        return res.deletedCount === 1
      },
      desc() {
        return {
          op: 'deleteById',
          coll: coll.collectionName,
          id
        }
      }
    })
  }

  /**
   * 仅删除一条记录
   * @param coll
   * @param filter
   * @returns
   */
  async deleteOne<T extends Document>(
    coll: MongoCollection<T>,
    filter: Partial<T>
  ): Promise<boolean> {
    if (!Object.keys(filter).length) {
      throw new MongoDBException('filter cannot be empty !')
    }
    return this.timingQuery({
      query: async () => {
        const res = await this.getCollection(coll).deleteOne(filter as Filter<T>, {
          session: this.session
        })
        return res.deletedCount === 1
      },
      desc() {
        return {
          op: 'deleteMany',
          coll: coll.collectionName,
          filter
        }
      }
    })
  }

  /**
   * 按条件删除数据，返回删除的记录行数.
   * 务必谨慎使用，大批量删除容易带来性能问题，造成线上事故.
   * @param coll
   * @param filter
   * @returns 被删除记录的数量
   */
  async deleteMany<T extends Document>(
    coll: MongoCollection<T>,
    filter: Filter<MongoDocWithId<T>>
  ): Promise<number> {
    if (!Object.keys(filter).length) {
      throw new MongoDBException('filter cannot be empty !')
    }
    return this.timingQuery({
      query: async () => {
        const res = await this.getCollection(coll).deleteMany(filter as Filter<T>, {
          session: this.session
        })
        return res.deletedCount
      },
      desc() {
        return {
          op: 'deleteMany',
          coll: coll.collectionName,
          filter
        }
      }
    })
  }

  /**
   * 查询集合中所有记录.谨慎使用！
   * @param coll
   * @returns
   */
  async findAll<T extends Document>(coll: MongoCollection<T>): Promise<MongoDocWithId<T>[]> {
    return this.timingQuery({
      query: async () => {
        const arr = await this.getCollection(coll).find({}, { session: this.session }).toArray()
        return arr as MongoDocWithId<T>[]
      },
      desc() {
        return {
          op: 'findAll',
          coll: coll.collectionName
        }
      }
    })
  }
  /**
   * 根据给定的条件查找第一条符合条件的记录
   * @param coll
   * @param filter
   * @returns
   */
  async findFirst<T extends Document>(
    coll: MongoCollection<T>,
    filter: Filter<MongoDocWithId<T>>
  ): Promise<MongoDocWithId<T> | null> {
    return this.timingQuery({
      query: async () => {
        const res = await this.getCollection(coll).findOne(filter as Filter<T>, {
          limit: 1,
          session: this.session
        })
        return res as MongoDocWithId<T> | null
      },
      desc() {
        return {
          op: 'findFirst',
          coll: coll.collectionName,
          filter
        }
      }
    })
  }
  /**
   * 插入新记录
   * @param coll
   * @param data
   * @returns
   */
  async insert<T extends Document>(
    coll: MongoCollection<T>,
    data: T & { _id?: MongoDocId }
  ): Promise<MongoDocWithId<T>> {
    return this.timingQuery({
      query: async () => {
        // 创建时间和更新时间
        if (coll.createdDate) {
          const createdData = coll.createdDate.type === 'date' ? new Date() : new Date().getTime()
          data[coll.createdDate.field] = createdData as any
        }
        if (coll.updatedDate) {
          const updatedDate = coll.updatedDate.type === 'date' ? new Date() : new Date().getTime()
          data[coll.updatedDate.field] = updatedDate as any
        }
        const collection = this.getCollection(coll)
        const res = await collection.insertOne(data as any, { session: this.session })
        if (data._id) {
          return data as any
        }
        data._id = res.insertedId
        return data as any
      },
      desc() {
        return {
          op: 'insert',
          coll: coll.collectionName,
          data
        }
      }
    })
  }
  /**
   * 插入多条，批量插入.
   * @param coll
   * @param list
   */
  async insertMany<T extends Document>(
    coll: MongoCollection<T>,
    list: Array<T & { _id?: MongoDocId }>
  ): Promise<MongoDocWithId<T>[]> {
    return this.timingQuery({
      query: async () => {
        const docList = list.map(data => {
          // 创建时间和更新时间
          if (coll.createdDate) {
            const createdData = coll.createdDate.type === 'date' ? new Date() : new Date().getTime()
            data[coll.createdDate.field] = createdData as any
          }
          if (coll.updatedDate) {
            const updatedDate = coll.updatedDate.type === 'date' ? new Date() : new Date().getTime()
            data[coll.updatedDate.field] = updatedDate as any
          }
          return data
        })

        const collection = this.getCollection(coll)
        const res = await collection.insertMany(docList as any, { session: this.session })
        docList.forEach((doc, idx) => {
          if (doc._id) {
            return
          }
          if (res.insertedIds[idx]) {
            doc._id = res.insertedIds[idx]
          }
        })
        return docList as any
      },
      desc() {
        return {
          op: 'insertMany',
          coll: coll.collectionName,
          list
        }
      }
    })
  }
  /**
   * 更新，更新完整的文档内容。
   * @param coll 集合信息
   * @param data 要更新的数据，必须包含 _id 字段，支持 mongo 更新语法 $inc 等
   * @returns 返回最新的数据
   * @throws MongoDBException 当无法完成更新时抛出
   */
  async update<T extends Document>(
    coll: MongoCollection<T>,
    data: MongoDocWithId<T>
  ): Promise<MongoDocWithId<T>> {
    return this.timingQuery({
      query: async () => {
        const id = data._id
        if (!id) {
          throw new MongoDBException(
            `Cannot update a document without an id，collection name：${coll.collectionName}`
          )
        }
        delete (data as any)._id
        let createData: any = undefined
        // 保护创建时间不被更新
        if (coll.createdDate && data[coll.createdDate.field]) {
          createData = data[coll.createdDate.field]
          delete data[coll.createdDate.field]
        }
        // 更新时间
        if (coll.updatedDate) {
          const updatedDate = coll.updatedDate.type === 'date' ? new Date() : new Date().getTime()
          data[coll.updatedDate.field] = updatedDate as any
        }

        const res = await this.getCollection(coll).updateOne(
          { _id: id } as Filter<T>,
          { $set: data },
          {
            session: this.session
          }
        )
        if (res.modifiedCount !== 1) {
          throw new MongoDBException(
            `Failed to update record, possibly due to non-existent record，collection：${coll.collectionName}，id：${id}`
          )
        }
        data._id = id
        if (coll.createdDate && createData) {
          data[coll.createdDate.field] = createData
        }
        return data
      },
      desc() {
        return {
          op: 'update',
          coll: coll.collectionName,
          data
        }
      }
    })
  }
  /**
   * 仅更新一条记录
   * @param coll
   * @param filter
   * @param updater
   */
  async updateOne<T extends Document>(
    coll: MongoCollection<T>,
    filter: Partial<T>,
    updater: UpdateFilter<T>
  ) {
    if (!Object.keys(filter).length) {
      throw new MongoDBException('filter cannot be empty !')
    }
    if (!Object.keys(updater).length) {
      throw new MongoDBException('updater cannot be empty !')
    }
    return this.timingQuery({
      query: async () => {
        // 更新时间处理
        if (coll.updatedDate) {
          const updatedDate: any =
            coll.updatedDate.type === 'date' ? new Date() : new Date().getTime()
          if (updater.$set) {
            updater.$set[coll.updatedDate.field] = updatedDate
          } else {
            updater.$set = { [coll.updatedDate.field]: updatedDate } as any
          }
        }
        const res = await this.getCollection(coll).updateOne(filter as Filter<T>, updater, {
          session: this.session
        })
        return res.modifiedCount === 1
      },
      desc() {
        return {
          op: 'updateOne',
          coll: coll.collectionName,
          filter,
          updator: updater
        }
      }
    })
  }
  /**
   * 局部更新，仅更新部分字段，可对字段做递增或数组元组的处理。
   * @param coll 集合信息
   * @param id id
   * @param updater 更新内容
   * @returns 更新是否成功
   */
  async partialUpdate<T extends Document>(
    coll: MongoCollection<T>,
    id: MongoDocId,
    updater: UpdateFilter<T>
  ): Promise<boolean> {
    if (!Object.keys(updater).length) {
      throw new MongoDBException('updater cannot be empty !')
    }
    return this.timingQuery({
      query: async () => {
        // 更新时间处理
        if (coll.updatedDate) {
          const updatedDate: any =
            coll.updatedDate.type === 'date' ? new Date() : new Date().getTime()
          if (updater.$set) {
            updater.$set[coll.updatedDate.field] = updatedDate
          } else {
            updater.$set = { [coll.updatedDate.field]: updatedDate } as any
          }
        }
        const res = await this.getCollection(coll).updateOne({ _id: id as any }, updater, {
          session: this.session
        })
        return res.modifiedCount === 1
      },
      desc() {
        return {
          op: 'partialUpdate',
          coll: coll.collectionName,
          id,
          updator: updater
        }
      }
    })
  }

  /**
   * 根据条件更新多条记录，和 partialUpdate 区别是可以根据过滤条件来处理多条记录。
   * @param coll 集合
   * @param filter 过滤规则
   * @param updater 更新内容
   * @returns 此次更新的记录数
   */
  async updateMany<T extends Document>(
    coll: MongoCollection<T>,
    filter: Filter<MongoDocWithId<T>>,
    updater: UpdateFilter<T>
  ): Promise<number> {
    if (!Object.keys(filter).length) {
      throw new MongoDBException('filter cannot be empty !')
    }
    if (!Object.keys(updater).length) {
      throw new MongoDBException('updater cannot be empty !')
    }
    return this.timingQuery({
      query: async () => {
        // 更新时间处理
        if (coll.updatedDate) {
          const updatedDate: any =
            coll.updatedDate.type === 'date' ? new Date() : new Date().getTime()
          if (updater.$set) {
            updater.$set[coll.updatedDate.field] = updatedDate
          } else {
            updater.$set = { [coll.updatedDate.field]: updatedDate } as any
          }
        }
        const res = await this.getCollection(coll).updateMany(filter as Filter<T>, updater, {
          session: this.session
        })
        return res.modifiedCount
      },
      desc() {
        return {
          op: 'updateMany',
          coll: coll.collectionName,
          filter,
          updator: updater
        }
      }
    })
  }

  /**
   * 条件查询
   * @param coll 集合信息
   * @param filter 过滤条件
   * @param opts 额外的选项
   * @returns
   */
  async find<T extends Document>(
    coll: MongoCollection<T>,
    filter: Filter<MongoDocWithId<T>>,
    opts?: {
      /**
       * 偏移，需要 limit 有值才可以
       */
      offset?: number
      /**
       * 限制返回的数量
       */
      limit?: number
      /**
       * 排序规则，按先后顺序放入，每个规则是一个元组，第一个元素是字段名称，第二个元素是顺序
       */
      orderBy?: Array<[keyof MongoDocWithId<T>, 'asc' | 'desc']>
    }
  ): Promise<MongoDocWithId<T>[]> {
    return this.timingQuery({
      query: async () => {
        const arr = await this.getCollection(coll)
          .find(filter as Filter<T>, {
            limit: opts && opts.limit && opts.limit > 0 ? opts.limit : undefined,
            skip:
              opts && opts.limit && opts.limit > 0 && opts.offset && opts.offset > 0
                ? opts.offset
                : undefined,
            sort: opts && opts.orderBy ? (opts.orderBy as [string, SortDirection][]) : undefined,
            session: this.session
          })
          .toArray()
        return arr as MongoDocWithId<T>[]
      },
      desc() {
        return {
          op: 'find',
          coll: coll.collectionName,
          filter,
          opts
        }
      }
    })
  }
  /**
   * 查询符合条件的文档数量。请谨慎使用，count 是不能从索引直接读取的，只能实时计数，使用不当容易造成性能问题，引发线上事故。
   * @param coll
   * @param filter
   * @returns
   */
  count<T extends Document>(
    coll: MongoCollection<T>,
    filter: Filter<MongoDocWithId<T>>
  ): Promise<number> {
    return this.timingQuery({
      query: async () => {
        return this.getCollection(coll).countDocuments(filter, { session: this.session })
      },
      desc() {
        return {
          op: 'count',
          coll: coll.collectionName,
          filter
        }
      }
    })
  }

  /**
   * 分页查询。谨慎使用，不建议对规模较大的数据查询直接使用分页。
   * @param coll 集合信息
   * @param filter 过滤条件
   * @param opts 分页参数
   */
  async paginate<T extends Document>(
    coll: MongoCollection<T>,
    filter: Filter<MongoDocWithId<T>>,
    opts: {
      /**
       * 页码，从1开始，第一页是 1
       */
      pn: number
      /**
       * 每页的数据量大小
       */
      pz: number
      /**
       * 排序规则，按先后顺序放入，每个规则是一个元组，第一个元素是字段名称，第二个元素是顺序
       */
      orderBy?: Array<[keyof MongoDocWithId<T>, 'asc' | 'desc']>
    }
  ): Promise<MongoPage<MongoDocWithId<T>>> {
    validate(opts, {
      pn: [notNull(), min(1)],
      pz: [notNull(), min(1)]
    })
    const start = new Date().getTime()
    try {
      const offset = (opts.pn - 1) * opts.pz
      const res = await Promise.all([
        this.find(coll, filter, { offset, limit: opts.pz, orderBy: opts.orderBy }),
        this.count(coll, filter)
      ])
      const [list, total] = res
      return { list, total }
    } finally {
      if (this.config.slowQueryWarn) {
        const cost = new Date().getTime() - start
        if (cost > this.config.slowQueryMs) {
          getLogger().warn(
            `[mongodb slow query] ${cost}ms ${JSON.stringify({
              op: 'paginate',
              coll: coll.collectionName,
              filter,
              opts
            })}`
          )
        }
      }
    }
  }
}
