import type { TableDefinition } from '../schema/types'
import type { ExportDefinition, ExportDefinitionIndex } from './types'
import { validateExportDefinition, type ExportDefinitionValidationError } from './validateExportDefinition'

export interface LoadExportDefinitionsOptions {
  basePath?: string
  fetchImpl?: typeof fetch
  tableDefinitions: TableDefinition[]
}

export interface LoadExportDefinitionsResult {
  definitions: ExportDefinition[]
  errors: ExportDefinitionValidationError[]
}

// DO-8: table-definitions/と同様、export-definitions/index.jsonのexportId一覧を手掛かりに
// 各連携ファイル定義JSONを個別にfetchする（docs/design.md §4.6）。連携ファイル作成機能は
// DO-6/DO-7（検索・出力）に対する付加機能であり、マニフェスト自体が存在しない・取得できない
// 場合でもアプリ全体の起動は妨げない（空の一覧として扱う）方針とした。
export async function loadExportDefinitions(
  options: LoadExportDefinitionsOptions,
): Promise<LoadExportDefinitionsResult> {
  const basePath = options.basePath ?? '/'
  const fetchImpl = options.fetchImpl ?? fetch
  const definitionUrl = (fileName: string) => `${basePath}export-definitions/${fileName}`

  const indexResponse = await fetchImpl(definitionUrl('index.json'))
  if (!indexResponse.ok) {
    return {
      definitions: [],
      errors: [
        {
          exportId: '(index)',
          message: `export-definitions/index.jsonの取得に失敗しました（status: ${indexResponse.status}）`,
        },
      ],
    }
  }
  const index = (await indexResponse.json()) as ExportDefinitionIndex

  const definitions: ExportDefinition[] = []
  const errors: ExportDefinitionValidationError[] = []

  for (const exportId of index.exportIds) {
    const response = await fetchImpl(definitionUrl(`${exportId}.json`))
    if (!response.ok) {
      errors.push({ exportId, message: `定義JSONの取得に失敗しました（status: ${response.status}）` })
      continue
    }

    const definition = (await response.json()) as ExportDefinition
    const definitionErrors = validateExportDefinition(definition, options.tableDefinitions)
    if (definitionErrors.length > 0) {
      errors.push(...definitionErrors)
      continue
    }
    definitions.push(definition)
  }

  return { definitions, errors }
}
