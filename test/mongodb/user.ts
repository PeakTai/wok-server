import { MongoCollection } from '../../src'

/**
 * 用户集合数据定义
 */
export interface User {
  nickname: string
  skills?: string[]
  age?: number
  createAt?: Date
  updateAt?: Date
}
// 用户信息
export const collUser: MongoCollection<User> = {
  collectionName: 'user',
  createdDate: {
    type: 'date',
    field: 'createAt'
  },
  updatedDate: {
    type: 'date',
    field: 'updateAt'
  }
}
