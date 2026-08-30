export type DataType = 'string' | 'number' | 'boolean' | 'date'

export interface ColumnDefinition {
  columnId: string
  columnName: string
  dataType: DataType
  maxLength?: number
  notNull: boolean
  unique: boolean
  primaryKey?: boolean
  constants?: string[]
}

export interface TableDefinition {
  tableId: string
  tableName: string
  columns: ColumnDefinition[]
}

export interface TableDefinitionIndex {
  tableIds: string[]
}
