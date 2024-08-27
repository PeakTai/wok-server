import { Table } from '../../src'

export interface User {
  id: string
  nickname: string
  balance: number
  active: boolean
  create_at?: Date
  update_at?: Date
}

export const tableUser: Table<User> = {
  tableName: 'user',
  id: 'id',
  columns: ['nickname', 'balance', 'active'],
  createdDate: {
    column: 'create_at',
    type: 'date'
  },
  updatedDate: {
    column: 'update_at',
    type: 'date'
  }
}
