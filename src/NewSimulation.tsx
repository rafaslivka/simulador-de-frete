import { useState } from "react";
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
import type {
  CalculatedFreightShipment,
  FreightCalculationResult,
} from "./utils/calculateFreight";
import { getActiveFreightDatasets } from "./lib/freightDatasets";
import "./NewSimulation.css";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});

function formatMoney(value: number | null): string {
  return value === null ? "Sem cotação" : currencyFormatter.format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  })}%`;
}

export default function NewSimulation() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ShipmentReadResult | null>(null);
  const [calculation, setCalculation] =
    useState<FreightCalculationResult | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationError, setCalculationError] = useState("");

  const normalization =
    result?.success ? normalizeShipments(result.items) : null;

  function handleTextChange(value: string) {
    setText(value);
    setResult(null);
    setCalculation(null);
    setCalculationError("");
  }

  function handleCheck() {
    setResult(readShipments(text));
    setCalculation(null);
    setCalculationError("");
  }

  function handleClear() {
    setText("");
    setResult(null);
    setCalculation(null);
    setCalculationError("");
  }

  async function handleCalculateFreight() {
    if (!normalization?.success) {
      return;
    }

    setIsCalculating(true);
    setCalculation(null);
    setCalculationError("");

    try {
      const shipments = normalization.shipments;
      const activeDatasets = await getActiveFreightDatasets();
      const freightResult = calculateFreight(shipments, activeDatasets);

      setCalculation(freightResult);
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

  const totalInvoiceValue =
    normalization?.success
      ? normalization.shipments.reduce(
          (total, shipment) => total + shipment.invoiceValue,
          0,
        )
      : 0;

  const totalQuantity =
    normalization?.success
      ? normalization.shipments.reduce(
          (total, shipment) => total + shipment.quantity,
          0,
        )
      : 0;

  const calculatedShipments =
    calculation?.success ? calculation.shipments : [];

  const totalBestCost = calculatedShipments.reduce(
    (total, shipment) => total + (shipment.bestCost ?? 0),
    0,
  );

  const totalPotentialSavings = calculatedShipments.reduce(
    (total, shipment) => total + shipment.potentialSavings,
    0,
  );

  const shipmentsWithQuote = calculatedShipments.filter(
    (shipment) => shipment.bestCost !== null,
  ).length;

  function renderFreightRow(shipment: CalculatedFreightShipment) {
    return (
      <tr key={shipment.shipment}>
        <td>{shipment.shipment}</td>
        <td>
          {[shipment.city, shipment.uf].filter(Boolean).join(" / ") || "—"}
        </td>
        <td>{shipment.shipmentType}</td>
        <td>{formatMoney(shipment.invoiceValue)}</td>
        <td>{numberFormatter.format(shipment.realWeightKg)} kg</td>
        <td>{shipment.currentCarrier}</td>
        <td>{formatMoney(shipment.currentCost)}</td>
        <td>{shipment.bestCarrier ?? "Sem opção"}</td>
        <td>{formatMoney(shipment.bestCost)}</td>
        <td>{currencyFormatter.format(shipment.potentialSavings)}</td>
        <td>{formatPercent(shipment.potentialSavingsPercent)}</td>
        <td>{shipment.status}</td>
      </tr>
    );
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
            Copie as células do Excel incluindo a linha de cabeçalhos
            e cole abaixo. As colunas podem estar em outra ordem.
            Cabeçalhos repetidos podem separar blocos de transportadoras.
          </p>

          <details className="simulation-columns">
            <summary>Ver as 15 colunas obrigatórias</summary>

            <ol>
              {REQUIRED_HEADERS.map((header) => (
                <li key={header}>{header}</li>
              ))}
            </ol>
          </details>

          <label className="simulation-label" htmlFor="shipment-paste">
            Cole os dados aqui
          </label>

          <textarea
            id="shipment-paste"
            className="simulation-input"
            value={text}
            onChange={(event) => handleTextChange(event.target.value)}
            placeholder="Cole os cabeçalhos e as linhas copiadas do Excel..."
            spellCheck={false}
            aria-describedby="shipment-paste-help"
          />

          <p id="shipment-paste-help" className="simulation-help">
            Esta conferência é temporária. Ao sair desta tela ou
            atualizar a página, os dados colados serão descartados.
          </p>

          <div className="simulation-actions">
            <button
              type="button"
              className="primary-button"
              onClick={handleCheck}
              disabled={!text.trim()}
            >
              Conferir dados
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={handleClear}
              disabled={!text && !result}
            >
              Limpar
            </button>
          </div>
        </div>
      </section>

      {result && !result.success && (
        <section className="simulation-errors" role="alert">
          <h2>Revise os dados colados</h2>

          <p>
            A leitura encontrou {result.errors.length} problema(s).
            Corrija os dados e confira novamente.
          </p>

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

      {result?.success && normalization && !normalization.success && (
        <section className="simulation-errors" role="alert">
          <h2>Revise preços, quantidades e datas</h2>

          <p>
            A leitura dos cabeçalhos e das linhas passou, mas a
            conferência dos valores encontrou{" "}
            {normalization.errors.length} problema(s).
          </p>

          <ul>
            {normalization.errors.slice(0, 30).map((error, index) => (
              <li key={`${index}-${error}`}>{error}</li>
            ))}
          </ul>

          {normalization.errors.length > 30 && (
            <p>Mostrando os primeiros 30 problemas.</p>
          )}
        </section>
      )}

      {result?.success && normalization?.success && (
        <>
          <section
            className="simulation-summary"
            aria-label="Resumo da conferência"
            role="status"
          >
            <article>
              <span>Remessas distintas</span>
              <strong>{normalization.shipments.length}</strong>
            </article>

            <article>
              <span>Linhas de itens</span>
              <strong>{normalization.items.length}</strong>
            </article>

            <article>
              <span>Valor total das remessas</span>
              <strong>{currencyFormatter.format(totalInvoiceValue)}</strong>
            </article>
          </section>

          <div className="simulation-success">
            <p>
              Dados lidos e normalizados. Quantidade total considerada:{" "}
              {totalQuantity.toLocaleString("pt-BR")}.
            </p>

            <p>
              O valor total soma o campo “Preço Crédito” de cada linha,
              sem multiplicá-lo novamente pela quantidade.
            </p>

            {normalization.warnings.length > 0 && (
              <>
                <p>Avisos encontrados:</p>
                <ul>
                  {normalization.warnings.slice(0, 20).map((warning, index) => (
                    <li key={`${index}-${warning}`}>{warning}</li>
                  ))}
                </ul>

                {normalization.warnings.length > 20 && (
                  <p>Mostrando os primeiros 20 avisos.</p>
                )}
              </>
            )}

            <div className="simulation-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => void handleCalculateFreight()}
                disabled={isCalculating}
              >
                {isCalculating ? "Calculando fretes…" : "Calcular frete"}
              </button>
            </div>
          </div>

          {calculationError && (
            <section className="simulation-errors" role="alert">
              <h2>Não foi possível calcular o frete</h2>
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
                role="status"
              >
                <article>
                  <span>Remessas com opção de frete</span>
                  <strong>
                    {shipmentsWithQuote} / {calculatedShipments.length}
                  </strong>
                </article>

                <article>
                  <span>Total da melhor opção</span>
                  <strong>{currencyFormatter.format(totalBestCost)}</strong>
                </article>

                <article>
                  <span>Economia potencial</span>
                  <strong>
                    {currencyFormatter.format(totalPotentialSavings)}
                  </strong>
                </article>
              </section>

              {calculation.warnings.length > 0 && (
                <section className="simulation-errors" role="status">
                  <h2>Avisos do cálculo</h2>
                  <ul>
                    {calculation.warnings.slice(0, 30).map((warning, index) => (
                      <li key={`${index}-${warning}`}>{warning}</li>
                    ))}
                  </ul>

                  {calculation.warnings.length > 30 && (
                    <p>Mostrando os primeiros 30 avisos.</p>
                  )}
                </section>
              )}

              <section className="panel">
                <div className="panel-heading">
                  <h2>Comparação de frete por remessa</h2>
                  <span>{calculatedShipments.length} remessa(s)</span>
                </div>

                <div className="simulation-body">
                  <p className="simulation-instructions">
                    A melhor opção considera as transportadoras elegíveis
                    encontradas nas tabelas ativas. Confira os motivos de
                    cada cotação abaixo dos resultados.
                  </p>

                  <div className="shipment-table-wrap">
                    <table className="shipment-table">
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
                          <th scope="col">Economia</th>
                          <th scope="col">Economia %</th>
                          <th scope="col">Recomendação</th>
                        </tr>
                      </thead>

                      <tbody>
                        {calculatedShipments.map(renderFreightRow)}
                      </tbody>
                    </table>
                  </div>

                  <div className="shipment-list">
                    {calculatedShipments.map((shipment) => (
                      <details
                        className="shipment-detail"
                        key={`quotes-${shipment.shipment}`}
                      >
                        <summary>
                          <span>
                            Cotações da remessa {shipment.shipment}
                          </span>
                          <span className="shipment-count">
                            {shipment.status}
                          </span>
                        </summary>

                        <div className="shipment-table-wrap">
                          <table className="shipment-table">
                            <thead>
                              <tr>
                                <th scope="col">Transportadora</th>
                                <th scope="col">Frete calculado</th>
                                <th scope="col">Observação</th>
                              </tr>
                            </thead>

                            <tbody>
                              {FREIGHT_CARRIERS.map((carrier) => {
                                const quote = shipment.quotes.find(
                                  (item) => item.carrier === carrier,
                                );

                                return (
                                  <tr key={`${shipment.shipment}-${carrier}`}>
                                    <td>{carrier}</td>
                                    <td>{formatMoney(quote?.cost ?? null)}</td>
                                    <td>
                                      {quote?.reason ?? "Cotação não disponível."}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </details>
                    ))}
                  </div>
                </div>
              </section>
            </>
          )}

          <section className="panel">
            <div className="panel-heading">
              <h2>Prévia das remessas lidas</h2>
              <span>Dados de entrada</span>
            </div>

            <div className="simulation-body">
              <p className="simulation-instructions">
                Esta prévia mostra os itens reconhecidos na colagem.
              </p>

              <div className="shipment-list">
                {normalization.shipments.slice(0, 50).map((group) => (
                  <details
                    className="shipment-detail"
                    key={`input-${group.shipment}`}
                  >
                    <summary>
                      <span>Remessa {group.shipment}</span>
                      <span className="shipment-count">
                        {group.items.length} linha(s) ·{" "}
                        {currencyFormatter.format(group.invoiceValue)}
                      </span>
                    </summary>

                    <div className="shipment-table-wrap">
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
                          {group.items.slice(0, 20).map((item) => (
                            <tr key={item.sourceRow}>
                              <td>{item.sourceRow}</td>
                              <td>{item.creationDate}</td>
                              <td>{item.material}</td>
                              <td>
                                {item.original.values["Denominação de item"]}
                              </td>
                              <td>
                                {item.quantity.toLocaleString("pt-BR")}
                              </td>
                              <td>
                                {currencyFormatter.format(item.invoiceValue)}
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

                    {group.items.length > 20 && (
                      <p className="shipment-preview-note">
                        Mostrando os primeiros 20 itens desta remessa.
                      </p>
                    )}
                  </details>
                ))}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}