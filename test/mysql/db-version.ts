import { Table } from '../../src'

export interface DbVersion {
  version: number
}

export const tableDbVersion: Table<DbVersion> = {
  tableName: 'db_version',
  id: 'version',
  columns: []
}
