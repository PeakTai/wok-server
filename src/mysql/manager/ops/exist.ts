import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2'
import { Table } from '../../table-info'
import { MixCriteria, buildQuery } from './criteria'
import { promiseQuery } from '../utils'
import { MysqlConfig } from '../../config'

export async function existsById<T>(
  config: MysqlConfig,
  connection: PoolConnection,
  table: Table<T>,
  id: string | number
): Promise<boolean> {
  const res = await promiseQuery(config, connection, `select 1 from ?? where ?? = ?`, [
    table.tableName,
    table.id,
    id
  ])
  const rows = res as RowDataPacket[]
  return !!rows.length
}

export async function existsBy<T>(
  config: MysqlConfig,
  connection: PoolConnection,
  table: Table<T>,
  criteria?: MixCriteria<T>
): Promise<boolean> {
  let query = criteria ? buildQuery(criteria) : undefined
  let sql = `select 1 from ?? `
  if (query) {
    sql += ` where ${query.sql} `
  }
  const res = await promiseQuery(
    config,
    connection,
    sql,
    [table.tableName].concat(query ? query.values : [])
  )
  const rows = res as ResultSetHeader[]
  return !!rows.length
}
