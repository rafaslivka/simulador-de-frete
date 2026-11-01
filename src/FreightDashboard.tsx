import { useEffect, useState } from "react";
import {
  filterDashboardRecords,
  getFreightDashboardData,
  summarizeFreightDashboard,
} from "./lib/freightDashboard";
import type {
  DashboardFilters,
  DashboardPeriod,
  FreightDashboardData,
  FreightDashboardSummary,
} from "./lib/freightDashboard";
import "./FreightDashboard.css";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const percent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 2,
});

const periodLabels: Record<DashboardPeriod, string> = {
  latest: "Última análise",
  today: "Hoje",
  date: "Data específica",
  range: "Intervalo personalizado",
  week: "Esta semana",
  month: "Este mês",
  all: "Todo o histórico",
};

function todayString(): string {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
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

function getPeriodDescription(filters: DashboardFilters): string {
  if (filters.period === "date") {
    return formatDate(filters.startDate);
  }

  if (filters.period === "range") {
    return (
      `${formatDate(filters.startDate)} até ` +
      formatDate(filters.endDate)
    );
  }

  return periodLabels[filters.period];
}

function DashboardResults({
  summary,
}: {
  summary: FreightDashboardSummary;
}) {
  const maximumCarrierSavings = Math.max(
    1,
    ...summary.byCarrier.map((item) => item.savings),
  );

  const maximumDateSavings = Math.max(
    1,
    ...summary.byDate.map((item) => item.savings),
  );

  const maximumCost = Math.max(
    1,
    summary.originalCost,
    summary.chosenCost,
  );

  return (
    <>
      <section
        className="freight-dashboard-kpis"
        aria-label="Indicadores das mudanças confirmadas"
      >
        <article>
          <span>Mudanças confirmadas</span>
          <strong>{summary.confirmedCount.toLocaleString("pt-BR")}</strong>
          <small>Remessas marcadas como “Fiz a mudança”</small>
        </article>

        <article>
          <span>Custo original</span>
          <strong>{currency.format(summary.originalCost)}</strong>
          <small>Frete calculado nas transportadoras originais</small>
        </article>

        <article>
          <span>Custo após as mudanças</span>
          <strong>{currency.format(summary.chosenCost)}</strong>
          <small>Frete calculado nas transportadoras escolhidas</small>
        </article>

        <article className="freight-dashboard-kpi-saving">
          <span>Economia confirmada</span>
          <strong>{currency.format(summary.savings)}</strong>
          <small>Diferença dos custos das mudanças realizadas</small>
        </article>

        <article>
          <span>Redução de custo</span>
          <strong>{percent.format(summary.reductionPercent)}</strong>
          <small>Economia dividida pelo custo original</small>
        </article>
      </section>

      {summary.confirmedCount === 0 ? (
        <section className="panel">
          <div className="freight-dashboard-empty">
            <strong>Nenhuma mudança confirmada neste período.</strong>
            <p>
              As remessas entram nestes indicadores quando você registra
              “Fiz a mudança”. Pendências e mudanças não realizadas
              permanecem fora das somas.
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className="panel">
            <div className="panel-heading">
              <h2>Comparativo de custos</h2>
              <span>Mesmas remessas antes e depois da mudança</span>
            </div>

            <div className="freight-dashboard-chart-body">
              <div className="freight-dashboard-bar-row">
                <div className="freight-dashboard-bar-label">
                  <span>Transportadoras originais</span>
                  <strong>{currency.format(summary.originalCost)}</strong>
                </div>

                <div className="freight-dashboard-bar-track">
                  <div
                    className="freight-dashboard-bar original"
                    style={{
                      width: `${(summary.originalCost / maximumCost) * 100}%`,
                    }}
                    aria-hidden="true"
                  />
                </div>
              </div>

              <div className="freight-dashboard-bar-row">
                <div className="freight-dashboard-bar-label">
                  <span>Transportadoras escolhidas</span>
                  <strong>{currency.format(summary.chosenCost)}</strong>
                </div>

                <div className="freight-dashboard-bar-track">
                  <div
                    className="freight-dashboard-bar chosen"
                    style={{
                      width: `${(summary.chosenCost / maximumCost) * 100}%`,
                    }}
                    aria-hidden="true"
                  />
                </div>
              </div>

              <p className="freight-dashboard-comparison-note">
                Economia de <strong>{currency.format(summary.savings)}</strong>
                {" · "}
                Redução de{" "}
                <strong>{percent.format(summary.reductionPercent)}</strong>
              </p>
            </div>
          </section>

          <div className="freight-dashboard-charts">
            <section className="panel">
              <div className="panel-heading">
                <h2>Economia por transportadora</h2>
                <span>Transportadora escolhida</span>
              </div>

              <div className="freight-dashboard-chart-body">
                {summary.byCarrier.map((item) => (
                  <div
                    className="freight-dashboard-bar-row"
                    key={item.carrier}
                  >
                    <div className="freight-dashboard-bar-label">
                      <span>
                        {item.carrier}
                        <small>
                          {item.shipments} remessa(s)
                        </small>
                      </span>

                      <strong>{currency.format(item.savings)}</strong>
                    </div>

                    <div className="freight-dashboard-bar-track">
                      <div
                        className="freight-dashboard-bar"
                        style={{
                          width: `${
                            (item.savings / maximumCarrierSavings) * 100
                          }%`,
                        }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <h2>Economia por data</h2>
                <span>Data da remessa</span>
              </div>

              <div className="freight-dashboard-date-scroll">
                <div className="freight-dashboard-date-chart">
                  {summary.byDate.map((item) => (
                    <div
                      className="freight-dashboard-date-column"
                      key={item.date}
                      title={`${formatDate(item.date)}: ${currency.format(
                        item.savings,
                      )} em ${item.shipments} remessa(s)`}
                    >
                      <strong>{currency.format(item.savings)}</strong>

                      <div className="freight-dashboard-date-track">
                        <div
                          className="freight-dashboard-date-bar"
                          style={{
                            height: `${
                              (item.savings / maximumDateSavings) * 100
                            }%`,
                          }}
                          aria-hidden="true"
                        />
                      </div>

                      <span>{formatDate(item.date)}</span>
                      <small>{item.shipments} remessa(s)</small>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <section className="panel">
            <div className="panel-heading">
              <h2>10 maiores economias confirmadas</h2>
              <span>Período selecionado</span>
            </div>

            <div className="freight-dashboard-table-scroll">
              <table className="freight-dashboard-table">
                <thead>
                  <tr>
                    <th>Remessa</th>
                    <th>Data da remessa</th>
                    <th>Transportadora original</th>
                    <th>Transportadora escolhida</th>
                    <th>Custo original</th>
                    <th>Custo escolhido</th>
                    <th>Economia</th>
                    <th>Confirmação</th>
                  </tr>
                </thead>

                <tbody>
                  {summary.topSavings.map((record) => (
                    <tr key={record.id}>
                      <td>{record.shipment_code}</td>
                      <td>
                        {formatDate(record.shipment.shipment_date)}
                      </td>
                      <td>{record.shipment.current_carrier}</td>
                      <td>{record.shipment.suggested_carrier}</td>
                      <td>
                        {record.shipment.current_cost === null
                          ? "—"
                          : currency.format(record.shipment.current_cost)}
                      </td>
                      <td>
                        {record.shipment.suggested_cost === null
                          ? "—"
                          : currency.format(record.shipment.suggested_cost)}
                      </td>
                      <td className="freight-dashboard-saving-cell">
                        {currency.format(
                          record.shipment.potential_savings,
                        )}
                      </td>
                      <td>
                        {record.decided_at
                          ? formatDateTime(record.decided_at)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}

export default function FreightDashboard() {
  const [filters, setFilters] = useState<DashboardFilters>(() => ({
    period: "all",
    startDate: todayString(),
    endDate: todayString(),
  }));

  const [request, setRequest] = useState(() => ({
    filters,
    revision: 0,
  }));

  const [data, setData] = useState<FreightDashboardData | null>(null);
  const [summary, setSummary] =
    useState<FreightDashboardSummary | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError("");

      try {
        const loaded = await getFreightDashboardData();

        const records = filterDashboardRecords(
          loaded,
          request.filters,
        );

        const calculated = summarizeFreightDashboard(records);

        if (active) {
          setData(loaded);
          setSummary(calculated);
          setUpdatedAt(new Date().toISOString());
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar o dashboard.",
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
  }, [request]);

  function applyFilters() {
    if (
      (filters.period === "date" || filters.period === "range") &&
      !filters.startDate
    ) {
      setFilterError("Selecione a data inicial.");
      return;
    }

    if (filters.period === "range") {
      if (!filters.endDate) {
        setFilterError("Selecione a data final.");
        return;
      }

      if (filters.startDate > filters.endDate) {
        setFilterError(
          "A data inicial não pode ser posterior à data final.",
        );
        return;
      }
    }

    setFilterError("");

    setRequest((current) => ({
      filters: { ...filters },
      revision: current.revision + 1,
    }));
  }

  const showStart =
    filters.period === "date" || filters.period === "range";

  const showEnd = filters.period === "range";

  return (
    <div className="freight-dashboard">
      <section className="panel">
        <div className="panel-heading">
          <h2>Economia confirmada</h2>
          <span>Somente mudanças realizadas</span>
        </div>

        <div className="freight-dashboard-filter-body">
          <form
            className="freight-dashboard-filters"
            onSubmit={(event) => {
              event.preventDefault();
              applyFilters();
            }}
          >
            <label>
              Período
              <select
                value={filters.period}
                disabled={isLoading}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    period: event.target.value as DashboardPeriod,
                  }))
                }
              >
                <option value="latest">Última análise</option>
                <option value="today">Hoje</option>
                <option value="date">Data específica</option>
                <option value="range">Intervalo personalizado</option>
                <option value="week">Esta semana</option>
                <option value="month">Este mês</option>
                <option value="all">Todo o histórico</option>
              </select>
            </label>

            {showStart && (
              <label>
                {filters.period === "date" ? "Data" : "Data inicial"}
                <input
                  type="date"
                  required
                  value={filters.startDate}
                  disabled={isLoading}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      startDate: event.target.value,
                    }))
                  }
                />
              </label>
            )}

            {showEnd && (
              <label>
                Data final
                <input
                  type="date"
                  required
                  value={filters.endDate}
                  disabled={isLoading}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      endDate: event.target.value,
                    }))
                  }
                />
              </label>
            )}

            <button
              type="submit"
              className="primary-button"
              disabled={isLoading}
            >
              {isLoading ? "Atualizando…" : "Atualizar"}
            </button>
          </form>

          <p className="freight-dashboard-help">
            Os períodos usam a data da remessa. “Última análise”
            considera as confirmações vinculadas à análise salva
            mais recentemente.
          </p>

          {filterError && (
            <p className="freight-dashboard-error" role="alert">
              {filterError}
            </p>
          )}
        </div>
      </section>

      {isLoading ? (
        <div className="freight-dashboard-loading" role="status">
          Carregando os indicadores…
        </div>
      ) : error ? (
        <div className="freight-dashboard-error" role="alert">
          <p>{error}</p>

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              setRequest((current) => ({
                ...current,
                revision: current.revision + 1,
              }))
            }
          >
            Tentar novamente
          </button>
        </div>
      ) : data && summary ? (
        <>
          <div className="freight-dashboard-context">
            <div>
              <strong>
                Exibindo: {getPeriodDescription(request.filters)}
              </strong>

              <span>
                {data.availableStartDate && data.availableEndDate
                  ? `Período com mudanças confirmadas: ${formatDate(
                      data.availableStartDate,
                    )} até ${formatDate(data.availableEndDate)}`
                  : "Ainda não há mudanças confirmadas no histórico."}
              </span>

              {request.filters.period === "latest" && (
                <span>
                  {data.latestRunCreatedAt
                    ? `Última análise salva em ${formatDateTime(
                        data.latestRunCreatedAt,
                      )}`
                    : "Nenhuma análise salva."}
                </span>
              )}
            </div>

            {updatedAt && (
              <span>Atualizado em {formatDateTime(updatedAt)}</span>
            )}
          </div>

          <DashboardResults summary={summary} />

          <p className="freight-dashboard-help">
            Os valores usam as cotações preservadas na análise e a sua
            confirmação da mudança. Não representam conferência da
            cobrança efetiva da transportadora.
          </p>
        </>
      ) : null}
    </div>
  );
}