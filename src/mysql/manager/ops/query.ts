import { PoolConnection, RowDataPacket } from 'mysql2'
import { promiseQuery } from '../utils'
import { MysqlConfig } from '../../config'

export async function query<T>(
  config: MysqlConfig,
  connection: PoolConnection,
  sql: string,
  values?: any[]
): Promise<T[]> {
  const res = await promiseQuery(config, connection, sql, values || [])
  return res as RowDataPacket[] as T[]
}
