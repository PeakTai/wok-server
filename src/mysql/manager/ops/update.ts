import { PoolConnection, ResultSetHeader } from 'mysql2'
import { MysqlException } from '../../exception'
import { Table } from '../../table-info'
import { MixCriteria, buildQuery } from './criteria'
import { promiseQuery } from '../utils'
import { MysqlConfig } from '../../config'
import { processColumnValue } from './utils'

/**
 * 更新
 * @param config
 * @param connection
 * @param mapping
 * @param data
 * @returns
 */
export async function update<T>(
  config: MysqlConfig,
  connection: PoolConnection,
  table: Table<T>,
  data: T
): Promise<T> {
  // 列信息
  let columns: Array<keyof T> = [...table.columns]
  // 创建时间不更新
  if (table.createdDate) {
    const { column } = table.createdDate
    columns = columns.filter(col => col !== column)
  }
  if (table.updatedDate) {
    const updatedDate = table.updatedDate.type === 'date' ? new Date() : new Date().getTime()
    data[table.updatedDate.column] = updatedDate as any
    columns.push(table.updatedDate.column)
  }
  // 构建 sql
  const sql = `update ?? set ${columns.map(() => ' ?? = ? ').join(',')} where ?? = ?`
  // 值
  const values: any[] = [
    table.tableName,
    ...columns.flatMap(col => [col, processColumnValue(data[col])]),
    table.id,
    data[table.id]
  ]
  const res = await promiseQuery(config, connection, sql, values)
  const packet = res as ResultSetHeader
  if (packet.affectedRows !== 1) {
    throw new MysqlException(
      `Failed to update record, possibly due to non-existent record，table：${
        table.tableName
      }，primary key: ${data[table.id]}`
    )
  }
  return data
}
/**
 * 更新器
 */
export type Updater<T> = Partial<{
  // 普通的更新赋值
  [key in keyof T]:
    | T[key]
    // undefined 表示不参与更新，作用是方便编写一些特殊的逻辑，比如特定情况下不更新
    | undefined
    // 将字段置空，置空是不能使用 null 类型的，必须使用元组 ['setNull']
    | ['setNull']
    // 将字段自增
    | ['inc', number]
    /**
     * 设置一个字段的值，和直接赋值是一样的，作用是解决一些特殊的情况的冲突
     * 比如将 json 字段的值设置为 ['setNull'] ,这就会被认为是要置空，
     * 使用 ['set',['setNull']] 就可以解决这个问题
     */
    | ['set', T[key]]
}>
/**
 * 转换更新器
 * @param table
 * @param updater
 * @returns
 */
function updatorToSql<T>(table: Table<T>, updater: Updater<T>): { sql: string; values: any[] } {
  const values: any[] = []
  // 更新操作
  const updateFragList: string[] = []
  // 更新时间
  if (table.updatedDate) {
    const updatedDate = table.updatedDate.type === 'date' ? new Date() : new Date().getTime()
    updateFragList.push(' ?? = ?')
    values.push(table.updatedDate.column, updatedDate)
  }
  for (const column in updater) {
    // 过滤掉id
    if (column === table.id) {
      continue
    }
    const val = updater[column]
    // undefined 表示不参与更新，作用是方便编写一些特殊的逻辑，比如特定情况下不更新
    if (val === undefined) {
      continue
    }
    // 兼容将值设置成 null 的情况，和 ['setNull’] 等同
    if (val === null) {
      updateFragList.push(' ?? = NULL ')
      values.push(column)
      continue
    }
    if (Array.isArray(val)) {
      // set null
      if (val[0] === 'setNull') {
        updateFragList.push(' ?? = NULL ')
        values.push(column)
        continue
      }
      if (val[0] === 'inc') {
        updateFragList.push(' ?? = ?? + ? ')
        values.push(column, column, val[1])
        continue
      }
      if (val[0] === 'set') {
        updateFragList.push(' ?? = ? ')
        values.push(column, processColumnValue(val[1]))
        continue
      }
    }
    updateFragList.push(' ?? = ? ')
    values.push(column, processColumnValue(val))
  }
  return { sql: updateFragList.join(','), values }
}

/**
 * 部分更新
 * @param connection
 * @param mapping
 * @param type
 * @param data
 */
