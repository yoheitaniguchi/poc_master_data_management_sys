import type { TableDefinition } from './types'

export interface DefinitionValidationError {
  tableId: string
  message: string
}

// 要求仕様書§5.1「制約条件」: primaryKeyはちょうど1カラム、かつそのカラムに
// notNull=false/unique=falseを明示指定することはできない（自動的にtrue扱いのため矛盾する）。
export function validateTableDefinition(definition: TableDefinition): DefinitionValidationError[] {
  const errors: DefinitionValidationError[] = []
  const primaryKeyColumns = definition.columns.filter((column) => column.primaryKey === true)

  if (primaryKeyColumns.length !== 1) {
    errors.push({
      tableId: definition.tableId,
      message: `primaryKey=trueのカラムはちょうど1つ指定する必要があります（現在${primaryKeyColumns.length}件）`,
    })
  } else {
    const [primaryKeyColumn] = primaryKeyColumns
    if (primaryKeyColumn.notNull !== true) {
      errors.push({
        tableId: definition.tableId,
        message: `primaryKeyカラム「${primaryKeyColumn.columnId}」にnotNull=falseは指定できません`,
      })
    }
    if (primaryKeyColumn.unique !== true) {
      errors.push({
        tableId: definition.tableId,
        message: `primaryKeyカラム「${primaryKeyColumn.columnId}」にunique=falseは指定できません`,
      })
    }
  }

  const seenColumnIds = new Set<string>()
  for (const column of definition.columns) {
    if (seenColumnIds.has(column.columnId)) {
      errors.push({
        tableId: definition.tableId,
        message: `columnId「${column.columnId}」が重複しています`,
      })
    }
    seenColumnIds.add(column.columnId)
  }

  return errors
}
