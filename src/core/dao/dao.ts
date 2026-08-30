import type { IDBPDatabase } from 'idb'
import type { MasterRecord, TableDefinition } from '../schema/types'

export type { MasterRecord, MasterRecordValue } from '../schema/types'

export interface MasterDao {
  readonly tableId: string
  findAll(): Promise<MasterRecord[]>
  findByKey(key: IDBValidKey): Promise<MasterRecord | undefined>
  /** 指定したカラムの値で検索する。string同士は部分一致、それ以外は完全一致。空欄条件は無視する */
  search(criteria: Partial<MasterRecord>): Promise<MasterRecord[]>
  /** 主キー一致時のみ更新、それ以外は新規追加（要求仕様書§5.2手順5・§5.3） */
  upsert(record: MasterRecord): Promise<void>
  count(): Promise<number>
}

// DO-2: テーブル定義1件につき1つ生成する汎用DAO。テーブル固有のコードは書かず、
// definitionのtableIdをオブジェクトストア名として全テーブル共通のロジックで操作する。
export function createMasterDao(db: IDBPDatabase, definition: TableDefinition): MasterDao {
  const { tableId } = definition

  return {
    tableId,
    findAll: () => db.getAll(tableId),
    findByKey: (key) => db.get(tableId, key),
    async search(criteria) {
      const conditions = Object.entries(criteria).filter(
        ([, value]) => value !== undefined && value !== '',
      )
      const all = (await db.getAll(tableId)) as MasterRecord[]
      if (conditions.length === 0) return all

      return all.filter((record) =>
        conditions.every(([columnId, value]) => {
          const recordValue = record[columnId]
          if (typeof value === 'string' && typeof recordValue === 'string') {
            return recordValue.includes(value)
          }
          return recordValue === value
        }),
      )
    },
    upsert: async (record) => {
      await db.put(tableId, record)
    },
    count: () => db.count(tableId),
  }
}
