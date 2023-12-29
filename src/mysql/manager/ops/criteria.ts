import { MysqlException } from '../../exception'

export interface MysqlQuery {
  sql: string
  values: any[]
}

/**
 * mysql 查询条件（ query criterion ），默认查询条件都是并且关系（and）， 部分方法会有例外，在使用的时候请注意方法说明。
 *
 * @param <T> 表类型
 */
export class MysqlCriteria<T> {
  /**
   * 条件列表.
   */
  private criteria: Criterion<T>[] = []
  /**
   * 相等.
   * @param column
   * @param value
   */
  eq(column: keyof T, value: any) {
    this.criteria.push({ type: 'eq', columnName: column, value })
    return this
  }
  /**
   * 不等于，注意不相等不能走索引，谨慎使用
   * @param column
   * @param value
   */
  neq(column: keyof T, value: any) {
    this.criteria.push({ type: 'neq', columnName: column, value })
    return this
  }
  /**
   * like
   * @param column
   * @param value
   * @returns
   */
  like(column: keyof T, value: string) {
    this.criteria.push({ type: 'like', columnName: column, value })
    return this
  }
  /**
   * not like
   * @param column
   * @param value
   * @returns
   */
  notLike(column: keyof T, value: string) {
    this.criteria.push({ type: 'notLike', columnName: column, value })
    return this
  }
  /**
   * BETWEEN x and y
   */
  between(column: keyof T, min: number, max: number) {
    this.criteria.push({ type: 'between', columnName: column, value: [min, max] })
    return this
  }
  /**
   * 大于
   * @param column
   * @param value
   */
  gt(column: keyof T, value: number | Date | string) {
    this.criteria.push({ type: 'gt', columnName: column, value })
    return this
  }
  /**
   * 大于等于
   * @param column
   * @param value
   */
  gte(column: keyof T, value: number | Date | string) {
    this.criteria.push({ type: 'gte', columnName: column, value })
    return this
  }
  /**
   * 小于
   * @param column
   * @param value
   */
  lt(column: keyof T, value: number | Date | string) {
    this.criteria.push({ type: 'lt', columnName: column, value })
    return this
  }
  /**
   * 小于等于
   * @param column
   * @param value
   */
  lte(column: keyof T, value: number | Date | string) {
    this.criteria.push({ type: 'lte', columnName: column, value })
    return this
  }
  /**
   * in 条件
   * @param column
   * @param values
   */
  in(column: keyof T, values: Array<string | number>) {
    this.criteria.push({ type: 'in', columnName: column, value: values })
    return this
  }
  /**
   * 嵌入其它的查询条件，与现有的查询条件是或者关系.
   * @param criteria
   */
  or(orCriteria: (criteria: MysqlCriteria<T>) => void) {
    const criteria = new MysqlCriteria<T>()
    orCriteria(criteria)
    this.criteria.push({ type: 'or', criteria })
    return this
  }
  /**
   * 嵌入其它的查询条件，与现有的查询条件是并且关系.
   * @param criteria
   */
  and(andCriteria: (criteria: MysqlCriteria<T>) => void) {
    const criteria = new MysqlCriteria<T>()
    andCriteria(criteria)
    this.criteria.push({ type: 'and', criteria })
    return this
  }
  /**
   * 字段为空
   * @param field
   * @returns
   */
  isNull(field: keyof T) {
    this.criteria.push({ type: 'isNull', columnName: field })
    return this
  }
  /**
   * 字段非空
   * @param field
   * @returns
   */
  isNotNull(field: keyof T) {
    this.criteria.push({ type: 'isNotNull', columnName: field })
    return this
  }
  /**
   * 判定是否空，未设置条件.
   * @returns
   */
  isEmpty() {
    return !this.criteria.length
  }
  /**
   * 检查条件信息是否有效，在出错时能给予较详细的提示，以方便排查.
   */
  check() {
    for (const criterion of this.criteria) {
      if (criterion.type === 'or' || criterion.type === 'and') {
        if (!criterion.criteria) {
          throw new MysqlException(`${criterion.type} clause cannot be empty`)
        }
        criterion.criteria.check()
        continue
      }
      if (!criterion.columnName) {
        throw new MysqlException('The column name of the query criteria cannot be blank.')
      }
      if (criterion.type === 'isNull' || criterion.type === 'isNotNull') {
        continue
      }
      if (criterion.type === 'in') {
        if (!Array.isArray(criterion.value)) {
          throw new MysqlException(
            `Invalid in condition，the condition value is not a array type，column name：${criterion.columnName.toString()}`
          )
        }
        if (!criterion.value.length) {
          throw new MysqlException(
            `Invalid in condition，the condition value cannot be an empty array，column name：${criterion.columnName.toString()}`
          )
        }
        continue
      }
      if (criterion.type === 'between') {
        if (!Array.isArray(criterion.value)) {
          throw new MysqlException(
            `Invalid between condition，the condition value is not an array type，column name：${criterion.columnName.toString()}, value:${
              criterion.value
            }`
          )
        }
        if (criterion.value.length !== 2) {
          throw new MysqlException(
            `Invalid between condition，the condition value must be an array of length 2，column: ${criterion.columnName.toString()}，value：${
              criterion.value.length
            }`
          )
        }
        continue
      }
      if (
        typeof criterion.value !== 'number' &&
        typeof criterion.value !== 'string' &&
        !(criterion.value instanceof Date)
      ) {
        throw new MysqlException(
          'The value of the query criteria is invalid，only number,string and Date are supported，' +
            `column name : ${criterion.columnName.toString()}，value : ${criterion.value} .`
        )
      }
    }
  }

