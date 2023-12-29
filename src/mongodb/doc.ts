import { ObjectId } from 'mongodb'



/**
 * 文档 id
 */
export type MongoDocId = string | ObjectId
/**
 * 带 id 的文档。<T> 是自定义的集合类型，不包含主键字段。
 */
export type MongoDocWithId<T> = T & { _id: MongoDocId }
