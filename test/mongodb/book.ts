import { MongoCollection } from '../../src'

/**
 * 书籍集合数据定义
 */
export interface Book {
  name: string
  categories: string[]
  createAt?: number
  updateAt?: number
}
// 用户信息
export const CollUser: MongoCollection<Book> = {
  collectionName: 'book',
  createdDate: {
    type: 'number',
    field: 'createAt'
  },
  updatedDate: {
    type: 'number',
    field: 'updateAt'
  }
}
