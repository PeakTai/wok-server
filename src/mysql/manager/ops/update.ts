import { PoolConnection, ResultSetHeader } from 'mysql2'
import { MysqlException } from '../../exception'
import { Table } from '../../table-info'
import { MixCriteria, buildQuery } from './criteria'
import { promiseQuery } from '../utils'
import { MysqlConfig } from '../../config'
import { processColumnValue } from './utils'
import { OrderBy, buildOrderBy } from './order-by'

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
    // 字段自增 +1，等价于 ['inc', 1]
    | ['inc']
    // 字段自增指定值
    | ['inc', number]
    // NOW() 快捷方式，等价于 ['expr', 'NOW()', []]
    | ['now']
    /**
     * 设置一个字段的值，和直接赋值是一样的，作用是解决一些特殊的情况的冲突
     * 比如将 json 字段的值设置为 ['setNull'] ,这就会被认为是要置空，
     * 使用 ['set',['setNull']] 就可以解决这个问题
     */
    | ['set', T[key]]
    /**
     * 字符串追加，如 ['concat', '/suffix'] 生成 col = CONCAT(IFNULL(col, ''), '/suffix')
     * NULL 安全：字段为 NULL 时视作空字符串
     */
    | ['concat', string]
    /**
     * 使用自定义表达式
     * 如 ['expr', '?? * ?', ['score', 2]] 生成 score = score * 2
     * 无参数时可省略第三个参数，如 ['expr', 'NOW()'] 等同 ['expr', 'NOW()', []]
     */
    | ['expr', string, any[]]
    | ['expr', string]
}>
/**
 * 转换更新器
 * @param table
 * @param updater
 * @param autoUpdateTime 是否自动添加更新时间
 * @returns
 */
export function updatorToSql<T>(table: Table<T>, updater: Updater<T>): { sql: string; values: any[] } {
  const values: any[] = []
  const updateFragList: string[] = []

  for (const column in updater) {
    // 过滤掉 id
    if (column === table.id) {
      continue
    }
    // 过滤掉 createdDate / updatedDate（自动处理）
    if ((table.createdDate && column === table.createdDate.column)
      || (table.updatedDate && column === table.updatedDate.column)) {
      continue
    }
    const val = updater[column]
    // undefined 表示不参与更新
    if (val === undefined) {
      continue
    }
    // 0.7.0 版本开始，null 和 undefined 一样被忽略更新
    // 如需设置字段为 NULL，请使用 ['setNull']
    if (val === null) {
      continue
    }
    if (Array.isArray(val)) {
      if (val[0] === 'setNull') {
        updateFragList.push(' ?? = NULL ')
        values.push(column)
        continue
      }
      if (val[0] === 'inc') {
        const incBy = val.length === 1 ? 1 : val[1]
        updateFragList.push(' ?? = ?? + ? ')
        values.push(column, column, incBy)
        continue
      }
      if (val[0] === 'now') {
        updateFragList.push(' ?? = NOW() ')
        values.push(column)
        continue
      }
      if (val[0] === 'set') {
        updateFragList.push(' ?? = ? ')
        values.push(column, processColumnValue(val[1]))
        continue
      }
      if (val[0] === 'concat') {
        updateFragList.push(' ?? = CONCAT(IFNULL(??, \'\'), ?) ')
        values.push(column, column, val[1])
        continue
      }
      if (val[0] === 'expr') {
        updateFragList.push(' ?? = ' + val[1] + ' ')
        values.push(column, ...(val[2] || []))
        continue
      }
    }
    updateFragList.push(' ?? = ? ')
    values.push(column, processColumnValue(val))
  }

  // 如果没有有效更新字段，抛出异常
  if (updateFragList.length === 0) {
    throw new MysqlException(
      `No effective fields to update (null values are ignored since v0.7.0), table: ${table.tableName}, updater: ${JSON.stringify(updater)}`
    )
  }

  // 自动添加更新时间
  if (table.updatedDate) {
    const updatedDate = table.updatedDate.type === 'date' ? new Date() : new Date().getTime()
    updateFragList.push(' ?? = ?')
    values.push(table.updatedDate.column, updatedDate)
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
  query: MixCriteria<T>,
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
  orderBy?: OrderBy<T>
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
  sql += ` set ${convertRes.sql} `
  values.push(...convertRes.values)
  sql += ` where ${mysqlQuery.sql} `
  values.push(...mysqlQuery.values)
  // 排序
  if (opts.orderBy && opts.orderBy.length) {
    const ob = buildOrderBy(opts.orderBy)
    sql += ob.sql
    values.push(...ob.values)
  }
  // 数量限制
  if (opts.limit) {
    sql += ` limit ${opts.limit} `
  }
  const res = await promiseQuery(config, connection, sql, values)
  const packet = res as ResultSetHeader
  return packet.affectedRows
}
