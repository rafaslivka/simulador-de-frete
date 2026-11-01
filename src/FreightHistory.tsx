import { useEffect, useState } from "react";
import {
  getFreightHistory,
  getSavedFreightShipmentSource,
} from "./lib/freightHistory";
import type { FreightHistoryPage } from "./lib/freightHistory";
import {
  FREIGHT_DECISION_LABELS,
  getFreightDecisionHistory,
  getFreightShipmentDecisions,
  getFreightSimulationShipments,
} from "./lib/freightSimulations";
import type {
  FreightDecisionEvent,
  FreightShipmentDecision,
  FreightSimulationRun,
  SavedFreightShipment,
} from "./lib/freightSimulations";
import type { NormalizedShipment } from "./utils/normalizeShipments";
import "./FreightHistory.css";

const PAGE_SIZE = 25;

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatMoney(value: number | null): string {
  return value === null ? "Sem cotação" : currency.format(value);
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("pt-BR");
}

function formatDate(value: string): string {
  const parts = value.split("-");

  return parts.length === 3
    ? `${parts[2]}/${parts[1]}/${parts[0]}`
    : value;
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function Pagination({
  page,
  total,
  onChange,
  disabled = false,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
  disabled?: boolean;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const first = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const last = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="history-pagination">
      <span>
        {first}–{last} de {total} registros
      </span>

      <div>
        <button
          type="button"
          className="secondary-button"
          disabled={disabled || page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Anterior
        </button>

        <span>
          Página {page} de {pages}
        </span>

        <button
          type="button"
          className="secondary-button"
          disabled={disabled || page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Próxima
        </button>
      </div>
    </div>
  );
}

function ShipmentDetails({
  shipment,
  decision,
}: {
  shipment: SavedFreightShipment;
  decision?: FreightShipmentDecision;
}) {
  const [source, setSource] = useState<NormalizedShipment | null>(null);
  const [events, setEvents] = useState<FreightDecisionEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [itemPage, setItemPage] = useState(1);

  const decisionId = decision?.id;

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError("");

      try {
        const [savedSource, savedEvents] = await Promise.all([
          getSavedFreightShipmentSource(shipment.id),
          decisionId
            ? getFreightDecisionHistory(decisionId)
            : Promise.resolve([] as FreightDecisionEvent[]),
        ]);

        if (active) {
          setSource(savedSource);
          setEvents(savedEvents);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar os detalhes.",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [shipment.id, decisionId, retry]);

  if (isLoading) {
    return <p role="status">Carregando os detalhes da remessa…</p>;
  }

  if (error) {
    return (
      <div className="history-error" role="alert">
        <p>{error}</p>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setRetry((value) => value + 1)}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!source) {
    return null;
  }

  const totalItemPages = Math.max(
    1,
    Math.ceil(source.items.length / PAGE_SIZE),
  );

  const currentItemPage = Math.min(itemPage, totalItemPages);

  const visibleItems = source.items.slice(
    (currentItemPage - 1) * PAGE_SIZE,
    currentItemPage * PAGE_SIZE,
  );

  return (
    <div className="history-shipment-details">
      <h3>Cotações preservadas nesta análise</h3>

      <div className="history-table-scroll">
        <table className="history-table">
          <thead>
            <tr>
              <th>Transportadora</th>
              <th>Frete calculado</th>
              <th>Observação</th>
            </tr>
          </thead>

          <tbody>
            {shipment.calculation.quotes.map((quote) => (
              <tr key={quote.carrier}>
                <td>{quote.carrier}</td>
                <td>{formatMoney(quote.cost)}</td>
                <td className="history-wrap">{quote.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3>Itens da remessa</h3>

      <div className="history-table-scroll">
        <table className="history-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Descrição</th>
              <th>Quantidade</th>
              <th>Preço Crédito</th>
              <th>Cidade / UF</th>
            </tr>
          </thead>

          <tbody>
            {visibleItems.map((item) => (
              <tr key={item.sourceRow}>
                <td>{item.material}</td>
                <td className="history-wrap">
                  {item.original.values["Denominação de item"]}
                </td>
                <td>{item.quantity.toLocaleString("pt-BR")}</td>
                <td>{currency.format(item.invoiceValue)}</td>
                <td>
                  {[
                    item.original.values.Cidade,
                    item.original.values.Região,
                  ]
                    .filter(Boolean)
                    .join(" / ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {source.items.length > PAGE_SIZE && (
        <Pagination
          page={currentItemPage}
          total={source.items.length}
          onChange={setItemPage}
        />
      )}

      {decision && (
        <div className="history-decision">
          <h3>Decisão vigente da remessa</h3>

          <p>
            <strong>
              {FREIGHT_DECISION_LABELS[decision.status]}
            </strong>

            {decision.decided_at && (
              <> · {formatDateTime(decision.decided_at)}</>
            )}
          </p>

          {decision.simulation_shipment_id !== shipment.id && (
            <p>
              Essa decisão está vinculada a outra análise da mesma
              remessa. Os valores exibidos nesta tela pertencem à
              análise que você abriu.
            </p>
          )}

          {decision.note && (
            <p className="history-note">{decision.note}</p>
          )}

          <details className="history-audit">
            <summary>Histórico das decisões ({events.length})</summary>

            {events.length === 0 ? (
              <p>Nenhuma alteração registrada.</p>
            ) : (
              <ul>
                {events.map((event) => (
                  <li key={event.id}>
                    <strong>
                      {event.previous_status
                        ? FREIGHT_DECISION_LABELS[event.previous_status]
                        : "Registro inicial"}
                      {" → "}
                      {FREIGHT_DECISION_LABELS[event.new_status]}
                    </strong>

                    <span>{formatDateTime(event.changed_at)}</span>

                    {event.previous_result_id &&
                      event.previous_result_id !== event.new_result_id && (
                        <span>A análise de referência foi alterada.</span>
                      )}

                    {event.new_note && (
                      <p className="history-note">{event.new_note}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </details>
        </div>
      )}
    </div>
  );
}

function RunDetails({ run }: { run: FreightSimulationRun }) {
  const [shipments, setShipments] = useState<SavedFreightShipment[]>([]);
  const [decisions, setDecisions] = useState<FreightShipmentDecision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [search, setSearch] = useState("");
  const [onlyOpportunities, setOnlyOpportunities] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError("");

      try {
        const [savedShipments, savedDecisions] = await Promise.all([
          getFreightSimulationShipments(run.id),
          getFreightShipmentDecisions(),
        ]);

        if (savedShipments.length !== run.shipment_count) {
          throw new Error(
            "A consulta não retornou todas as remessas. Tente novamente.",
          );
        }

        if (active) {
          setShipments(savedShipments);
          setDecisions(savedDecisions);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar a análise.",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [run.id, run.shipment_count, retry]);

  const normalizedSearch = normalizeSearch(search);

  const filtered = shipments
    .filter((shipment) => {
      if (onlyOpportunities && shipment.potential_savings <= 0) {
        return false;
      }

      return normalizeSearch(
        [
          shipment.shipment_code,
          shipment.calculation.city,
          shipment.calculation.uf,
          shipment.current_carrier,
          shipment.suggested_carrier ?? "",
        ].join(" "),
      ).includes(normalizedSearch);
    })
    .sort(
      (a, b) =>
        b.potential_savings - a.potential_savings ||
        a.shipment_code.localeCompare(b.shipment_code),
    );

  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
  );

  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const decisionsByShipment = new Map(
    decisions.map((decision) => [decision.shipment_code, decision]),
  );

  if (isLoading) {
    return <p role="status">Carregando as remessas da análise…</p>;
  }

  if (error) {
    return (
      <div className="history-error" role="alert">
        <p>{error}</p>
        <button
          type="button"
          className="secondary-button"
          onClick={() => setRetry((value) => value + 1)}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="history-run-details">
      <details className="history-versions">
        <summary>Tabelas utilizadas nesta análise</summary>

        <ul>
          {run.table_versions.map((version) => (
            <li key={version.id}>
              <strong>{version.dataset_key.replaceAll("_", " ")}</strong>
              {" · v"}
              {version.version_no}
              {" · "}
              {version.source_file_name}
            </li>
          ))}
        </ul>
      </details>

      <div className="history-toolbar">
        <label className="history-search">
          Buscar remessa
          <input
            type="search"
            value={search}
            placeholder="Remessa, cidade, UF ou transportadora"
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
              setExpandedId(null);
            }}
          />
        </label>

        <label className="history-checkbox">
          <input
            type="checkbox"
            checked={onlyOpportunities}
            onChange={(event) => {
              setOnlyOpportunities(event.target.checked);
              setPage(1);
              setExpandedId(null);
            }}
          />
          Somente oportunidades
        </label>
      </div>

      <Pagination
        page={currentPage}
        total={filtered.length}
        onChange={(nextPage) => {
          setPage(nextPage);
          setExpandedId(null);
        }}
      />

      {visible.length === 0 ? (
        <p className="history-empty">
          Nenhuma remessa encontrada neste filtro.
        </p>
      ) : (
        <div className="history-shipments">
          {visible.map((shipment) => {
            const decision = decisionsByShipment.get(
              shipment.shipment_code,
            );

            const expanded = expandedId === shipment.id;

            return (
              <article className="history-shipment" key={shipment.id}>
                <button
                  type="button"
                  className="history-shipment-toggle"
                  aria-expanded={expanded}
                  onClick={() =>
                    setExpandedId(expanded ? null : shipment.id)
                  }
                >
                  <div>
                    <strong>Remessa {shipment.shipment_code}</strong>
                    <span>
                      {shipment.calculation.city}
                      {" / "}
                      {shipment.calculation.uf}
                      {" · "}
                      {formatDate(shipment.shipment_date)}
                    </span>
                  </div>

                  <div>
                    <strong>
                      {shipment.potential_savings > 0
                        ? `Economia potencial: ${currency.format(
                            shipment.potential_savings,
                          )}`
                        : "Sem economia positiva nesta análise"}
                    </strong>

                    <span>
                      {decision
                        ? `Decisão vigente: ${
                            FREIGHT_DECISION_LABELS[decision.status]
                          }`
                        : "Sem decisão registrada"}
                      {" · "}
                      {expanded ? "Fechar detalhes" : "Ver detalhes"}
                    </span>
                  </div>
                </button>

                <div className="history-costs">
                  <div>
                    <span>Transportadora atual</span>
                    <strong>{shipment.current_carrier}</strong>
                    <span>{formatMoney(shipment.current_cost)}</span>
                  </div>

                  <div>
                    <span>Melhor opção calculada</span>
                    <strong>
                      {shipment.suggested_carrier ?? "Sem opção"}
                    </strong>
                    <span>{formatMoney(shipment.suggested_cost)}</span>
                  </div>
                </div>

                {expanded && (
                  <ShipmentDetails
                    key={shipment.id}
                    shipment={shipment}
                    decision={decision}
                  />
                )}
              </article>
            );
          })}
        </div>
      )}

      {filtered.length > PAGE_SIZE && (
        <Pagination
          page={currentPage}
          total={filtered.length}
          onChange={(nextPage) => {
            setPage(nextPage);
            setExpandedId(null);
          }}
        />
      )}
    </div>
  );
}

export default function FreightHistory() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [query, setQuery] = useState({
    page: 1,
    startDate: "",
    endDate: "",
    refresh: 0,
  });

  const [result, setResult] = useState<FreightHistoryPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [selectedRun, setSelectedRun] =
    useState<FreightSimulationRun | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError("");

      try {
        const history = await getFreightHistory(query);

        if (active) {
          setResult(history);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar o histórico.",
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [query]);

  function applyFilters() {
    if (startDate && endDate && startDate > endDate) {
      setFilterError(
        "A data inicial não pode ser posterior à data final.",
      );
      return;
    }

    setFilterError("");
    setSelectedRun(null);
    setQuery((current) => ({
      page: 1,
      startDate,
      endDate,
      refresh: current.refresh + 1,
    }));
  }

  function clearFilters() {
    setStartDate("");
    setEndDate("");
    setFilterError("");
    setSelectedRun(null);
    setQuery((current) => ({
      page: 1,
      startDate: "",
      endDate: "",
      refresh: current.refresh + 1,
    }));
  }

  if (selectedRun) {
    return (
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>Análise de {formatDateTime(selectedRun.created_at)}</h2>
            <p>
              {selectedRun.shipment_count} remessas
              {" · "}
              {selectedRun.item_count} linhas de itens
            </p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={() => setSelectedRun(null)}
          >
            Voltar ao histórico
          </button>
        </div>

        <div className="history-body">
          <p className="history-help">
            As cotações abaixo são as que foram salvas nessa análise.
            Atualizações posteriores das tabelas não recalculam este
            registro.
          </p>

          <RunDetails key={selectedRun.id} run={selectedRun} />
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Análises salvas</h2>
        <span>25 análises por página</span>
      </div>

      <div className="history-body">
        <form
          className="history-toolbar"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <label>
            Data inicial
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>

          <label>
            Data final
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>

          <button
            type="submit"
            className="primary-button"
            disabled={isLoading}
          >
            {isLoading ? "Carregando…" : "Consultar"}
          </button>

          <button
            type="button"
            className="secondary-button"
            disabled={isLoading}
            onClick={clearFilters}
          >
            Todo o histórico
          </button>
        </form>

        <p className="history-help">
          O período considera a data em que a análise foi salva.
        </p>

        {filterError && (
          <p className="history-error" role="alert">{filterError}</p>
        )}

        {error && (
          <p className="history-error" role="alert">{error}</p>
        )}

        {isLoading ? (
          <p role="status">Carregando análises salvas…</p>
        ) : !error && result ? (
          <>
            <Pagination
              page={result.page}
              total={result.total}
              onChange={(page) =>
                setQuery((current) => ({ ...current, page }))
              }
            />

            {result.runs.length === 0 ? (
              <div className="history-empty">
                Nenhuma análise salva neste período.
              </div>
            ) : (
              <div className="history-table-scroll">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Data da análise</th>
                      <th>Origem</th>
                      <th>Remessas</th>
                      <th>Linhas de itens</th>
                      <th>Ação</th>
                    </tr>
                  </thead>

                  <tbody>
                    {result.runs.map((run) => (
                      <tr key={run.id}>
                        <td>{formatDateTime(run.created_at)}</td>
                        <td>{run.source_name}</td>
                        <td>{run.shipment_count}</td>
                        <td>{run.item_count}</td>
                        <td>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => setSelectedRun(run)}
                          >
                            Abrir análise
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}