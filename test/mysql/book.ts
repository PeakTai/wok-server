import { Table } from '../../src'

export interface Book {
  /**
   * id，自增长，将 id 设置为可选，插入时不填
   */
  id?: number
  author_id?: string
  name: string
  create_at?: number
  update_at?: number
}

export const tableBook: Table<Book> = {
  tableName: 'book',
  id: 'id',
  columns: ['name', 'author_id'],
  createdDate: {
    type: 'number',
    column: 'create_at'
  },
  updatedDate: {
    type: 'number',
    column: 'update_at'
  }
}
