import { describe, expect, it } from 'vitest'
import { checkLength } from './checkLength'

describe('checkLength', () => {
  it('dataTypeがstring以外の場合はチェックしない', () => {
    expect(checkLength('12345678901', 'number', 5)).toEqual({ ok: true })
  })

  it('maxLength未指定の場合はチェックしない', () => {
    expect(checkLength('12345678901', 'string', undefined)).toEqual({ ok: true })
  })

  it('maxLength以内であれば通過する', () => {
    expect(checkLength('12345', 'string', 5)).toEqual({ ok: true })
  })

  it('maxLengthを超えるとエラーになる', () => {
    const result = checkLength('123456', 'string', 5)
    expect(result.ok).toBe(false)
    expect(result.message).toContain('5文字')
    expect(result.message).toContain('6文字')
  })
})