export async function partialUpdate<T>(
  config: MysqlConfig,
  connection: PoolConnection,
  table: Table<T>,
  data: Updater<T>
): Promise<boolean> {
  if (!data[table.id]) {
    throw new MysqlException(
      `Can't do a partial update, the data to be updated does not contain a primary key，table: ${
        table.tableName
      }，column：${JSON.stringify(data)}`
    )
  }
  const id = data[table.id]
  if (typeof id !== 'string' && typeof id !== 'number') {
    throw new MysqlException('Primary key can only be of string or number type')
  }
  if (Object.keys(data).length < 2) {
    throw new MysqlException(
      `Can't do a partial update, data must contain at least one column outside of the primary key，table: ${
        table.tableName
      }，column：${JSON.stringify(data)}`
    )
  }
  const fieldNames = Object.keys(data)
  for (const name of fieldNames) {
    if (name !== table.id && !table.columns.some(col => col === name)) {
      throw new MysqlException(
        `Can't do a partial update，there are unconfigured columns in the data，table： ${table.tableName}，unconfigured column：${name}`
      )
    }
  }
  let sql = ` update ?? `
  const values: any[] = [table.tableName]
  // 更新操作
  const convertRes = updatorToSql(table, data)
  if (!convertRes.sql) {
    throw new MysqlException('No fields were specified to be updated!')
  }
  values.push(...convertRes.values)
  sql += ` set ${convertRes.sql} where ?? = ?`
  values.push(table.id, id)

  const res = await promiseQuery(config, connection, sql, values)
  const packet = res as ResultSetHeader
  return packet.affectedRows === 1
}
/**
 * 更新指定的一条记录
 * @param config
 * @param connection
 * @param table
 * @param query
 * @param data
 */
export async function updateOne<T>(
  config: MysqlConfig,
  connection: PoolConnection,
  table: Table<T>,
  query: Partial<T>,
  updater: Updater<T>
): Promise<boolean> {
  const values: any[] = []
  const mysqlQuery = buildQuery(query)
  if (!mysqlQuery) {
    throw new MysqlException('No valid criteria specified.')
  }
  let sql = ` update ?? `
  values.push(table.tableName)
  // 更新操作
  const convertRes = updatorToSql(table, updater)
  if (!convertRes.sql) {
    throw new MysqlException('No fields were specified to be updated!')
  }
  sql += ` set ${convertRes.sql} `
  values.push(...convertRes.values)
  sql += ` where ${mysqlQuery.sql} limit 1`
  values.push(...mysqlQuery.values)
  const res = await promiseQuery(config, connection, sql, values)
  const packet = res as ResultSetHeader
  return packet.affectedRows === 1
}
/**
 * 更新选项
 */
export interface UpdateOpts<T> {
  /**
   * 表
   */
  table: Table<T>
  /**
   * 查询条件
   */
  query: MixCriteria<T>
  /**
   * 限制数量
   */
  limit?: number
  /**
   * 排序规则，按先后顺序放入，每个规则是一个元组，第一个元素是字段名称，第二个元素是顺序
   */
  orderBy?: Array<[keyof T, 'asc' | 'desc']>
  /**
   * 更新设置
   */
  updater: Updater<T>
}

/**
 * 更新所有匹配条件的记录
 * @param config
 * @param connection 连接
 * @param table 表
 * @param query 查询条件
 * @param updater 更新操作，支持置空和递增（需要使用元组）
 */
export async function updateMany<T>(
  config: MysqlConfig,
  connection: PoolConnection,
  opts: UpdateOpts<T>
): Promise<number> {
  const values: any[] = []
  const mysqlQuery = buildQuery(opts.query)
  if (!mysqlQuery) {
    throw new MysqlException('No valid criteria specified.')
  }
  let sql = ` update ?? `
  values.push(opts.table.tableName)
  // 更新操作
  const convertRes = updatorToSql(opts.table, opts.updater)
  if (!convertRes.sql) {
    throw new MysqlException('No fields were specified to be updated!')
  }
  sql += ` set ${convertRes.sql} `
  values.push(...convertRes.values)
  sql += ` where ${mysqlQuery.sql} `
  values.push(...mysqlQuery.values)
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
  const packet = res as ResultSetHeader
  return packet.affectedRows
}
