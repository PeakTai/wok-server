import { Pool, PoolConnection } from 'mysql2'
import { MysqlConfig } from '../config'
import { MysqlException } from '../exception'
import { Table } from '../table-info'
import {
  DeleteManyOpts,
  FindOpts,
  MixCriteria,
  MysqlPage,
  MysqlPaginateOpts,
  UpdateOpts,
  Updater,
  count,
  deleteMany,
  deleteById,
  existsBy,
  existsById,
  find,
  findAll,
  findById,
  findByIdIn,
  findFirst,
  insert,
  insertMany,
  modify,
  paginate,
  partialUpdate,
  query,
  update,
  updateMany,
  updateOne
} from './ops'
import { promiseGetConnection } from './utils'

/**
 * mysql 管理器基类，提供基础的操作方法.
 */
export abstract class BaseMysqlManager {
  /**
   * @param mapping 映射
   */
  constructor(
    /**
     * 选项，连接池和连接必须有一个，连接池优先.
     */
    private readonly opts: { config: MysqlConfig; pool?: Pool; connection?: PoolConnection }
  ) {
    if (!opts.pool && !opts.connection) {
      throw new MysqlException('Pool and Connection cannot be both null.')
    }
  }

  protected async queryWithConnection<T>(
    queryFn: (conn: PoolConnection) => Promise<T>
  ): Promise<T> {
    let conn: PoolConnection | undefined
    if (this.opts.pool) {
      conn = await promiseGetConnection(this.opts.pool)
    } else if (this.opts.connection) {
      conn = this.opts.connection
    }
    if (!conn) {
      throw new MysqlException('Unable to obtain connection')
    }
    try {
      return queryFn(conn)
    } finally {
      // 如果是连接池来的，每次连接都是新建，必须释放掉
      if (this.opts.pool) {
        this.opts.pool.releaseConnection(conn)
      }
    }
  }
  /**
   * 依据id查找.
   * @param table 表信息
   * @param id id
   * @returns
   */
  findById<T>(table: Table<T>, id: string | number): Promise<T | null> {
    return this.queryWithConnection(conn => findById(this.opts.config, conn, table, id))
  }
  /**
   * 根据id列表查询
   * @param table
   * @param ids
   * @returns
   */
  findByIdIn<T>(table: Table<T>, ids: Array<string | number>): Promise<T[]> {
    return this.queryWithConnection(conn => findByIdIn(this.opts.config, conn, table, ids))
  }
  /**
   * 根据条件判定是否存在记录.
   * @param table
   * @param criteria  条件信息，可以为空，为空的情况下判定整个表是否有记录
   * @returns
   */
  existsBy<T>(table: Table<T>, criteria?: MixCriteria<T>): Promise<boolean> {
    return this.queryWithConnection(conn => existsBy(this.opts.config, conn, table, criteria))
  }
  /**
   * 根据id判定记录是否存在
   * @param table
   * @param id
   * @returns
   */
  existsById<T>(table: Table<T>, id: string | number): Promise<boolean> {
    return this.queryWithConnection(conn => existsById(this.opts.config, conn, table, id))
  }
  /**
   * 按 id 查询
   * @param table 表信息
   * @param id
   */
  deleteById<T>(table: Table<T>, id: string | number): Promise<boolean> {
    return this.queryWithConnection(conn => deleteById(this.opts.config, conn, table, id))
  }
  /**
   * 按条件删除数据。批量删除是危险操作，建议在使用时尽可能设置 limit 参数来限制数量。
   * @param opts
   * @returns
   */
  deleteMany<T>(opts: DeleteManyOpts<T>): Promise<number> {
    return this.queryWithConnection(conn => deleteMany(this.opts.config, conn, opts))
  }
  /**
   * 仅删除符合条件的一条记录，必须是相等条件
   * @param table
   * @param criteria
   * @returns
   */
  async deleteOne<T>(table: Table<T>, criteria: Partial<T>) {
    if (!Object.keys(criteria).length) {
      throw new MysqlException('criteria cannot be empty !')
    }
    const res = await this.queryWithConnection(conn =>
      deleteMany(this.opts.config, conn, {
        table,
        criteria,
        limit: 1
      })
    )
    return res === 1
  }
  /**
   * 查询表中所有数据.
   * @param table  表信息
   * @returns
   */
  findAll<T>(table: Table<T>): Promise<T[]> {
    return this.queryWithConnection(conn => findAll(this.opts.config, conn, table))
  }
  /**
   * 按条件查询第一条记录.
   * @param table 表信息
   * @param criteria 查询条件
   * @param orderBy 排序规则，按先后顺序放入，每个规则是一个元组，第一个元素是字段名称，第二个元素是顺序
   * @returns
   */
  findFirst<T>(
    table: Table<T>,
    criteria?: MixCriteria<T>,
    orderBy?: Array<[keyof T, 'asc' | 'desc']>
  ): Promise<T | null> {
    return this.queryWithConnection(conn =>
      findFirst(this.opts.config, conn, table, criteria, orderBy)
    )
  }

