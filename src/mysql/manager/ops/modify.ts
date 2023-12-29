import { PoolConnection, ResultSetHeader } from 'mysql2'
import { promiseQuery } from '../utils'
import { MysqlConfig } from '../../config'

export async function modify(
  config: MysqlConfig,
  connection: PoolConnection,
  sql: string,
  values?: any[]
): Promise<number> {
  const res = await promiseQuery(config, connection, sql, values || [])
  const pck = res as ResultSetHeader
  return pck.affectedRows
}
