import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import {
  CARRIER_SHEET_KEYS,
  readFreightWorkbook,
} from "./utils/readFreightWorkbook";
import type {
  CarrierSheetKey,
  FreightSheetKey,
  FreightWorkbookReadResult,
  FreightWorkbookTab,
  SpreadsheetCell,
} from "./utils/readFreightWorkbook";
import {
  getActiveFreightDatasets,
  getFreightDatasetHistory,
  saveFreightDatasetBatch,
} from "./lib/freightDatasets";
import type {
  FreightDatasetBatchEntry,
  FreightDatasetVersion,
} from "./lib/freightDatasets";
import "./FreightTables.css";

const WORKBOOK_SHEET_MARKER = "__FREIGHT_WORKBOOK_SHEET__";

const CARRIER_LABELS: Record<CarrierSheetKey, string> = {
  TABELA_VENKON: "Venkon",
  TABELA_RODONAVES: "Rodonaves",
  TABELA_FAVORITA: "Favorita",
  TABELA_RODOBRAS: "Rodobrás",
  TABELA_BRASIL_WEB: "Brasil Web",
  TABELA_MODULAR: "Modular",
  TABELA_ANEG: "ANEG",
};

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function cellToText(value: SpreadsheetCell | undefined): string {
  return String(value ?? "");
}

