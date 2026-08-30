import { describe, expect, it } from 'vitest'
import { checkUnique, type UniqueCheckContext } from './checkUnique'

const emptyContext: UniqueCheckContext = { seenInFile: new Set(), existingValues: new Set() }

describe('checkUnique', () => {
  it('unique=falseの場合はチェックしない', () => {
    expect(checkUnique('A001', false, emptyContext)).toEqual({ ok: true })
  })

  it('null（空値）はチェックしない', () => {
    expect(checkUnique(null, true, emptyContext)).toEqual({ ok: true })
  })

  it('重複がなければ通過する', () => {
    expect(checkUnique('A001', true, emptyContext)).toEqual({ ok: true })
  })

  it('CSVファイル内での重複はエラーになる', () => {
    const context: UniqueCheckContext = { seenInFile: new Set(['A001']), existingValues: new Set() }
    const result = checkUnique('A001', true, context)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('CSVファイル内')
  })

  it('IndexedDB内の既存データとの重複はエラーになる', () => {
    const context: UniqueCheckContext = { seenInFile: new Set(), existingValues: new Set(['A001']) }
    const result = checkUnique('A001', true, context)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('既存データ')
  })

  it('primaryKeyカラムでtreatExistingMatchAsUpsert=trueの場合、既存データとの一致はエラーにしない（Upsert対象）', () => {
    const context: UniqueCheckContext = { seenInFile: new Set(), existingValues: new Set(['A001']) }
    expect(
      checkUnique('A001', true, context, { treatExistingMatchAsUpsert: true }),
    ).toEqual({ ok: true })
  })

  it('treatExistingMatchAsUpsert=trueでも、CSVファイル内での重複は引き続きエラーになる', () => {
    const context: UniqueCheckContext = { seenInFile: new Set(['A001']), existingValues: new Set() }
    const result = checkUnique('A001', true, context, { treatExistingMatchAsUpsert: true })
    expect(result.ok).toBe(false)
    expect(result.message).toContain('CSVファイル内')
  })
})
