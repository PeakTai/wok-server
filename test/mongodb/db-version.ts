import { MongoCollection } from '../../src'

export interface DbVersion {
  version: number
}

export const collDbVersion: MongoCollection<DbVersion> = {
  collectionName: 'db_version'
}