function normalizePreviewCell(value: SpreadsheetCell | undefined): string {
  return cellToText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function hasCell(normalizedCells: string[], expected: string): boolean {
  return normalizedCells.includes(expected);
}

function firstNonEmptyRowIndex(rows: SpreadsheetCell[][]): number {
  const index = rows.findIndex((row) =>
    row.some((cell) => cellToText(cell).trim() !== ""),
  );

  return index >= 0 ? index : 0;
}

function findPreviewStartIndex(
  sheet: FreightSheetKey | null,
  rows: SpreadsheetCell[][],
): number {
  if (!sheet) {
    return firstNonEmptyRowIndex(rows);
  }

  const headerIndex = rows.findIndex((row) => {
    const cells = row.map(normalizePreviewCell);

    switch (sheet) {
      case "BASE_MATERIAIS":
        return hasCell(cells, "MATERIAL") && hasCell(cells, "DESCRICAO");

      case "TABELA_VENKON":
      case "TABELA_FAVORITA":
      case "TABELA_RODOBRAS":
      case "TABELA_BRASIL_WEB":
        return (
          hasCell(cells, "UF") &&
          hasCell(cells, "DESTINO") &&
          cells.some((cell) => cell.includes("FAIXASDEPESO"))
        );

      case "TABELA_RODONAVES":
      case "TABELA_MODULAR":
        return (
          hasCell(cells, "UF") &&
          hasCell(cells, "DESTINO") &&
          cells.some((cell) => cell.includes("FRACIONADO"))
        );

      case "TABELA_ANEG":
        return hasCell(cells, "UF") && hasCell(cells, "DESTINO");

      case "TABELA_VENKON_TDE":
        return hasCell(cells, "CEPINICIAL") && hasCell(cells, "TAXATDE");

      case "TABELA_VENKON_ABR":
        return (
          hasCell(cells, "CEPINICIAL") &&
          hasCell(cells, "CEPFINAL") &&
          hasCell(cells, "LOCALIDADETABELAFRETE")
        );

      case "TABELA_RTE_PRAZOS":
        return (
          hasCell(cells, "MUNICIPIODESTINO") &&
          hasCell(cells, "UFDESTINO")
        );

      case "TABELA_ANEG_CIDADES":
        return (
          hasCell(cells, "UF") &&
          hasCell(cells, "DESCRICAOMUNICIPIO")
        );

      case "MATRIZ_UF_PRODUTO_ACABADO":
      case "MATRIZ_UF_PECAS":
        return hasCell(cells, "UF") && hasCell(cells, "ZONADETARIFA");

      case "TABELA_VENKON_GENERALIDADES":
        return cells.some((cell) => cell.includes("GENERAL"));

      default:
        return false;
    }
  });

  return headerIndex >= 0
    ? headerIndex
    : firstNonEmptyRowIndex(rows);
}

function countNonEmptyRows(rows: SpreadsheetCell[][]): number {
  return rows.filter((row) =>
    row.some((cell) => cellToText(cell).trim() !== ""),
  ).length;
}

function appendWorkbookTab(
  target: SpreadsheetCell[][],
  tab: FreightWorkbookTab,
): SpreadsheetCell[][] {
  return [
    ...target,
    [WORKBOOK_SHEET_MARKER, tab.name],
    ...tab.rows,
  ];
}

function buildDatasetBatch(
  workbook: Extract<FreightWorkbookReadResult, { success: true }>,
): FreightDatasetBatchEntry[] {
  const tabsByKey = new Map<FreightSheetKey, FreightWorkbookTab[]>();

  for (const tab of workbook.allSheets) {
    if (!tab.datasetKey) {
      continue;
    }

    const currentTabs = tabsByKey.get(tab.datasetKey) ?? [];
    currentTabs.push(tab);
    tabsByKey.set(tab.datasetKey, currentTabs);
  }

  if (tabsByKey.size === 0) {
    throw new Error("Nenhuma aba do arquivo foi associada a uma tabela.");
  }

  const datasetKeys = Array.from(tabsByKey.keys());

  const primaryKey =
    CARRIER_SHEET_KEYS.find((key) => tabsByKey.has(key)) ??
    datasetKeys[0];

  if (!primaryKey) {
    throw new Error("Não foi possível identificar a tabela principal.");
  }

  const entries: FreightDatasetBatchEntry[] = [];

  for (const [datasetKey, tabs] of tabsByKey) {
    const [firstTab, ...additionalTabs] = tabs;

    if (!firstTab) {
      continue;
    }

    let data = [...firstTab.rows];

    for (const tab of additionalTabs) {
      data = appendWorkbookTab(data, tab);
    }

    if (datasetKey === primaryKey) {
      const auxiliaryTabs = workbook.allSheets.filter(
        (tab) => tab.datasetKey === null,
      );

      for (const tab of auxiliaryTabs) {
        data = appendWorkbookTab(data, tab);
      }
    }

    if (data.length === 0) {
      throw new Error(`A aba "${firstTab.name}" não contém dados.`);
    }

    entries.push({
      datasetKey,
      data,
    });
  }

  return entries;
}

function isCarrierKey(key: FreightSheetKey): key is CarrierSheetKey {
  return (CARRIER_SHEET_KEYS as readonly string[]).includes(key);
}

function getStoredSheetCount(rows: SpreadsheetCell[][]): number {
  const additionalSheets = rows.filter(
    (row) => row[0] === WORKBOOK_SHEET_MARKER,
  ).length;

  return additionalSheets + 1;
}

export default function FreightTables() {
  const [workbook, setWorkbook] =
    useState<FreightWorkbookReadResult | null>(null);
  const [activeDatasets, setActiveDatasets] = useState<
    FreightDatasetVersion[]
  >([]);
  const [datasetHistory, setDatasetHistory] = useState<
    FreightDatasetVersion[]
  >([]);
  const [isLoadingTables, setIsLoadingTables] = useState(true);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadDatasets() {
      setIsLoadingTables(true);
      setErrorMessage("");

      try {
        const [active, history] = await Promise.all([
          getActiveFreightDatasets(),
          getFreightDatasetHistory(),
        ]);

        if (isMounted) {
          setActiveDatasets(active);
          setDatasetHistory(history);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar as tabelas de frete.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingTables(false);
        }
      }
    }

    void loadDatasets();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeByKey = new Map(
    activeDatasets.map((dataset) => [
      dataset.dataset_key,
      dataset,
    ]),
  );

  const historyByKey = new Map<FreightSheetKey, FreightDatasetVersion[]>();

  for (const version of datasetHistory) {
    const versions = historyByKey.get(version.dataset_key) ?? [];
    versions.push(version);
    historyByKey.set(version.dataset_key, versions);
  }

  async function handleFileChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    setWorkbook(null);
    setErrorMessage("");
    setSuccessMessage("");

    if (!file) {
      return;
    }

    setIsReadingFile(true);

    try {
      const result = await readFreightWorkbook(file);
      setWorkbook(result);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível ler o arquivo selecionado.",
      );
    } finally {
      setIsReadingFile(false);
      event.target.value = "";
    }
  }

  async function refreshDatasets() {
    const [active, history] = await Promise.all([
      getActiveFreightDatasets(),
      getFreightDatasetHistory(),
    ]);

    setActiveDatasets(active);
    setDatasetHistory(history);
  }

  async function handleSaveWorkbook() {
    if (!workbook?.success) {
      setErrorMessage("Selecione um arquivo Excel antes de salvar.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const batch = buildDatasetBatch(workbook);
      const savedVersions = await saveFreightDatasetBatch(
        workbook.fileName,
        batch,
      );

      await refreshDatasets();

      const carrierNames = Array.from(
        new Set(
          savedVersions.flatMap((version) =>
            isCarrierKey(version.dataset_key)
              ? [CARRIER_LABELS[version.dataset_key]]
              : [],
          ),
        ),
      );

      if (carrierNames.length > 0) {
        setSuccessMessage(
          `Arquivo importado. Tabelas atualizadas: ${carrierNames.join(", ")}. As abas auxiliares também foram salvas.`,
        );
      } else {
        setSuccessMessage(
          "Arquivo de apoio importado. Todas as abas reconhecidas foram salvas.",
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o arquivo completo.",
      );

      try {
        await refreshDatasets();
      } catch {
        // Mantém a mensagem principal do erro de gravação.
      }
    } finally {
      setIsSaving(false);
    }
  }

  function clearSelectedFile() {
    setWorkbook(null);
    setErrorMessage("");
    setSuccessMessage("");
  }

  return (
    <div className="freight-tables-page">
      <section className="freight-tables-card">
        <div className="freight-tables-card-heading">
          <div>
            <h2>Tabelas de frete</h2>
            <p>
              Selecione o arquivo completo da transportadora. O sistema
              lê as abas do arquivo e importa os dados juntos.
            </p>
          </div>

          <span className="freight-tables-admin-badge">
            Administração
          </span>
        </div>

        <div className="freight-tables-card-body">
          <label
            className="freight-tables-file-label"
            htmlFor="freight-workbook"
          >
            Arquivo Excel
          </label>

          <input
            id="freight-workbook"
            className="freight-tables-file-input"
            type="file"
            accept=".xlsx,.xlsm,.xls"
            onChange={(event) => void handleFileChange(event)}
            disabled={isReadingFile || isSaving}
          />

          <p className="freight-tables-help">
            Formatos aceitos: .xlsx, .xlsm e .xls. Selecione um arquivo
            por vez; não precisa separar as abas.
          </p>

          {isReadingFile && (
            <div className="freight-tables-info" role="status">
              Lendo todas as abas do arquivo…
            </div>
          )}

          {workbook && !workbook.success && (
            <div className="freight-tables-error" role="alert">
              <strong>Não foi possível usar este arquivo.</strong>
              <ul>
                {workbook.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {workbook?.success && (
            <div className="freight-tables-file-result">
              <div className="freight-tables-file-result-heading">
                <div>
                  <strong>{workbook.fileName}</strong>
                  <span>
                    {workbook.allSheets.length} aba(s) lida(s):{" "}
                    {workbook.foundSheetNames.join(", ")}
                  </span>
                </div>

                <button
                  type="button"
                  className="freight-tables-text-button"
                  onClick={clearSelectedFile}
                  disabled={isSaving}
                >
                  Remover arquivo
                </button>
              </div>

              {workbook.warnings.length > 0 && (
                <div className="freight-tables-warning">
                  <strong>Observações do arquivo</strong>
                  <ul>
                    {workbook.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="freight-tables-card-body">
                <h3>Prévia das abas lidas</h3>

                <div className="freight-tables-list">
                  {workbook.allSheets.map((tab, tabIndex) => {
                    const startIndex = findPreviewStartIndex(
                      tab.datasetKey,
                      tab.rows,
                    );
                    const previewRows = tab.rows.slice(
                      startIndex,
                      startIndex + 8,
                    );
                    const columnCount = Math.min(
                      16,
                      Math.max(0, ...previewRows.map((row) => row.length)),
                    );

                    return (
                      <details
                        className="freight-tables-version"
                        key={`${tab.name}-${tabIndex}`}
                      >
                        <summary>
                          <span className="freight-tables-version-name">
                            {tab.name}
                          </span>
                          <span className="freight-tables-version-status">
                            {countNonEmptyRows(tab.rows)} linha(s) com dados
                          </span>
                        </summary>

                        <div className="freight-tables-version-content">
                          <div className="freight-tables-preview-wrap">
                            <table className="freight-tables-preview">
                              <tbody>
                                {previewRows.map((row, rowIndex) => (
                                  <tr
                                    key={`${tab.name}-row-${startIndex + rowIndex}`}
                                  >
                                    {Array.from(
                                      { length: columnCount },
                                      (_, cellIndex) => {
                                        const cell = row[cellIndex];

                                        return (
                                          <td
                                            key={`${tab.name}-${rowIndex}-${cellIndex}`}
                                            title={cellToText(cell)}
                                          >
                                            {cellToText(cell) || "—"}
                                          </td>
                                        );
                                      },
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <p className="freight-tables-help">
                            Prévia a partir da linha {startIndex + 1},
                            limitada a 8 linhas e 16 colunas. A importação
                            salva os dados completos da aba.
                          </p>
                        </div>
                      </details>
                    );
                  })}
                </div>
              </div>

              <div className="freight-tables-save-row">
                <p>
                  Todas as abas deste arquivo serão salvas juntas. Se
                  ocorrer um erro, a importação não será ativada pela
                  metade.
                </p>

                <button
                  type="button"
                  className="freight-tables-save-button"
                  onClick={() => void handleSaveWorkbook()}
                  disabled={isSaving || workbook.allSheets.length === 0}
                >
                  {isSaving
                    ? "Importando arquivo…"
                    : "Importar arquivo completo"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {errorMessage && (
        <div className="freight-tables-error" role="alert">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="freight-tables-success" role="status">
          {successMessage}
        </div>
      )}

      <section className="freight-tables-card">
        <div className="freight-tables-card-heading">
          <div>
            <h2>Transportadoras cadastradas</h2>
            <p>Consulte a versão ativa e o histórico de cada tabela.</p>
          </div>
        </div>

        <div className="freight-tables-card-body">
          {isLoadingTables ? (
            <div className="freight-tables-info" role="status">
              Carregando as versões salvas…
            </div>
          ) : (
            <div className="freight-tables-list">
              {CARRIER_SHEET_KEYS.map((carrierKey) => {
                const active = activeByKey.get(carrierKey);
                const versions = historyByKey.get(carrierKey) ?? [];

                return (
                  <details
                    className="freight-tables-version"
                    key={carrierKey}
                  >
                    <summary>
                      <span className="freight-tables-version-name">
                        {CARRIER_LABELS[carrierKey]}
                      </span>

                      {active ? (
                        <span className="freight-tables-version-status">
                          Ativa · v{active.version_no}
                        </span>
                      ) : (
                        <span className="freight-tables-version-missing">
                          Ainda não cadastrada
                        </span>
                      )}
                    </summary>

                    <div className="freight-tables-version-content">
                      {active ? (
                        <dl>
                          <div>
                            <dt>Arquivo</dt>
                            <dd>{active.source_file_name}</dd>
                          </div>
                          <div>
                            <dt>Atualizada em</dt>
                            <dd>{formatDate(active.created_at)}</dd>
                          </div>
                          <div>
                            <dt>Abas armazenadas neste registro</dt>
                            <dd>{getStoredSheetCount(active.data)}</dd>
                          </div>
                        </dl>
                      ) : (
                        <p>
                          Nenhuma versão ativa foi encontrada para esta
                          transportadora.
                        </p>
                      )}

                      <h3>Histórico</h3>

                      {versions.length > 0 ? (
                        <ul className="freight-tables-history">
                          {versions.map((version) => (
                            <li key={version.id}>
                              <span>
                                v{version.version_no}
                                {version.is_active ? " · ativa" : ""}
                              </span>
                              <span>{version.source_file_name}</span>
                              <time dateTime={version.created_at}>
                                {formatDate(version.created_at)}
                              </time>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p>Não há versões anteriores registradas.</p>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}