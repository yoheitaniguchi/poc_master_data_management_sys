import { describe, expect, it } from 'vitest'
import { checkConstants } from './checkConstants'

describe('checkConstants', () => {
  it('constants未指定の場合はチェックしない', () => {
    expect(checkConstants('任意の値', undefined)).toEqual({ ok: true })
  })

  it('空値はチェックしない（NotNullチェックの責務）', () => {
    expect(checkConstants('', ['完成品', '半製品'])).toEqual({ ok: true })
  })

  it('リストに含まれる値は通過する', () => {
    expect(checkConstants('完成品', ['完成品', '半製品', '原材料'])).toEqual({ ok: true })
  })

  it('リストに含まれない値はエラーになる（要求仕様書§5.5のサンプルと同じ文言）', () => {
    const result = checkConstants('資材', ['完成品', '半製品', '原材料'])
    expect(result.ok).toBe(false)
    expect(result.message).toBe('定数リストに含まれない値です: 資材')
  })
})
