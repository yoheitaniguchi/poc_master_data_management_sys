import type { TableDefinition, TableDefinitionIndex } from './types'
import { validateTableDefinition, type DefinitionValidationError } from './validateDefinition'

export interface LoadTableDefinitionsOptions {
  /** 定義JSON配信元のベースパス（末尾スラッシュ必須）。省略時は'/'（GitHub Pages配信時は import.meta.env.BASE_URL を渡す） */
  basePath?: string
  fetchImpl?: typeof fetch
}

export interface LoadTableDefinitionsResult {
  /** 定義エラーのないテーブル定義のみ（DAO生成の対象） */
  definitions: TableDefinition[]
  /** 取得失敗・定義エラーの一覧。該当テーブルはdefinitionsに含まれない */
  errors: DefinitionValidationError[]
}

// DO-1/DO-2: アプリ起動時にtable-definitions/*.jsonをfetchする。GitHub Pages配信では
// ディレクトリ一覧を取得できないため、table-definitions/index.jsonに列挙されたtableIdを
// 手掛かりに各定義JSONを個別にfetchする（マニフェストもJSONであり、コード修正は不要）。
export async function loadTableDefinitions(
  options: LoadTableDefinitionsOptions = {},
): Promise<LoadTableDefinitionsResult> {
  const basePath = options.basePath ?? '/'
  const fetchImpl = options.fetchImpl ?? fetch
  const definitionUrl = (fileName: string) => `${basePath}table-definitions/${fileName}`

  const indexResponse = await fetchImpl(definitionUrl('index.json'))
  if (!indexResponse.ok) {
    throw new Error(
      `table-definitions/index.jsonの取得に失敗しました（status: ${indexResponse.status}）`,
    )
  }
  const index = (await indexResponse.json()) as TableDefinitionIndex

  const definitions: TableDefinition[] = []
  const errors: DefinitionValidationError[] = []

  for (const tableId of index.tableIds) {
    const response = await fetchImpl(definitionUrl(`${tableId}.json`))
    if (!response.ok) {
      errors.push({
        tableId,
        message: `定義JSONの取得に失敗しました（status: ${response.status}）`,
      })
      continue
    }

    const definition = (await response.json()) as TableDefinition
    const definitionErrors = validateTableDefinition(definition)
    if (definitionErrors.length > 0) {
      errors.push(...definitionErrors)
      continue
    }
    definitions.push(definition)
  }

  return { definitions, errors }
}
