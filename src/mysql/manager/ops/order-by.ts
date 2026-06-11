/**
 * 排序规则类型.
 *
 * T 为表类型.
 *
 * 普通列排序：
 *   [keyof T, 'asc' | 'desc']
 *   例: ['balance', 'asc']  →  ORDER BY `balance` asc
 *
 * 自定义表达式排序：
 *   ['expr', SQL片段, 参数值数组, 'asc' | 'desc']
 *   例: ['expr', '?? * ?', ['balance', 2], 'desc']
 *       →  ORDER BY `balance` * 2 desc
 *
 *   例: ['expr', 'CHAR_LENGTH(??)', ['name'], 'desc']
 *       →  ORDER BY CHAR_LENGTH(`name`) desc
 *
 *   例: ['expr', 'VECTOR_DISTANCE(??, STRING_TO_VECTOR(?))', ['content_vec', embedding], 'asc']
 *       →  ORDER BY VECTOR_DISTANCE(`content_vec`, STRING_TO_VECTOR(?)) asc
 *
 * 混合使用：
 *   [
 *     ['active', 'asc'],
 *     ['expr', '?? * ?', ['balance', 2], 'desc']
 *   ]
 *   →  ORDER BY `active` asc , `balance` * 2 desc
 */
export type OrderBy<T> = Array<
  | [keyof T, 'asc' | 'desc']
  | ['expr', string, any[], 'asc' | 'desc']
>

/**
 * 构建 ORDER BY 子句.
 *
 * @param orderBy 排序规则
 * @returns { sql: SQL 片段, values: 参数值数组 }
 */
export function buildOrderBy<T>(orderBy: OrderBy<T>): { sql: string; values: any[] } {
  const fragments: string[] = []
  const values: any[] = []

  orderBy.forEach((item, idx) => {
    const prefix = idx === 0 ? ' order by ' : ' , '

    if (item.length === 4 && item[0] === 'expr') {
      const [, exprSql, exprValues, sort] = item as ['expr', string, any[], 'asc' | 'desc']
      fragments.push(`${prefix}${exprSql} ${sort}`)
      values.push(...exprValues)
    } else {
      const [field, sort] = item as [keyof T, 'asc' | 'desc']
      fragments.push(`${prefix}?? ${sort}`)
      values.push(field)
    }
  })

  return { sql: fragments.join(''), values }
}
