import { Table } from '../../src'

export interface User {
  id: string
  nickname: string
  balance: number
  active: boolean
  last_login_at?: Date
  create_at?: Date
  update_at?: Date
}

export const tableUser: Table<User> = {
  tableName: 'user',
  id: 'id',
  columns: ['nickname', 'balance', 'active', 'last_login_at'],
  createdDate: {
    column: 'create_at',
    type: 'date'
  },
  updatedDate: {
    column: 'update_at',
    type: 'date'
  }
}
