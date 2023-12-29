// 工具集，将一些驱动的方法进行 promise 封装，方便操作
// 程序中没有使用 mysql2/promise ，主要是在测试中发现 mysql2/promise 不是很可靠
// mysql2/promise 在查询方便处理的不是很好
// query 查询在没有记录的情况下仍然会返回列表，里面会包含列定义信息，不符合预期

import {
  Connection,
  OkPacket,
  Pool,
  PoolConnection,
  ProcedureCallPacket,
  ResultSetHeader,
  RowDataPacket,
  format
} from 'mysql2'
import { MysqlConfig } from '../config'
import { getLogger } from '../../log'

/**
 * 查询，适用于各种 sql 的执行
 * @param config
 * @param conn
 * @param sql
 * @param values
 * @returns
 */
export function promiseQuery(
  config: MysqlConfig,
  conn: Connection,
  sql: string,
  values: any[] = []
) {
  return new Promise<
    | OkPacket
    | ResultSetHeader
    | ResultSetHeader[]
    | RowDataPacket[]
    | RowDataPacket[][]
    | OkPacket[]
    | ProcedureCallPacket
  >((res, rej) => {
    const start = new Date().getTime()
    conn.query(sql, values, (err, result) => {
      if (config.slowSqlWarn) {
        const cost = new Date().getTime() - start
        // 慢 sql 警告
        if (cost > config.slowSqlMs) {
          getLogger().warn(`[mysql slow sql] ${cost}ms ${format(sql, values)}`)
        }
      }
      if (err) {
        rej(err)
      } else {
        res(result)
      }
    })
  })
}

/**
 * 获取连接
 * @param pool
 * @returns
 */
export function promiseGetConnection(pool: Pool) {
  return new Promise<PoolConnection>((res, rej) => {
    pool.getConnection((err, conn) => {
      if (err) {
        rej(err)
      } else {
        res(conn)
      }
    })
  })
}
