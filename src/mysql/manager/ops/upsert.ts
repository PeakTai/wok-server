import { PoolConnection, ResultSetHeader } from 'mysql2'
import { MysqlConfig } from '../../config'
import { Table } from '../../table-info'
import { promiseQuery } from '../utils'
import { InsertValue, processInsertValue } from './insert'
import { Updater, updatorToSql } from './update'

/**
 * Upsert 单条数据
 * 如果主键冲突则更新，否则插入
 * @param config
 * @param connection
 * @param table
 * @param data
 * @returns
 */
export async function upsert<T>(
  config: MysqlConfig,
  connection: PoolConnection,
  table: Table<T>,
  data: InsertValue<T>
): Promise<T> {
  let columnsSet: Set<keyof T> = new Set()
  if (data[table.id]) {
    columnsSet.add(table.id)
  }
  table.columns.forEach(col => columnsSet.add(col))
  
  const now = new Date()
  const nowTimestamp = now.getTime()
  
  if (table.createdDate) {
    const createdData = table.createdDate.type === 'date' ? now : nowTimestamp
    data[table.createdDate.column] = createdData as any
    columnsSet.add(table.createdDate.column)
  }
  if (table.updatedDate) {
    const updatedDate = table.updatedDate.type === 'date' ? now : nowTimestamp
    data[table.updatedDate.column] = updatedDate as any
    columnsSet.add(table.updatedDate.column)
  }
  
  const columns = Array.from(columnsSet)
  
  // 构建 insert values
  const fragList: string[] = []
  const insertValues: any[] = []
  for (const col of columns) {
    const { frag, values: vs } = processInsertValue(data[col])
    fragList.push(frag)
    insertValues.push(...vs)
  }
  const insertSql = `insert into ??(${columns.map(() => '??').join(',')}) values(${fragList.join(',')})`
  
  // 构建 on duplicate key update（排除 id）
  const updateColumns = columns.filter(col => col !== table.id)
  const updateFragments: string[] = []
  const updateValues: any[] = []
  for (const col of updateColumns) {
    const { frag, values: vs } = processInsertValue(data[col])
    updateFragments.push(`?? = ${frag}`)
    updateValues.push(col, ...vs)
  }
  const updateSql = ` on duplicate key update ${updateFragments.join(',')}`
  
  const sql = insertSql + updateSql
  
  const values = [table.tableName, ...columns, ...insertValues, ...updateValues]
  
  const res = await promiseQuery(config, connection, sql, values)
  const packet = res as ResultSetHeader
  
  if (packet.insertId && (data[table.id] === undefined || data[table.id] === null)) {
    data[table.id] = packet.insertId as any
  }
  
  return data as unknown as T
}

/**
 * Upsert 多条数据
 * 如果主键冲突则更新，否则插入
 * @param config
 * @param connection
 * @param table
 * @param list
 * @returns 影响的行数
 */
export async function upsertMany<T>(
  config: MysqlConfig,
  connection: PoolConnection,
  table: Table<T>,
  list: InsertValue<T>[]
): Promise<number> {
  if (!list.length) {
    return 0
  }
  
  let columnsSet: Set<keyof T> = new Set()
  if (list[0][table.id]) {
    columnsSet.add(table.id)
  }
  table.columns.forEach(col => columnsSet.add(col))
  
  const now = new Date()
  const nowTimestamp = now.getTime()
  
  let createdData: Date | number | undefined = undefined
  if (table.createdDate) {
    createdData = table.createdDate.type === 'date' ? now : nowTimestamp
    columnsSet.add(table.createdDate.column)
  }
  let updatedDate: Date | number | undefined = undefined
  if (table.updatedDate) {
    updatedDate = table.updatedDate.type === 'date' ? now : nowTimestamp
    columnsSet.add(table.updatedDate.column)
  }
  
  const columns = Array.from(columnsSet)
  
  let sql = `insert into ??(${columns.map(() => '??').join(',')}) values`
  const values: any[] = [table.tableName, ...columns]
  
  list.forEach((data, idx) => {
    if (idx > 0) {
      sql += ','
    }
    const fragList: string[] = []
    const rowValues: any[] = []
    if (table.createdDate) {
      data[table.createdDate.column] = createdData as any
    }
    if (table.updatedDate) {
      data[table.updatedDate.column] = updatedDate as any
    }
    for (const col of columns) {
      const { frag, values: vs } = processInsertValue(data[col])
      fragList.push(frag)
      rowValues.push(...vs)
    }
    sql += `(${fragList.join(',')})`
    values.push(...rowValues)
  })
  
  const updateColumns = columns.filter(col => col !== table.id)
  sql += ` on duplicate key update ${updateColumns.map(() => '?? = values(??)').join(',')}`
  updateColumns.forEach(col => values.push(col, col))
  
  const res = await promiseQuery(config, connection, sql, values)
  const packet = res as ResultSetHeader
  
  return packet.affectedRows
}

/**
 * Upsert 单条数据（支持自定义更新器）
 * 如果主键冲突则按自定义逻辑更新，否则插入
 * @param config
 * @param connection
 * @param table
 * @param data 插入的数据
 * @param updater 冲突时的更新器
 * @returns
 */
export async function upsertWithUpdater<T>(
  config: MysqlConfig,
  connection: PoolConnection,
  table: Table<T>,
  data: InsertValue<T>,
  updater: Updater<T>
): Promise<T> {
  let columnsSet: Set<keyof T> = new Set()
  if (data[table.id]) {
    columnsSet.add(table.id)
  }
  table.columns.forEach(col => {
    if (data[col] !== undefined) {
      columnsSet.add(col)
    }
  })
  
  const now = new Date()
  const nowTimestamp = now.getTime()
  
  if (table.createdDate) {
    const createdData = table.createdDate.type === 'date' ? now : nowTimestamp
    data[table.createdDate.column] = createdData as any
    columnsSet.add(table.createdDate.column)
  }
  if (table.updatedDate) {
    const updatedDate = table.updatedDate.type === 'date' ? now : nowTimestamp
    data[table.updatedDate.column] = updatedDate as any
    columnsSet.add(table.updatedDate.column)
  }
  
  const columns = Array.from(columnsSet)
  
  // 构建 insert values
  const fragList: string[] = []
  const insertValues: any[] = []
  for (const col of columns) {
    const { frag, values: vs } = processInsertValue(data[col])
    fragList.push(frag)
    insertValues.push(...vs)
  }
  const insertSql = `insert into ??(${columns.map(() => '??').join(',')}) values(${fragList.join(',')})`
  
  const convertRes = updatorToSql(table, updater)
  
  const updateSql = ` on duplicate key update ${convertRes.sql}`
  
  const sql = insertSql + updateSql
  
  const values = [table.tableName, ...columns, ...insertValues, ...convertRes.values]
  
  const res = await promiseQuery(config, connection, sql, values)
  const packet = res as ResultSetHeader
  
  if (packet.insertId && (data[table.id] === undefined || data[table.id] === null)) {
    data[table.id] = packet.insertId as any
  }
  
  return data as unknown as T
}