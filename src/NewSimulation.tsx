  import { Fragment, useState } from "react";
import {
  REQUIRED_HEADERS,
  readShipments,
} from "./utils/readShipments";
import type { ShipmentReadResult } from "./utils/readShipments";
import { normalizeShipments } from "./utils/normalizeShipments";
import {
  calculateFreight,
  FREIGHT_CARRIERS,
} from "./utils/calculateFreight";
import type { FreightCalculationResult } from "./utils/calculateFreight";
import { getActiveFreightDatasets } from "./lib/freightDatasets";
import SimulationDecisions from "./SimulationDecisions";
import { createFreightSimulationRequestId } from "./lib/freightSimulations";
import type { SaveFreightSimulationInput } from "./lib/freightSimulations";
import "./NewSimulation.css";

const PAGE_SIZE = 25;

type ResultFilter = "opportunities" | "all" | "unquoted";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

function formatMoney(value: number | null): string {
  return value === null
    ? "Sem cotação"
    : currencyFormatter.format(value);
}

function formatPercent(value: number): string {
  return `${numberFormatter.format(value * 100)}%`;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

type PaginationProps = {
  page: number;
  total: number;
  onChange: (page: number) => void;
};

function Pagination({
  page,
  total,
  onChange,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const last = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="freight-pagination">
      <span aria-live="polite">
        {first}–{last} de {total} remessas
      </span>

      <div className="freight-pagination-controls">
        <button
          type="button"
          className="secondary-button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
        >
          Anterior
        </button>

        <span>
          Página {page} de {totalPages}
        </span>

        <button
          type="button"
          className="secondary-button"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}

export default function NewSimulation() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ShipmentReadResult | null>(null);

  const [calculation, setCalculation] =
    useState<FreightCalculationResult | null>(null);

  const [simulationToSave, setSimulationToSave] =
    useState<SaveFreightSimulationInput | null>(null);

  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationError, setCalculationError] = useState("");

  const [filter, setFilter] = useState<ResultFilter>("opportunities");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [inputPage, setInputPage] = useState(1);

  const [expandedShipment, setExpandedShipment] =
    useState<string | null>(null);

  const normalization =
    result?.success ? normalizeShipments(result.items) : null;

  const inputShipments =
    normalization?.success ? normalization.shipments : [];

  const calculatedShipments =
    calculation?.success ? calculation.shipments : [];

  const opportunities = calculatedShipments.filter(
    (shipment) => shipment.potentialSavings > 0,
  );

  const unquotedCount = calculatedShipments.filter(
    (shipment) => shipment.bestCost === null,
  ).length;

  const totalInvoiceValue = inputShipments.reduce(
    (total, shipment) => total + shipment.invoiceValue,
    0,
  );

  const totalQuantity = inputShipments.reduce(
    (total, shipment) => total + shipment.quantity,
    0,
  );

  const totalPotentialSavings = opportunities.reduce(
    (total, shipment) => total + shipment.potentialSavings,
    0,
  );

  const normalizedSearch = normalizeSearch(search);

  const filteredShipments = calculatedShipments
    .filter((shipment) => {
      if (
        filter === "opportunities" &&
        shipment.potentialSavings <= 0
      ) {
        return false;
      }

      if (
        filter === "unquoted" &&
        shipment.bestCost !== null
      ) {
        return false;
      }

      const searchableText = normalizeSearch(
        [
          shipment.shipment,
          shipment.city,
          shipment.uf,
          shipment.currentCarrier,
          shipment.bestCarrier ?? "",
        ].join(" "),
      );

      return searchableText.includes(normalizedSearch);
    })
    .sort(
      (a, b) =>
        b.potentialSavings - a.potentialSavings ||
        a.shipment.localeCompare(b.shipment),
    );

  const totalPages = Math.max(
    1,
    Math.ceil(filteredShipments.length / PAGE_SIZE),
  );

  const currentPage = Math.min(page, totalPages);

  const visibleShipments = filteredShipments.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const inputTotalPages = Math.max(
    1,
    Math.ceil(inputShipments.length / PAGE_SIZE),
  );

  const currentInputPage = Math.min(inputPage, inputTotalPages);

  const visibleInputShipments = inputShipments.slice(
    (currentInputPage - 1) * PAGE_SIZE,
    currentInputPage * PAGE_SIZE,
  );

  function resetResultsView() {
    setFilter("opportunities");
    setSearch("");
    setPage(1);
    setExpandedShipment(null);
  }

  function handleTextChange(value: string) {
    setText(value);
    setResult(null);
    setCalculation(null);
    setCalculationError("");
    setSimulationToSave(null);
    setInputPage(1);
    resetResultsView();
  }

  function handleCheck() {
    setResult(readShipments(text));
    setCalculation(null);
    setCalculationError("");
    setSimulationToSave(null);
    setInputPage(1);
    resetResultsView();
  }

  function handleClear() {
    handleTextChange("");
  }

  async function handleCalculateFreight() {
    if (!normalization?.success || isCalculating) {
      return;
    }

    setIsCalculating(true);
    setCalculation(null);
    setCalculationError("");
    setSimulationToSave(null);
    resetResultsView();

    try {
      const activeDatasets = await getActiveFreightDatasets();

      const freightResult = calculateFreight(
        normalization.shipments,
        activeDatasets,
      );

      setCalculation(freightResult);

      if (freightResult.success) {
        setSimulationToSave({
          requestId: createFreightSimulationRequestId(),
          sourceName: "Colagem do Excel",
          shipments: normalization.shipments,
          calculations: freightResult.shipments,
          activeDatasets,
        });
      }
    } catch (error) {
      setCalculationError(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar as tabelas de frete.",
      );
    } finally {
      setIsCalculating(false);
    }
  }

  function handleFilterChange(value: ResultFilter) {
    setFilter(value);
    setPage(1);
    setExpandedShipment(null);
  }

  function handlePageChange(value: number) {
    setPage(value);
    setExpandedShipment(null);
  }

  return (
    <div className="simulation-page">
      <section className="panel">
        <div className="panel-heading">
          <h2>Dados das remessas</h2>
          <span>Colagem do Excel</span>
        </div>

        <div className="simulation-body">
          <p className="simulation-instructions">
            Copie os cabeçalhos e as linhas do Excel e cole abaixo.
            As colunas podem estar em outra ordem.
          </p>

          <details className="simulation-columns">
            <summary>Ver as colunas obrigatórias</summary>

            <ol>
              {REQUIRED_HEADERS.map((header) => (
                <li key={header}>{header}</li>
              ))}
            </ol>
          </details>

          <label
            className="simulation-label"
            htmlFor="shipment-paste"
          >
            Cole os dados aqui
          </label>

          <textarea
            id="shipment-paste"
            className="simulation-input"
            value={text}
            onChange={(event) =>
              handleTextChange(event.target.value)
            }
            placeholder="Cole os cabeçalhos e as linhas copiadas do Excel..."
            spellCheck={false}
            disabled={isCalculating}
            aria-describedby="shipment-paste-help"
          />

          <p
            id="shipment-paste-help"
            className="simulation-help"
          >
            Após calcular, clique em “Salvar análise” para guardar os
            resultados. Dados ainda não salvos serão descartados ao
            sair ou atualizar a página.
          </p>

          <div className="simulation-actions">
            <button
              type="button"
              className="primary-button"
              onClick={handleCheck}
              disabled={!text.trim() || isCalculating}
            >
              Conferir dados
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={handleClear}
              disabled={(!text && !result) || isCalculating}
            >
              Limpar
            </button>
          </div>
        </div>
      </section>

      {result && !result.success && (
        <section className="simulation-errors" role="alert">
          <h2>Revise os dados colados</h2>

          <p>{result.errors.length} problema(s) encontrado(s).</p>

          <ul>
            {result.errors.slice(0, 30).map((error, index) => (
              <li key={`${index}-${error}`}>{error}</li>
            ))}
          </ul>

          {result.errors.length > 30 && (
            <p>Mostrando os primeiros 30 problemas.</p>
          )}
        </section>
      )}

      {normalization && !normalization.success && (
        <section className="simulation-errors" role="alert">
          <h2>Revise preços, quantidades e datas</h2>

          <ul>
            {normalization.errors
              .slice(0, 30)
              .map((error, index) => (
                <li key={`${index}-${error}`}>{error}</li>
              ))}
          </ul>

          {normalization.errors.length > 30 && (
            <p>Mostrando os primeiros 30 problemas.</p>
          )}
        </section>
      )}

      {normalization?.success && (
        <>
          <section
            className="simulation-summary"
            aria-label="Resumo das remessas"
          >
            <article>
              <span>Remessas distintas</span>
              <strong>{inputShipments.length}</strong>
            </article>

            <article>
              <span>Linhas de itens</span>
              <strong>{normalization.items.length}</strong>
            </article>

            <article>
              <span>Valor total das remessas</span>
              <strong>
                {currencyFormatter.format(totalInvoiceValue)}
              </strong>
            </article>
          </section>

          <div className="simulation-success">
            <p>
              Dados conferidos. Quantidade total:{" "}
              {totalQuantity.toLocaleString("pt-BR")}.
            </p>

            <p>
              O valor total soma o campo “Preço Crédito” de cada
              linha, sem multiplicá-lo novamente pela quantidade.
            </p>

            {normalization.warnings.length > 0 && (
              <details className="freight-notices">
                <summary>
                  Avisos da leitura ({normalization.warnings.length})
                </summary>

                <ul>
                  {normalization.warnings
                    .slice(0, 30)
                    .map((warning, index) => (
                      <li key={`${index}-${warning}`}>
                        {warning}
                      </li>
                    ))}
                </ul>

                {normalization.warnings.length > 30 && (
                  <p>Mostrando os primeiros 30 avisos.</p>
                )}
              </details>
            )}

            <div className="simulation-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => void handleCalculateFreight()}
                disabled={isCalculating}
              >
                {isCalculating
                  ? "Calculando fretes…"
                  : "Calcular frete"}
              </button>
            </div>
          </div>

          {calculationError && (
            <section className="simulation-errors" role="alert">
              <h2>Não foi possível concluir a operação</h2>
              <p>{calculationError}</p>
            </section>
          )}

          {calculation && !calculation.success && (
            <section className="simulation-errors" role="alert">
              <h2>Não foi possível calcular as remessas</h2>

              <ul>
                {calculation.errors.map((error, index) => (
                  <li key={`${index}-${error}`}>{error}</li>
                ))}
              </ul>
            </section>
          )}

          {calculation?.success && (
            <>
              <section
                className="simulation-summary"
                aria-label="Resumo dos cálculos de frete"
              >
                <article>
                  <span>Remessas com opção de frete</span>
                  <strong>
                    {calculatedShipments.length - unquotedCount}
                    {" / "}
                    {calculatedShipments.length}
                  </strong>
                </article>

                <article>
                  <span>Oportunidades de economia</span>
                  <strong>{opportunities.length}</strong>
                </article>

                <article>
                  <span>Economia potencial</span>
                  <strong>
                    {currencyFormatter.format(totalPotentialSavings)}
                  </strong>
                </article>
              </section>

              {calculation.warnings.length > 0 && (
                <details className="freight-calculation-notices">
                  <summary>
                    Avisos do cálculo ({calculation.warnings.length})
                  </summary>

                  <ul>
                    {calculation.warnings
                      .slice(0, 30)
                      .map((warning, index) => (
                        <li key={`${index}-${warning}`}>
                          {warning}
                        </li>
                      ))}
                  </ul>

                  {calculation.warnings.length > 30 && (
                    <p>Mostrando os primeiros 30 avisos.</p>
                  )}
                </details>
              )}

              <section className="panel">
                <div className="panel-heading">
                  <h2>Comparação de frete</h2>
                  <span>25 remessas por página</span>
                </div>

                <div className="simulation-body">
                  <div className="freight-results-toolbar">
                    <div
                      className="freight-result-filters"
                      role="group"
                      aria-label="Filtrar resultados"
                    >
                      <button
                        type="button"
                        className={
                          filter === "opportunities"
                            ? "freight-filter-button is-active"
                            : "freight-filter-button"
                        }
                        aria-pressed={filter === "opportunities"}
                        onClick={() =>
                          handleFilterChange("opportunities")
                        }
                      >
                        Oportunidades ({opportunities.length})
                      </button>

                      <button
                        type="button"
                        className={
                          filter === "all"
                            ? "freight-filter-button is-active"
                            : "freight-filter-button"
                        }
                        aria-pressed={filter === "all"}
                        onClick={() => handleFilterChange("all")}
                      >
                        Todas ({calculatedShipments.length})
                      </button>

                      <button
                        type="button"
                        className={
                          filter === "unquoted"
                            ? "freight-filter-button is-active"
                            : "freight-filter-button"
                        }
                        aria-pressed={filter === "unquoted"}
                        onClick={() =>
                          handleFilterChange("unquoted")
                        }
                      >
                        Sem cotação ({unquotedCount})
                      </button>
                    </div>

                    <label className="freight-results-search">
                      <span>Buscar remessa</span>

                      <input
                        type="search"
                        value={search}
                        placeholder="Remessa, cidade, UF ou transportadora"
                        onChange={(event) => {
                          setSearch(event.target.value);
                          setPage(1);
                          setExpandedShipment(null);
                        }}
                      />
                    </label>
                  </div>

                  <p className="simulation-help">
                    Os indicadores acima consideram todas as remessas
                    calculadas. Os filtros abaixo alteram apenas a
                    listagem.
                  </p>

                  <Pagination
                    page={currentPage}
                    total={filteredShipments.length}
                    onChange={handlePageChange}
                  />

                  {visibleShipments.length === 0 ? (
                    <div
                      className="freight-empty-results"
                      role="status"
                    >
                      <strong>
                        {filter === "opportunities" && !search.trim()
                          ? "Nenhuma oportunidade de economia encontrada."
                          : "Nenhuma remessa encontrada neste filtro."}
                      </strong>

                      <p>
                        {filter === "opportunities"
                          ? "Selecione “Todas” para consultar os resultados das remessas."
                          : "Altere o filtro ou o termo da busca."}
                      </p>
                    </div>
                  ) : (
                    <div className="shipment-table-wrap freight-results-scroll">
                      <table className="shipment-table freight-results-table">
                        <thead>
                          <tr>
                            <th scope="col">Remessa</th>
                            <th scope="col">Cidade / UF</th>
                            <th scope="col">Tipo</th>
                            <th scope="col">Valor NF</th>
                            <th scope="col">Peso real</th>
                            <th scope="col">Transportadora atual</th>
                            <th scope="col">Frete atual</th>
                            <th scope="col">Melhor opção</th>
                            <th scope="col">Melhor frete</th>
                            <th scope="col">Economia potencial</th>
                            <th scope="col">Economia %</th>
                            <th scope="col">Recomendação</th>
                            <th scope="col">Cotações</th>
                          </tr>
                        </thead>

                        <tbody>
                          {visibleShipments.map((shipment) => {
                            const expanded =
                              expandedShipment === shipment.shipment;

                            return (
                              <Fragment key={shipment.shipment}>
                                <tr>
                                  <td className="freight-shipment-code">
                                    {shipment.shipment}
                                  </td>

                                  <td>
                                    {[shipment.city, shipment.uf]
                                      .filter(Boolean)
                                      .join(" / ") || "—"}
                                  </td>

                                  <td>{shipment.shipmentType}</td>

                                  <td>
                                    {formatMoney(shipment.invoiceValue)}
                                  </td>

                                  <td>
                                    {numberFormatter.format(
                                      shipment.realWeightKg,
                                    )}{" "}
                                    kg
                                  </td>

                                  <td>{shipment.currentCarrier}</td>

                                  <td>
                                    {formatMoney(shipment.currentCost)}
                                  </td>

                                  <td>
                                    {shipment.bestCarrier ?? "Sem opção"}
                                  </td>

                                  <td>
                                    {formatMoney(shipment.bestCost)}
                                  </td>

                                  <td
                                    className={
                                      shipment.potentialSavings > 0
                                        ? "freight-saving-value"
                                        : undefined
                                    }
                                  >
                                    {formatMoney(
                                      shipment.potentialSavings,
                                    )}
                                  </td>

                                  <td>
                                    {formatPercent(
                                      shipment.potentialSavingsPercent,
                                    )}
                                  </td>

                                  <td>{shipment.status}</td>

                                  <td>
                                    <button
                                      type="button"
                                      className="freight-detail-button"
                                      aria-expanded={expanded}
                                      aria-label={`${
                                        expanded ? "Fechar" : "Ver"
                                      } cotações da remessa ${
                                        shipment.shipment
                                      }`}
                                      onClick={() =>
                                        setExpandedShipment(
                                          expanded
                                            ? null
                                            : shipment.shipment,
                                        )
                                      }
                                    >
                                      {expanded ? "Fechar" : "Ver"}
                                    </button>
                                  </td>
                                </tr>

                                {expanded && (
                                  <tr className="freight-expanded-row">
                                    <td colSpan={13}>
                                      <div className="freight-quote-details">
                                        <h3>
                                          Cotações da remessa{" "}
                                          {shipment.shipment}
                                        </h3>

                                        <table className="freight-quotes-table">
                                          <thead>
                                            <tr>
                                              <th scope="col">
                                                Transportadora
                                              </th>
                                              <th scope="col">
                                                Frete calculado
                                              </th>
                                              <th scope="col">
                                                Observação
                                              </th>
                                            </tr>
                                          </thead>

                                          <tbody>
                                            {FREIGHT_CARRIERS.map(
                                              (carrier) => {
                                                const quote =
                                                  shipment.quotes.find(
                                                    (item) =>
                                                      item.carrier ===
                                                      carrier,
                                                  );

                                                return (
                                                  <tr key={carrier}>
                                                    <td>{carrier}</td>
                                                    <td>
                                                      {formatMoney(
                                                        quote?.cost ??
                                                          null,
                                                      )}
                                                    </td>
                                                    <td>
                                                      {quote?.reason ??
                                                        "Cotação não disponível."}
                                                    </td>
                                                  </tr>
                                                );
                                              },
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {filteredShipments.length > PAGE_SIZE && (
                    <Pagination
                      page={currentPage}
                      total={filteredShipments.length}
                      onChange={handlePageChange}
                    />
                  )}
                </div>
              </section>
            </>
          )}

          {simulationToSave && (
            <SimulationDecisions
              key={simulationToSave.requestId}
              input={simulationToSave}
            />
          )}

          <details className="panel freight-input-panel">
            <summary className="freight-input-summary">
              <span>Consultar itens das remessas</span>
              <span>{inputShipments.length} remessas</span>
            </summary>

            <div className="simulation-body">
              <Pagination
                page={currentInputPage}
                total={inputShipments.length}
                onChange={setInputPage}
              />

              <div className="shipment-list freight-input-list">
                {visibleInputShipments.map((group) => (
                  <details
                    className="shipment-detail"
                    key={`input-${group.shipment}`}
                  >
                    <summary>
                      <span>Remessa {group.shipment}</span>
                      <span className="shipment-count">
                        {group.items.length} linha(s)
                        {" · "}
                        {currencyFormatter.format(group.invoiceValue)}
                      </span>
                    </summary>

                    <div className="shipment-table-wrap freight-input-items">
                      <table className="shipment-table">
                        <thead>
                          <tr>
                            <th scope="col">Linha</th>
                            <th scope="col">Data de criação</th>
                            <th scope="col">Material</th>
                            <th scope="col">Descrição</th>
                            <th scope="col">Quantidade</th>
                            <th scope="col">Preço Crédito</th>
                            <th scope="col">Cidade / UF</th>
                            <th scope="col">Transportadora</th>
                          </tr>
                        </thead>

                        <tbody>
                          {group.items.map((item) => (
                            <tr key={item.sourceRow}>
                              <td>{item.sourceRow}</td>
                              <td>{item.creationDate}</td>
                              <td>{item.material}</td>

                              <td>
                                {
                                  item.original.values[
                                    "Denominação de item"
                                  ]
                                }
                              </td>

                              <td>
                                {item.quantity.toLocaleString("pt-BR")}
                              </td>

                              <td>
                                {currencyFormatter.format(
                                  item.invoiceValue,
                                )}
                              </td>

                              <td>
                                {[
                                  item.original.values.Cidade,
                                  item.original.values.Região,
                                ]
                                  .filter(Boolean)
                                  .join(" / ")}
                              </td>

                              <td>
                                {item.original.values.Transportadora}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ))}
              </div>

              {inputShipments.length > PAGE_SIZE && (
                <Pagination
                  page={currentInputPage}
                  total={inputShipments.length}
                  onChange={setInputPage}
                />
              )}
            </div>
          </details>
        </>
      )}
    </div>
  );
}