import type { TableDefinition } from '../schema/types'

// docs/design.md §4.3のバージョン管理方針: 全テーブル定義JSONを結合・シリアライズした
// 文字列から簡易ハッシュ値を算出する。暗号学的な強度は不要（衝突しても実害はデータ再作成の
// トリガーが増えるだけ）なため、djb2アルゴリズムで十分とする。
export function computeDefinitionsHash(definitions: TableDefinition[]): string {
  const sorted = [...definitions].sort((a, b) => a.tableId.localeCompare(b.tableId))
  const serialized = JSON.stringify(sorted)

  let hash = 5381
  for (let i = 0; i < serialized.length; i++) {
    hash = (hash * 33) ^ serialized.charCodeAt(i)
  }
  return (hash >>> 0).toString(16)
}
