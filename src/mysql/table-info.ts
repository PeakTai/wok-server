import { notBlank, ValidationOpts } from '../validation'

/**
 * 表信息. 表的字段分为三个部分：主键、普通列、时间列，分别对应的属性是：id、columns
 * 和 createDate 还有 updatedDate，这三部分配置的字段名称不允许有重叠，否则会产生错误.
 */
export interface Table<T> {
  /**
   * 表名.
   */
  tableName: string
  /**
   * id 字段名称.
   */
  id: keyof T
  /**
   * 列字段名称.只有配置了名称的字段才会参与数据库的查询与更新，没有配置的其它字段可作其它用途。
   * 注意：columns 配置的字段不能和 id 或更新时间和创建时间重叠，否则在更新时产生错误，将数据改错。
   * 程序本身是不会做检查的，编写的时候必须要注意。
   */
  columns: Array<keyof T>
  /**
   * 创建时间字段信息.
   */
  createdDate?: {
    column: keyof T
    type: 'number' | 'date'
  }
  /**
   * 更新时间字段信息.
   */
  updatedDate?: {
    column: keyof T
    type: 'number' | 'date'
  }
}

export const tableValidation: ValidationOpts<Table<any>> = {
  tableName: [notBlank('表名不能为空')],
  id: [notBlank('id 不能为空')]
}