  /**
   * 插入数据. 不支持自增加长id,id必须提前生成，请使用 uuid.
   * @param table 表信息
   * @param data 数据，数据必须是 T 的实例, T 必须是已配置的实体类类型，否则无法完成操作
   * @returns 插入后的数据
   */
  insert<T>(table: Table<T>, data: T): Promise<T> {
    return this.queryWithConnection(conn => insert(this.opts.config, conn, table, data))
  }
  /**
   * 批量插入
   * @param table 表
   * @param list 要插入的数据列表
   */
  insertMany<T>(table: Table<T>, list: T[]): Promise<void> {
    return this.queryWithConnection(conn => insertMany(this.opts.config, conn, table, list))
  }
  /**
   * 更新
   * @param table 表信息
   * @param data
   */
  update<T>(table: Table<T>, data: T): Promise<T> {
    return this.queryWithConnection(conn => update(this.opts.config, conn, table, data))
  }
  /**
   * 更新所以匹配条件的记录
   * @param opts
   * @returns
   */
  updateMany<T>(opts: UpdateOpts<T>): Promise<number> {
    return this.queryWithConnection(conn => updateMany(this.opts.config, conn, opts))
  }

  /**
   * 只更新一条记录。仅支持相等条件，不支持范围条件，可以严格事务中使用。
   * @param table
   * @param criteria
   * @param updater
   * @returns 更新是否成功
   */
  updateOne<T>(table: Table<T>, criteria: MixCriteria<T>, updater: Updater<T>) {
    if (!Object.keys(criteria).length) {
      throw new MysqlException('criteria cannot be empty !')
    }
    if (!Object.keys(updater).length) {
      throw new MysqlException('updater cannot be empty !')
    }
    return this.queryWithConnection(conn =>
      updateOne(this.opts.config, conn, table, criteria, updater)
    )
  }

  /**
   * 部分更新
   * @param table 表信息
   * @param data 字段信息，必须要包含id字段，如果包含了更新和创建时间的字段，则忽略掉
   */
  partialUpdate<T>(table: Table<T>, data: Updater<T>): Promise<boolean> {
    return this.queryWithConnection(conn => partialUpdate(this.opts.config, conn, table, data))
  }

  /**
   * 查找实体类 自定义条件
   * @param opts
   * @returns
   */
  find<T>(opts: FindOpts<T>): Promise<T[]> {
    return this.queryWithConnection(conn => find(this.opts.config, conn, opts))
  }

  /**
   * 指定条件查询数量
   * @param table 表信息
   * @param criteria 查询条件
   * @returns
   */
  count<T>(table: Table<T>, criteria?: MixCriteria<T>): Promise<number> {
    return this.queryWithConnection(conn => count(this.opts.config, conn, table, criteria))
  }
  /**
   * 分页查询
   * @param opts
   * @returns
   */
  paginate<T>(opts: MysqlPaginateOpts<T>): Promise<MysqlPage<T>> {
    return this.queryWithConnection(conn => paginate(this.opts.config, conn, opts))
  }

  /**
   * 自定义查询，指定 sql 、参数和返回值类型
   * @param sql 预编译 sql ，参数使用 ”?“（英文问号） 占位，注意查询的字段名称会与返回值类型的字段映射，如果 sql 中的字段名称很特殊（比如纯数字等），需要设置别名，避免产生映射错误
   * @param values 要传递的值，对应 sql 中的占位符 ”?“（英文问号）
   * @param T 返回值类型，注意类型映射问题，详细可以参考文档中关于类型映射的说明
   */
  async query<T>(sql: string, values?: any[]): Promise<T[]> {
    return this.queryWithConnection(conn => query(this.opts.config, conn, sql, values))
  }
  /**
   * 自定义 sql 执行，必须是修改类的 sql ，否则会发生错误
   * @param sql
   * @param values
   * @returns 返回影响的行数
   */
  async modify(sql: string, values?: any[]): Promise<number> {
    return this.queryWithConnection(conn => modify(this.opts.config, conn, sql, values))
  }
}
