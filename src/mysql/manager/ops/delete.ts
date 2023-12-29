import { PoolConnection, ResultSetHeader } from 'mysql2'
import { MysqlException } from '../../exception'
import { Table } from '../../table-info'
import { promiseQuery } from '../utils'
import { MixCriteria, buildQuery } from './criteria'
import { MysqlConfig } from '../../config'

/**
 * 按 id 删除.
 *
 * @param config
 * @param connection
 * @param mapping
 * @param type
 * @param id
 */
export async function deleteById<T>(
  config: MysqlConfig,
  connection: PoolConnection,
  table: Table<T>,
  id: string | number
): Promise<boolean> {
  const res = await promiseQuery(config, connection, `delete from ?? where ?? = ?`, [
    table.tableName,
    table.id,
    id
  ])
  const ok = res as ResultSetHeader
  return ok.affectedRows === 1
}
/**
 * 批量删除的选项
 */
export interface DeleteManyOpts<T> {
  /**
   * 表.
   */
  table: Table<T>
  /**
   * 查询条件
   * @param criteria
   * @returns
   */
  criteria: MixCriteria<T>
  /**
   * 限制数量
   */
  limit?: number
  /**
   * 排序规则，按先后顺序放入，每个规则是一个元组，第一个元素是字段名称，第二个元素是顺序
   */
  orderBy?: Array<[keyof T, 'asc' | 'desc']>
}

/**
 * 按条件删除，返回被删除的记录数.
 * 务必谨慎使用，大批量删除容易带来性能问题，造成线上事故.
 * @param config
 * @param connection
 * @param table
 * @param criteria
 */
export async function deleteMany<T>(
  config: MysqlConfig,
  connection: PoolConnection,
  opts: DeleteManyOpts<T>
): Promise<number> {
  let sql = 'delete from ?? '
  const values: any[] = [opts.table.tableName]
  let query = buildQuery(opts.criteria)
  if (!query) {
    throw new MysqlException('No valid criteria specified.')
  }
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
  }
  const res = await promiseQuery(config, connection, sql, values)
  return (res as ResultSetHeader).affectedRows
}
