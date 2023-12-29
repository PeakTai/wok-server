import { PoolConnection, ResultSetHeader } from 'mysql2'
import { MysqlException } from '../../exception'
import { Table } from '../../table-info'
import { promiseQuery } from '../utils'
import { MysqlConfig } from '../../config'

/**
 * 为表插入数据
 * @param connection
 * @param table
 * @param data
 * @returns
 */
export async function insert<T>(
  config: MysqlConfig,
  connection: PoolConnection,
  table: Table<T>,
  data: T
): Promise<T> {
  // 插入后的新数据
  // 列信息，使用 set 防止 columns 中重复配置 id 和更新创建时间列
  let columnsSet: Set<keyof T> = new Set()
  // 判定下 id ，如果有值，才在 insert 语句中出现 id 列，否则不出现
  if (data[table.id]) {
    columnsSet.add(table.id)
  }
  table.columns.forEach(col => columnsSet.add(col))
  if (table.createdDate) {
    const createdData = table.createdDate.type === 'date' ? new Date() : new Date().getTime()
    data[table.createdDate.column] = createdData as any
    columnsSet.add(table.createdDate.column)
  }
  if (table.updatedDate) {
    const updatedDate = table.updatedDate.type === 'date' ? new Date() : new Date().getTime()
    data[table.updatedDate.column] = updatedDate as any
    columnsSet.add(table.updatedDate.column)
  }
  const columns = Array.from(columnsSet)
  // 构建 sql
  const sql = `insert into ??(${columns.map(() => '??').join(',')}) values(${columns
    .map(() => '?')
    .join(',')})`
  const values: any[] = [table.tableName, ...columns, ...columns.map(col => data[col])]
  const res = await promiseQuery(config, connection, sql, values)
  const packet = res as ResultSetHeader
  if (packet.affectedRows !== 1) {
    throw new MysqlException(
      `Insert failed，table：${table.tableName}，primary key: ${data[table.id]}`
    )
  }
  // 自动生成的id处理
  if (packet.insertId && (data[table.id] === undefined || data[table.id] === null)) {
    data[table.id] = packet.insertId as any
  }
  return data
}
/**
 * 一次插入多条记录
 * @param connection 连接
 * @param table 表
 * @param list 要插入的记录列表
 */
export async function insertMany<T>(
  config: MysqlConfig,
  connection: PoolConnection,
  table: Table<T>,
  list: T[]
): Promise<void> {
  if (!list.length) {
    return
  }
  // 列信息，使用 set 防止 columns 中重复配置 id 和更新创建时间列
  let columnsSet: Set<keyof T> = new Set()
  // 批量插入必须统一使用 id 或不使用 id，以第一条记录为准
  if (list[0][table.id]) {
    columnsSet.add(table.id)
  }
  table.columns.forEach(col => columnsSet.add(col))
  let createdData: Date | number | undefined = undefined
  if (table.createdDate) {
    createdData = table.createdDate.type === 'date' ? new Date() : new Date().getTime()
    columnsSet.add(table.createdDate.column)
  }
  let updatedDate: Date | number | undefined = undefined
  if (table.updatedDate) {
    updatedDate = table.updatedDate.type === 'date' ? new Date() : new Date().getTime()
    columnsSet.add(table.updatedDate.column)
  }
  const columns = Array.from(columnsSet)
  // 构建 sql
  let sql = `insert into ??(${columns.map(() => '??').join(',')}) values`
  const values: any[] = [table.tableName, ...columns]
  list.forEach((data, idx) => {
    if (idx > 0) {
      sql += ','
    }
    sql += `(${columns.map(() => '?').join(',')})`
    if (table.createdDate) {
      data[table.createdDate.column] = createdData as any
    }
    if (table.updatedDate) {
      data[table.updatedDate.column] = updatedDate as any
    }
    values.push(...columns.map(col => data[col]))
  })

  const res = await promiseQuery(config, connection, sql, values)
  const rsh = res as ResultSetHeader
  if (rsh.affectedRows !== list.length) {
    throw new MysqlException(
      `Insert many for table ${table.tableName} failed,expected to insert ${list.length} records, actually ${rsh.affectedRows}.`
    )
  }
  // insert 插入多条记录是不会返回生成的 id 的，所以就没有办法自动处理
}
