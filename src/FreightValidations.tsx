import { useEffect, useState } from "react";
import {
  getFreightValidations,
  VALIDATIONS_PAGE_SIZE,
} from "./lib/freightValidations";
import type {
  FreightValidationFilter,
  FreightValidationFilters,
  FreightValidationPage,
  FreightValidationRecord,
} from "./lib/freightValidations";
import {
  FREIGHT_DECISION_LABELS,
  getFreightDecisionHistory,
  saveFreightShipmentDecision,
} from "./lib/freightSimulations";
import type {
  FreightDecisionEvent,
  FreightDecisionStatus,
} from "./lib/freightSimulations";
import "./FreightValidations.css";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatMoney(value: number | null): string {
  return value === null ? "Sem cotação" : currency.format(value);
}

function formatDate(value: string): string {
  const parts = value.split("-");

  return parts.length === 3
    ? `${parts[2]}/${parts[1]}/${parts[0]}`
    : value;
}

function formatDateTime(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("pt-BR");
}

function DecisionHistory({ decisionId }: { decisionId: string }) {
  const [events, setEvents] = useState<FreightDecisionEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError("");

      try {
        const history = await getFreightDecisionHistory(decisionId);

        if (active) {
          setEvents(history);
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
  }, [decisionId, retry]);

  if (isLoading) {
    return <p role="status">Carregando histórico…</p>;
  }

  if (error) {
    return (
      <div className="validation-error" role="alert">
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
    <div className="validation-audit">
      {events.length === 0 ? (
        <p>Nenhuma alteração registrada.</p>
      ) : (
        <ol>
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

              {event.previous_note !== event.new_note && (
                <div className="validation-note">
                  {event.previous_note && (
                    <p>Observação anterior: {event.previous_note}</p>
                  )}

                  <p>
                    Nova observação: {event.new_note || "Sem observação."}
                  </p>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

type DecisionEditorProps = {
  record: FreightValidationRecord;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onSaved: (shipmentCode: string) => void;
};

function DecisionEditor({
  record,
  busy,
  onBusyChange,
  onSaved,
}: DecisionEditorProps) {
  const [status, setStatus] =
    useState<FreightDecisionStatus>(record.status);
  const [note, setNote] = useState(record.note);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const shipment = record.shipment;

  const changed =
    status !== record.status ||
    note.trim() !== record.note;

  async function handleSave() {
    if (busy || !changed) {
      return;
    }

    let confirmation: string;

    if (status === "applied") {
      confirmation =
        `Você confirma que realizou a mudança da remessa ` +
        `${record.shipment_code} de ${shipment.current_carrier} ` +
        `para ${shipment.suggested_carrier}?\n\n` +
        `Economia calculada: ${currency.format(
          shipment.potential_savings,
        )}.\n\n` +
        `Essa confirmação será considerada nos indicadores de economia realizada.`;
    } else if (status === "not_applied") {
      confirmation =
        `Registrar que você não realizou a mudança da remessa ` +
        `${record.shipment_code}?\n\n` +
        `Esta remessa não contabilizará economia realizada.`;
    } else {
      confirmation =
        `Devolver a remessa ${record.shipment_code} para pendente?\n\n` +
        `Ela deixará de contabilizar economia realizada enquanto estiver pendente.`;
    }

    if (!window.confirm(confirmation)) {
      return;
    }

    onBusyChange(true);
    setError("");

    try {
      await saveFreightShipmentDecision({
        simulationShipmentId: record.simulation_shipment_id,
        status,
        expectedRevision: record.revision,
        note,
      });

      onSaved(record.shipment_code);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar a decisão.",
      );
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <div className="validation-editor">
      <div className="validation-costs">
        <div>
          <span>Transportadora atual</span>
          <strong>{shipment.current_carrier}</strong>
          <span>{formatMoney(shipment.current_cost)}</span>
        </div>

        <div>
          <span>Transportadora sugerida</span>
          <strong>{shipment.suggested_carrier ?? "Sem opção"}</strong>
          <span>{formatMoney(shipment.suggested_cost)}</span>
        </div>

        <div>
          <span>Economia calculada</span>
          <strong className="validation-saving">
            {currency.format(shipment.potential_savings)}
          </strong>
          <span>
            {record.status === "applied"
              ? "Mudança confirmada"
              : "Ainda não contabilizada como realizada"}
          </span>
        </div>
      </div>

      <p className="validation-help">
        Valores da análise salva em {formatDateTime(shipment.created_at)}.
        Esta tela não recalcula o frete.
      </p>

      <details className="validation-quotes">
        <summary>Consultar cotações desta análise</summary>

        <div className="validation-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Transportadora</th>
                <th>Frete</th>
                <th>Observação</th>
              </tr>
            </thead>

            <tbody>
              {shipment.calculation.quotes.map((quote) => (
                <tr key={quote.carrier}>
                  <td>{quote.carrier}</td>
                  <td>{formatMoney(quote.cost)}</td>
                  <td>{quote.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className="validation-fields">
        <label>
          Sua decisão
          <select
            value={status}
            disabled={busy}
            onChange={(event) =>
              setStatus(event.target.value as FreightDecisionStatus)
            }
          >
            <option value="pending">Pendente</option>
            <option value="applied">Fiz a mudança</option>
            <option value="not_applied">Não fiz a mudança</option>
          </select>
        </label>

        <label>
          Observação opcional
          <textarea
            value={note}
            disabled={busy}
            maxLength={2000}
            rows={3}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Registre uma observação, se necessário."
          />
        </label>
      </div>

      {error && (
        <p className="validation-error" role="alert">
          {error}
        </p>
      )}

      <div className="validation-editor-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={() => setShowHistory((value) => !value)}
        >
          {showHistory ? "Fechar histórico" : "Histórico da decisão"}
        </button>

        <button
          type="button"
          className="primary-button"
          disabled={busy || !changed}
          onClick={() => void handleSave()}
        >
          {busy ? "Salvando…" : "Salvar decisão"}
        </button>
      </div>

      {showHistory && (
        <DecisionHistory
          key={`${record.id}-${record.revision}`}
          decisionId={record.id}
        />
      )}
    </div>
  );
}

export default function FreightValidations() {
  const [status, setStatus] =
    useState<FreightValidationFilter>("pending");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [query, setQuery] = useState<
    FreightValidationFilters & { refresh: number }
  >({
    page: 1,
    status: "pending",
    shipmentSearch: "",
    startDate: "",
    endDate: "",
    refresh: 0,
  });

  const [result, setResult] =
    useState<FreightValidationPage | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [message, setMessage] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError("");

      try {
        const page = await getFreightValidations(query);

        if (active) {
          setResult(page);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar as validações.",
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
    setMessage("");
    setExpandedId(null);

    setQuery((current) => ({
      page: 1,
      status,
      shipmentSearch: search,
      startDate,
      endDate,
      refresh: current.refresh + 1,
    }));
  }

  function clearFilters() {
    setStatus("pending");
    setSearch("");
    setStartDate("");
    setEndDate("");
    setFilterError("");
    setMessage("");
    setExpandedId(null);

    setQuery((current) => ({
      page: 1,
      status: "pending",
      shipmentSearch: "",
      startDate: "",
      endDate: "",
      refresh: current.refresh + 1,
    }));
  }

  function handleSaved(shipmentCode: string) {
    setMessage(`Decisão da remessa ${shipmentCode} salva.`);
    setExpandedId(null);
    setIsLoading(true);

    setQuery((current) => ({
      ...current,
      refresh: current.refresh + 1,
    }));
  }

  function changePage(page: number) {
    setExpandedId(null);

    setQuery((current) => ({
      ...current,
      page,
    }));
  }

  const busy = isLoading || isSaving;

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Decisões por remessa</h2>
        <span>25 remessas por página</span>
      </div>

      <div className="validation-body">
        <p className="validation-help">
          Confirme somente as mudanças que você realizou. Pendências
          e mudanças não realizadas não entram na economia realizada.
        </p>

        <form
          className="validation-filters"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <label>
            Status
            <select
              value={status}
              disabled={busy}
              onChange={(event) =>
                setStatus(event.target.value as FreightValidationFilter)
              }
            >
              <option value="pending">Pendentes</option>
              <option value="applied">Fiz a mudança</option>
              <option value="not_applied">Não fiz a mudança</option>
              <option value="all">Todas as decisões</option>
            </select>
          </label>

          <label>
            Remessa
            <input
              type="search"
              value={search}
              disabled={busy}
              placeholder="Número da remessa"
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <label>
            Data inicial
            <input
              type="date"
              value={startDate}
              disabled={busy}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>

          <label>
            Data final
            <input
              type="date"
              value={endDate}
              disabled={busy}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>

          <button
            type="submit"
            className="primary-button"
            disabled={busy}
          >
            Consultar
          </button>

          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={clearFilters}
          >
            Limpar filtros
          </button>
        </form>

        <p className="validation-help">
          O período considera a data da remessa. Cada remessa aparece
          uma única vez, vinculada à análise usada na decisão.
        </p>

        {filterError && (
          <p className="validation-error" role="alert">
            {filterError}
          </p>
        )}

        {message && (
          <p className="validation-success" role="status">
            {message}
          </p>
        )}

        {error && (
          <div className="validation-error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() =>
                setQuery((current) => ({
                  ...current,
                  refresh: current.refresh + 1,
                }))
              }
            >
              Tentar novamente
            </button>
          </div>
        )}

        {isLoading ? (
          <p role="status">Carregando decisões…</p>
        ) : !error && result ? (
          <>
            <div className="validation-pagination">
              <span>
                {result.total === 0
                  ? 0
                  : (result.page - 1) * VALIDATIONS_PAGE_SIZE + 1}
                {"–"}
                {Math.min(
                  result.page * VALIDATIONS_PAGE_SIZE,
                  result.total,
                )}
                {" de "}
                {result.total} remessas
              </span>

              <div>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy || result.page <= 1}
                  onClick={() => changePage(result.page - 1)}
                >
                  Anterior
                </button>

                <span>
                  Página {result.page} de {result.totalPages}
                </span>

                <button
                  type="button"
                  className="secondary-button"
                  disabled={busy || result.page >= result.totalPages}
                  onClick={() => changePage(result.page + 1)}
                >
                  Próxima
                </button>
              </div>
            </div>

            {result.records.length === 0 ? (
              <div className="validation-empty">
                <strong>Nenhuma decisão encontrada neste filtro.</strong>
                <p>
                  As oportunidades aparecem aqui após salvar uma análise
                  com economia positiva.
                </p>
              </div>
            ) : (
              <div className="validation-list">
                {result.records.map((record) => {
                  const expanded = expandedId === record.id;

                  return (
                    <article
                      className="validation-card"
                      key={record.id}
                    >
                      <button
                        type="button"
                        className="validation-card-toggle"
                        disabled={isSaving}
                        aria-expanded={expanded}
                        onClick={() =>
                          setExpandedId(expanded ? null : record.id)
                        }
                      >
                        <div>
                          <strong>
                            Remessa {record.shipment_code}
                          </strong>

                          <span>
                            {record.shipment.calculation.city}
                            {" / "}
                            {record.shipment.calculation.uf}
                            {" · "}
                            {formatDate(record.shipment.shipment_date)}
                          </span>
                        </div>

                        <div className="validation-card-status">
                          <span className={`validation-badge ${record.status}`}>
                            {FREIGHT_DECISION_LABELS[record.status]}
                          </span>

                          <span>
                            {expanded ? "Fechar" : "Abrir decisão"}
                          </span>
                        </div>
                      </button>

                      {expanded && (
                        <DecisionEditor
                          key={`${record.id}-${record.revision}`}
                          record={record}
                          busy={isSaving}
                          onBusyChange={setIsSaving}
                          onSaved={handleSaved}
                        />
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
}