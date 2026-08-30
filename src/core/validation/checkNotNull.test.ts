import { describe, expect, it } from 'vitest'
import { checkNotNull } from './checkNotNull'

describe('checkNotNull', () => {
  it('notNull=falseの場合は空値でも通過する', () => {
    expect(checkNotNull('', false)).toEqual({ ok: true })
  })

  it('notNull=trueの場合、空値はエラーになる', () => {
    const result = checkNotNull('', true)
    expect(result.ok).toBe(false)
    expect(result.message).toBe('必須項目です')
  })

  it('notNull=trueでも値があれば通過する', () => {
    expect(checkNotNull('値あり', true)).toEqual({ ok: true })
  })
})