  /**
   * 生成查询数据
   */
  generateQuery(): MysqlQuery {
    this.check()
    const sqlFragments: string[] = []
    const values: any[] = []
    for (const criterion of this.criteria) {
      // 普通的查询
      if (criterion.columnName && criterion.value !== undefined) {
        // between 特殊处理
        if (criterion.type === 'between') {
          sqlFragments.push('and ?? between ? and ? ')
          values.push(criterion.columnName, criterion.value[0], criterion.value[1])
          continue
        }
        // 符号
        let sign = ''
        if (criterion.type === 'eq') {
          sign = '='
        } else if (criterion.type === 'neq') {
          sign = '!='
        } else if (criterion.type === 'gt') {
          sign = '>'
        } else if (criterion.type === 'gte') {
          sign = '>='
        } else if (criterion.type === 'lt') {
          sign = '<'
        } else if (criterion.type === 'lte') {
          sign = '<='
        } else if (criterion.type === 'in') {
          sign = 'in'
        } else if (criterion.type === 'like') {
          sign = 'like'
        } else if (criterion.type === 'notLike') {
          sign = 'not like'
        }
        if (sign) {
          if (criterion.type === 'in') {
            sqlFragments.push(`and ?? ${sign} (?) `)
          } else {
            sqlFragments.push(`and ?? ${sign} ? `)
          }
          values.push(criterion.columnName, criterion.value)
        }
        continue
      } else if (criterion.columnName) {
        if (criterion.type === 'isNull') {
          sqlFragments.push(`and ?? is null `)
          values.push(criterion.columnName)
          continue
        }
        if (criterion.type === 'isNotNull') {
          sqlFragments.push(`and ?? is not null `)
          values.push(criterion.columnName)
          continue
        }
      }
      // 特殊查询 or 和 and
      else if (criterion.criteria) {
        const query = criterion.criteria.generateQuery()
        if (criterion.type === 'or') {
          sqlFragments.push(`or (${query.sql}) `)
          values.push(...query.values)
          continue
        }
        if (criterion.type === 'and') {
          sqlFragments.push(`and (${query.sql}) `)
          values.push(...query.values)
          continue
        }
      }
    }
    if (!sqlFragments.length) {
      throw new MysqlException('No valid query criteria have been set.')
    }
    let sql = sqlFragments.join('')
    // 去除掉第一个条件的连接关键字，可能是 and 或 or
    if (sql.startsWith('and')) {
      sql = sql.substring(3)
    } else if (sql.startsWith('or')) {
      sql = sql.substring(2)
    }
    return { sql, values }
  }
}

interface Criterion<T> {
  type:
    | 'eq'
    | 'neq'
    | 'gt'
    | 'gte'
    | 'lt'
    | 'lte'
    | 'in'
    | 'or'
    | 'and'
    | 'like'
    | 'isNull'
    | 'isNotNull'
    | 'notLike'
    | 'between'
  columnName?: keyof T
  value?: any
  /**
   * 嵌套的其它查询， or 和 and  条件下有效
   */
  criteria?: MysqlCriteria<T>
}

function convertToCriteria<T>(example: Partial<T>): MysqlCriteria<keyof T> {
  const criteria = new MysqlCriteria<keyof T>()
  Object.entries(example as any).forEach(entry => {
    const [key, value] = entry
    criteria.eq(key as any, value)
  })
  return criteria
}
/**
 * 混合的查询对象.
 */
export type MixCriteria<T> = Partial<T> | ((criteria: MysqlCriteria<T>) => void) | MysqlCriteria<T>

/**
 * 将混合的查询条件转换成查询语句，如果最终构建的条件是空的，返回 undefined
 * @param criteria
 * @returns
 */
export function buildQuery<T>(criteria: MixCriteria<T>): MysqlQuery | undefined {
  if (criteria instanceof Function) {
    const c = new MysqlCriteria<T>()
    criteria(c)
    if (!c.isEmpty()) {
      return c.generateQuery()
    }
  } else if (criteria instanceof MysqlCriteria) {
    if (!criteria.isEmpty()) {
      return criteria.generateQuery()
    }
  } else {
    const c = convertToCriteria<T>(criteria)
    if (!c.isEmpty()) {
      return c.generateQuery()
    }
  }
  return undefined
}
