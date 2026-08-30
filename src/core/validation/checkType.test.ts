import { describe, expect, it } from 'vitest'
import { checkType } from './checkType'

describe('checkType', () => {
  it('空値はどのdataTypeでも通過し、valueはnullになる（空値の可否はNotNullチェックの責務）', () => {
    expect(checkType('', 'string')).toEqual({ ok: true, value: null })
    expect(checkType('', 'number')).toEqual({ ok: true, value: null })
    expect(checkType('', 'boolean')).toEqual({ ok: true, value: null })
    expect(checkType('', 'date')).toEqual({ ok: true, value: null })
  })

  describe('string', () => {
    it('どんな文字列でも通過する', () => {
      expect(checkType('あいうえお', 'string')).toEqual({ ok: true, value: 'あいうえお' })
    })
  })

  describe('number', () => {
    it('数値文字列は変換されて通過する', () => {
      expect(checkType('123', 'number')).toEqual({ ok: true, value: 123 })
      expect(checkType('-1.5', 'number')).toEqual({ ok: true, value: -1.5 })
    })

    it('数値に変換できない文字列はエラーになる', () => {
      const result = checkType('abc', 'number')
      expect(result.ok).toBe(false)
      expect(result.message).toContain('abc')
    })

    it('空白のみの文字列は0に変換されず、エラーになる（Number()の空白トリム挙動対策）', () => {
      const result = checkType('   ', 'number')
      expect(result.ok).toBe(false)
    })
  })

  describe('boolean', () => {
    it('trueとfalseのみ通過する', () => {
      expect(checkType('true', 'boolean')).toEqual({ ok: true, value: true })
      expect(checkType('false', 'boolean')).toEqual({ ok: true, value: false })
    })

    it('true/false以外はエラーになる', () => {
      expect(checkType('TRUE', 'boolean').ok).toBe(false)
      expect(checkType('1', 'boolean').ok).toBe(false)
    })
  })

  describe('date', () => {
    it('解釈可能な日付文字列は通過する', () => {
      expect(checkType('2026-08-30', 'date')).toEqual({ ok: true, value: '2026-08-30' })
    })

    it('解釈できない文字列はエラーになる', () => {
      const result = checkType('not-a-date', 'date')
      expect(result.ok).toBe(false)
    })
  })
})
