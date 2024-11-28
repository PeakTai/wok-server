import { PoolConnection, RowDataPacket } from 'mysql2'
import { Table } from '../../table-info'
import { MixCriteria, buildQuery } from './criteria'
import { promiseQuery } from '../utils'
import { MysqlConfig } from '../../config'

/**
 * 按 id 查询
 * @param connection
 * @param mapping
 * @param type
 * @param id
 */
export async function findById<T>(
  config: MysqlConfig,
  connection: PoolConnection,
  table: Table<T>,
  id: string | number
): Promise<T | null> {
  const res = await promiseQuery(config, connection, `select * from ?? where ?? = ?`, [
    table.tableName,
    table.id,
    id
  ])
  const rows = res as RowDataPacket[]
  if (!rows.length) {
    return null
  }
  return rows[0] as T
}

/**
 * 查询表中所有数据。需谨慎操作，全表查询有可能会产生大列表问题。
 * @param connection
 * @param mapping
 * @param type
 * @returns
 */
export async function findAll<T>(
  config: MysqlConfig,
  connection: PoolConnection,
  table: Table<T>
): Promise<T[]> {
  const res = await promiseQuery(config, connection, `select * from ??`, [table.tableName])
  return res as RowDataPacket[] as T[]
}

export interface FindOpts<T> {
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
  orderBy?: Array<[keyof T, 'asc' | 'desc']>
}
/**
 * 条件查询
 * @param opts
 * @returns
 */
export async function find<T>(
  config: MysqlConfig,
  conn: PoolConnection,
  opts: FindOpts<T>
): Promise<T[]> {
  let query = opts.criteria ? buildQuery(opts.criteria) : undefined
  const values: any[] = []
  let sql = `select * from ?? `
  values.push(opts.table.tableName)
  if (query) {
    sql += ` where ${query.sql} `
    values.push(...query.values)
  }
  // 排序
  if (opts.orderBy && opts.orderBy.length) {
    opts.orderBy.forEach((orderBy, idx) => {
      const [field, sort] = orderBy
      if (idx == 0) {
        sql += ` order by ?? ${sort} `
      } else {
        sql += ` , ?? ${sort} `
      }
      values.push(field)
    })
  }
  // 数量限制
  if (opts.limit) {
    sql += ` limit ${opts.limit} `
    if (opts.offset) {
      sql += ` offset ${opts.offset}`
    }
  }
  const res = await promiseQuery(config, conn, sql, values)
  return res as RowDataPacket[] as T[]
}
/**
 * 根据 id 列表查询记录
 * @param connection
 * @param table
 * @param ids
 * @returns
 */
export async function findByIdIn<T>(
  config: MysqlConfig,
  connection: PoolConnection,
  table: Table<T>,
  ids: Array<string | number>
): Promise<T[]> {
  if (!ids.length) {
    return []
  }
  return find(config, connection, {
    table,
    criteria: c => c.in(table.id, ids)
  })
}

/**
 * 查找符合条件的第一条记录
 * @param conn
 * @param table
 * @param criteria
 * @returns
 */
export async function findFirst<T>(
  config: MysqlConfig,
  conn: PoolConnection,
  table: Table<T>,
  criteria?: MixCriteria<T>,
  /**
   * 排序规则，按先后顺序放入，每个规则是一个元组，第一个元素是字段名称，第二个元素是顺序
   */
  orderBy?: Array<[keyof T, 'asc' | 'desc']>
): Promise<T | null> {
  let query = criteria ? buildQuery(criteria) : undefined
  let sql = `select * from ?? `
  const values: any[] = [table.tableName]
  if (query) {
    sql += ` where ${query.sql} `
    values.push(...query.values)
  }
   // 排序
   if (orderBy && orderBy.length) {
    orderBy.forEach((orderBy, idx) => {
      const [field, sort] = orderBy
      if (idx == 0) {
        sql += ` order by ?? ${sort} `
      } else {
        sql += ` , ?? ${sort} `
      }
      values.push(field)
    })
  }
  sql += ' limit 1'
  const res = await promiseQuery(
    config,
    conn,
    sql,
    values
  )
  const list = res as RowDataPacket[] as T[]
  return list.length ? list[0] : null
}
