import { PoolConnection } from 'mysql2'
import { Table } from '../../table-info'
import { count } from './count'
import { MixCriteria } from './criteria'
import { find, findSelect } from './find'
import { MysqlConfig } from '../../config'
import { OrderBy } from './order-by'

export interface MysqlPaginateOpts<T> {
  /**
   * 表
   */
  table: Table<T>
  /**
   * 查询条件
   * @param criteria
   * @returns
   */
  criteria?: MixCriteria<T>
  /**
   * 而码,默认1
   */
  pn?: number
  /**
   * 每页的数据量大小,默认 20, 必须在 1-1000 之间
   */
  pz?: number
  /**
   * 排序规则，按先后顺序放入，每个规则是一个元组，第一个元素是字段名称，第二个元素是顺序
   */
  orderBy?: OrderBy<T>
}
/**
 * mysql 分页查询结果
 */
export interface MysqlPage<T> {
  total: number
  list: T[]
}

export async function paginate<T>(
  config: MysqlConfig,
  conn: PoolConnection,
  opts: MysqlPaginateOpts<T>
): Promise<MysqlPage<T>> {
  const pn = opts.pn && opts.pn >= 1 ? opts.pn : 1
  const limit = opts.pz && opts.pz >= 1 && opts.pz <= 1000 ? opts.pz : 20
  const offset = (pn - 1) * limit
  const list = await find(config, conn, {
    table: opts.table,
    criteria: opts.criteria,
    offset,
    limit,
    orderBy: opts.orderBy
  })
  const total = await count(config, conn, opts.table, opts.criteria)
  return {
    total,
    list
  }
}

/**
 * 指定字段分页查询选项
 */
export interface MysqlPaginateSelectOpts<T, K extends keyof T> extends MysqlPaginateOpts<T> {
  /**
   * 要查询的字段
   */
  select: K[]
}

/**
 * 指定字段分页查询
 * @param config
 * @param conn
 * @param opts
 */
export async function paginateSelect<T, K extends keyof T>(
  config: MysqlConfig,
  conn: PoolConnection,
  opts: MysqlPaginateSelectOpts<T, K>
): Promise<MysqlPage<Pick<T, K>>> {
  const pn = opts.pn && opts.pn >= 1 ? opts.pn : 1
  const limit = opts.pz && opts.pz >= 1 && opts.pz <= 1000 ? opts.pz : 20
  const offset = (pn - 1) * limit
  const list = await findSelect(config, conn, {
    table: opts.table,
    criteria: opts.criteria,
    offset,
    limit,
    orderBy: opts.orderBy,
    select: opts.select
  })
  const total = await count(config, conn, opts.table, opts.criteria)
  return {
    total,
    list
  }
}
