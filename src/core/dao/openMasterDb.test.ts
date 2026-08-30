import { deleteDB } from 'idb'
import { afterEach, describe, expect, it } from 'vitest'
import { DB_NAME, IMPORT_LOG_STORE, openMasterDb } from './openMasterDb'
import { createMemoryStorage } from '../../test/memoryStorage'
import type { TableDefinition } from '../schema/types'

const itemDef: TableDefinition = {
  tableId: 'm_item',
  tableName: '品目マスタ',
  columns: [
    {
      columnId: 'item_code',
      columnName: '品目コード',
      dataType: 'string',
      maxLength: 20,
      notNull: true,
      unique: true,
      primaryKey: true,
    },
    {
      columnId: 'item_name',
      columnName: '品目名',
      dataType: 'string',
      maxLength: 100,
      notNull: true,
      unique: false,
    },
  ],
}

const partnerDef: TableDefinition = {
  tableId: 'm_partner',
  tableName: '取引先マスタ',
  columns: [
    {
      columnId: 'partner_code',
      columnName: '取引先コード',
      dataType: 'string',
      maxLength: 20,
      notNull: true,
      unique: true,
      primaryKey: true,
    },
  ],
}

afterEach(async () => {
  await deleteDB(DB_NAME)
})

describe('openMasterDb', () => {
  it('テーブル定義ごとにprimaryKeyをkeyPathとするオブジェクトストアとimport_logsストアを作成する', async () => {
    const db = await openMasterDb([itemDef, partnerDef], { storage: createMemoryStorage() })

    expect(Array.from(db.objectStoreNames).sort()).toEqual(
      ['import_logs', 'm_item', 'm_partner'].sort(),
    )
    const tx = db.transaction(['m_item', 'm_partner', IMPORT_LOG_STORE])
    expect(tx.objectStore('m_item').keyPath).toBe('item_code')
    expect(tx.objectStore('m_partner').keyPath).toBe('partner_code')
    expect(tx.objectStore(IMPORT_LOG_STORE).keyPath).toBe('importId')
    db.close()
  })

  it('定義ハッシュが変わらない再起動では既存データを保持する', async () => {
    const storage = createMemoryStorage()
    const db1 = await openMasterDb([itemDef], { storage })
    await db1.put('m_item', { item_code: 'A001', item_name: 'テスト品目' })
    db1.close()

    const db2 = await openMasterDb([itemDef], { storage })
    const record = await db2.get('m_item', 'A001')
    expect(record).toEqual({ item_code: 'A001', item_name: 'テスト品目' })
    db2.close()
  })

  it('定義ハッシュが変わる再起動では既存データを削除して再作成する（docs/design.md §4.3）', async () => {
    const storage = createMemoryStorage()
    const db1 = await openMasterDb([itemDef], { storage })
    await db1.put('m_item', { item_code: 'A001', item_name: 'テスト品目' })
    db1.close()

    const db2 = await openMasterDb([itemDef, partnerDef], { storage })
    expect(Array.from(db2.objectStoreNames).sort()).toEqual(
      ['import_logs', 'm_item', 'm_partner'].sort(),
    )
    const record = await db2.get('m_item', 'A001')
    expect(record).toBeUndefined()
    db2.close()
  })

  it('テーブル構成は同じでもmaxLength等の値のみが変わればデータを削除して再作成する（EFFECT-2）', async () => {
    const storage = createMemoryStorage()
    const db1 = await openMasterDb([itemDef], { storage })
    await db1.put('m_item', { item_code: 'A001', item_name: 'テスト品目' })
    db1.close()

    const itemDefWithWiderMaxLength: TableDefinition = {
      ...itemDef,
      columns: [itemDef.columns[0], { ...itemDef.columns[1], maxLength: 200 }],
    }
    const db2 = await openMasterDb([itemDefWithWiderMaxLength], { storage })
    const record = await db2.get('m_item', 'A001')
    expect(record).toBeUndefined()
    db2.close()
  })
})
