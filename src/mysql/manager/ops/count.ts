import { PoolConnection, RowDataPacket } from 'mysql2'
import { Table } from '../../table-info'
import { MixCriteria, buildQuery } from './criteria'
import { promiseQuery } from '../utils'
import { MysqlConfig } from '../../config'

/**
 * 按条件统计数量.
 * @param config
 * @param conn
 * @param table
 * @param criteria
 * @returns
 */
export async function count<T>(
  config: MysqlConfig,
  conn: PoolConnection,
  table: Table<T>,
  criteria?: MixCriteria<T>
): Promise<number> {
  let query = criteria ? buildQuery(criteria) : undefined
  const res = await promiseQuery(
    config,
    conn,
    `select count(*) as ct from ?? ${query ? `where ${query.sql}` : ''} `,
    [table.tableName].concat(query ? query.values : [])
  )
  const row = res as RowDataPacket[]
  return row[0].ct
}
