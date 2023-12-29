/**
 * mogodb 集合信息
 *
 * <T> 数据类型，不能包含有 _id 字段，主键字段名称固定，不可以设置
 */
export interface MongoCollection<T> {
  /**
   * 集合名称.
   */
  collectionName: string
  /**
   * 创建时间字段信息,设置后在创建时会自动更新该字段
   */
  createdDate?: {
    field: keyof T
    type: 'number' | 'date'
  }
  /**
   * 更新时间字段信息，设置后在更新记录时会自动维护该字段
   */
  updatedDate?: {
    field: keyof T
    type: 'number' | 'date'
  }
}
