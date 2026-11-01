import { useState } from "react";
import {
  FREIGHT_DECISION_LABELS,
  getFreightShipmentDecisions,
  getFreightSimulationShipments,
  saveFreightShipmentDecision,
  saveFreightSimulation,
} from "./lib/freightSimulations";
import type {
  FreightDecisionStatus,
  FreightShipmentDecision,
  SavedFreightShipment,
  SaveFreightSimulationInput,
} from "./lib/freightSimulations";
import "./SimulationDecisions.css";

const PAGE_SIZE = 25;

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type Props = {
  input: SaveFreightSimulationInput;
};

type DecisionFormProps = {
  shipment: SavedFreightShipment;
  decision: FreightShipmentDecision;
  onSaved: (decision: FreightShipmentDecision) => void;
};

function DecisionForm({
  shipment,
  decision,
  onSaved,
}: DecisionFormProps) {
  const [status, setStatus] =
    useState<FreightDecisionStatus>(decision.status);
  const [note, setNote] = useState(decision.note);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  const differentAnalysis =
    decision.simulation_shipment_id !== shipment.id;

  const hasChanges =
    status !== decision.status ||
    note.trim() !== decision.note ||
    differentAnalysis;

  async function handleSave() {
    if (isSaving || !hasChanges) {
      return;
    }

    let confirmation: string;

    if (status === "applied") {
      confirmation =
        `Você confirma que realizou a mudança da remessa ` +
        `${shipment.shipment_code} de ${shipment.current_carrier} ` +
        `para ${shipment.suggested_carrier}?\n\n` +
        `Economia calculada: ${money.format(
          shipment.potential_savings,
        )}.\n\n` +
        `Essa confirmação será usada nos indicadores de economia realizada.`;
    } else if (status === "not_applied") {
      confirmation =
        `Registrar que você NÃO realizou a mudança da remessa ` +
        `${shipment.shipment_code}?\n\n` +
        `Ela não contabilizará economia realizada.`;
    } else {
      confirmation =
        `Devolver a remessa ${shipment.shipment_code} para pendente?\n\n` +
        `Ela não contabilizará economia realizada enquanto estiver pendente.`;
    }

    if (differentAnalysis) {
      confirmation +=
        "\n\nA decisão existente usa outra análise. Ao salvar, " +
        "ela passará a usar os valores desta análise, sem duplicar a remessa.";
    }

    if (!window.confirm(confirmation)) {
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const saved = await saveFreightShipmentDecision({
        simulationShipmentId: shipment.id,
        status,
        expectedRevision: decision.revision,
        note,
      });

      onSaved({
        ...decision,
        ...saved,
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível registrar a decisão.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <details className="decision-item">
      <summary>
        <div>
          <strong>Remessa {shipment.shipment_code}</strong>
          <span>
            {shipment.current_carrier}
            {" → "}
            {shipment.suggested_carrier}
          </span>
        </div>

        <div className="decision-item-summary">
          <strong className="decision-saving">
            {money.format(shipment.potential_savings)}
          </strong>

          <span className={`decision-status ${decision.status}`}>
            {FREIGHT_DECISION_LABELS[decision.status]}
          </span>
        </div>
      </summary>

      <div className="decision-item-body">
        <div className="decision-costs">
          <div>
            <span>Frete atual calculado</span>
            <strong>
              {shipment.current_cost === null
                ? "Sem cotação"
                : money.format(shipment.current_cost)}
            </strong>
          </div>

          <div>
            <span>Frete sugerido calculado</span>
            <strong>
              {shipment.suggested_cost === null
                ? "Sem cotação"
                : money.format(shipment.suggested_cost)}
            </strong>
          </div>

          <div>
            <span>Economia potencial</span>
            <strong>
              {money.format(shipment.potential_savings)}
            </strong>
          </div>
        </div>

        {differentAnalysis && (
          <p className="decision-existing-note">
            Esta remessa já possui uma decisão vinculada a outra
            análise. Os valores acima pertencem à análise atual.
            A decisão anterior só será substituída se você salvar.
          </p>
        )}

        <div className="decision-fields">
          <label>
            Sua decisão
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as FreightDecisionStatus)
              }
              disabled={isSaving}
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
              onChange={(event) => setNote(event.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="Registre uma observação, se necessário."
              disabled={isSaving}
            />
          </label>
        </div>

        {error && (
          <p className="decision-error" role="alert">
            {error}
          </p>
        )}

        <div className="decision-item-actions">
          <span>
            {decision.decided_at
              ? `Decisão registrada em ${new Date(
                  decision.decided_at,
                ).toLocaleString("pt-BR")}`
              : "Aguardando sua decisão."}
          </span>

          <button
            type="button"
            className="primary-button"
            onClick={() => void handleSave()}
            disabled={isSaving || !hasChanges}
          >
            {isSaving ? "Salvando…" : "Salvar decisão"}
          </button>
        </div>
      </div>
    </details>
  );
}

export default function SimulationDecisions({ input }: Props) {
  const [runId, setRunId] = useState<string | null>(null);
  const [shipments, setShipments] = useState<SavedFreightShipment[]>([]);
  const [decisions, setDecisions] = useState<FreightShipmentDecision[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [refreshVersion, setRefreshVersion] = useState(0);

  async function loadSavedData(savedRunId: string) {
    const [savedShipments, savedDecisions] = await Promise.all([
      getFreightSimulationShipments(savedRunId),
      getFreightShipmentDecisions(),
    ]);

    if (savedShipments.length !== input.calculations.length) {
      throw new Error(
        "A consulta não retornou todas as remessas da análise. " +
          "Clique em Atualizar decisões para consultar novamente.",
      );
    }

    setShipments(savedShipments);
    setDecisions(savedDecisions);
    setIsLoaded(true);
    setRefreshVersion((value) => value + 1);
  }

  async function handleSaveAnalysis() {
    if (isBusy) {
      return;
    }

    setIsBusy(true);
    setError("");
    setMessage("");

    let savedRunId = runId;

    try {
      if (!savedRunId) {
        savedRunId = await saveFreightSimulation(input);
        setRunId(savedRunId);
      }

      await loadSavedData(savedRunId);

      setMessage(
        "Análise salva. As decisões podem ser registradas abaixo.",
      );
    } catch (saveError) {
      const detail =
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível concluir a operação.";

      setError(
        savedRunId
          ? `A análise foi salva, mas houve um problema ao carregar os registros. ${detail}`
          : detail,
      );
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRefresh() {
    if (!runId || isBusy) {
      return;
    }

    setIsBusy(true);
    setError("");
    setMessage("");

    try {
      await loadSavedData(runId);
      setMessage("Decisões atualizadas.");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Não foi possível atualizar as decisões.",
      );
    } finally {
      setIsBusy(false);
    }
  }

  function handleDecisionSaved(saved: FreightShipmentDecision) {
    setDecisions((current) => {
      const exists = current.some((item) => item.id === saved.id);

      return exists
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [...current, saved];
    });

    setMessage(
      `Remessa ${saved.shipment_code}: ${
        FREIGHT_DECISION_LABELS[saved.status]
      }.`,
    );
  }

  const decisionsByShipment = new Map(
    decisions.map((decision) => [
      decision.shipment_code,
      decision,
    ]),
  );

  const opportunities = shipments
    .filter((shipment) => shipment.potential_savings > 0)
    .sort(
      (a, b) =>
        b.potential_savings - a.potential_savings ||
        a.shipment_code.localeCompare(b.shipment_code),
    );

  const filtered = opportunities.filter((shipment) =>
    shipment.shipment_code.includes(search.trim()),
  );

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / PAGE_SIZE),
  );

  const currentPage = Math.min(page, totalPages);

  const visible = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Salvar análise e registrar mudanças</h2>
        <span>{runId ? "Análise salva" : "Ainda não salva"}</span>
      </div>

      <div className="simulation-body">
        <p className="simulation-instructions">
          Salve a análise para preservar os itens, as cotações e as
          versões das tabelas utilizadas. Marque “Fiz a mudança”
          somente quando tiver realizado a troca de transportadora.
        </p>

        <div className="simulation-actions">
          {!runId ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => void handleSaveAnalysis()}
              disabled={isBusy}
            >
              {isBusy ? "Salvando…" : "Salvar análise"}
            </button>
          ) : (
            <button
              type="button"
              className="secondary-button"
              onClick={() => void handleRefresh()}
              disabled={isBusy}
            >
              {isBusy ? "Atualizando…" : "Atualizar decisões"}
            </button>
          )}
        </div>

        {!runId && (
          <p className="simulation-help">
            Se a gravação falhar, tente novamente nesta mesma tela.
            A tentativa reutiliza o identificador da análise.
          </p>
        )}

        {error && (
          <p className="decision-error" role="alert">
            {error}
          </p>
        )}

        {message && (
          <p className="decision-success" role="status">
            {message}
          </p>
        )}

        {isLoaded && opportunities.length === 0 && (
          <div className="decision-empty">
            <strong>Análise salva sem oportunidades de economia.</strong>
            <p>
              As {shipments.length} remessas foram armazenadas.
              Não há troca com economia positiva para confirmar.
            </p>
          </div>
        )}

        {isLoaded && opportunities.length > 0 && (
          <>
            <div className="decision-toolbar">
              <strong>
                {opportunities.length} oportunidade(s) nesta análise
              </strong>

              <label>
                Buscar remessa
                <input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setPage(1);
                  }}
                  placeholder="Número da remessa"
                />
              </label>
            </div>

            <p className="simulation-help">
              As decisões são individuais. Salvar uma remessa não
              confirma nem rejeita as demais.
            </p>

            <div className="decision-list" aria-busy={isBusy}>
              {isBusy ? (
                <p role="status">Atualizando registros…</p>
              ) : (
                visible.map((shipment) => {
                  const decision = decisionsByShipment.get(
                    shipment.shipment_code,
                  );

                  if (!decision) {
                    return (
                      <p
                        key={shipment.id}
                        className="decision-error"
                        role="alert"
                      >
                        A decisão da remessa {shipment.shipment_code}
                        {" "}não foi carregada. Clique em Atualizar decisões.
                      </p>
                    );
                  }

                  return (
                    <DecisionForm
                      key={`${shipment.id}-${decision.revision}-${refreshVersion}`}
                      shipment={shipment}
                      decision={decision}
                      onSaved={handleDecisionSaved}
                    />
                  );
                })
              )}

              {!isBusy && filtered.length === 0 && (
                <p>Nenhuma remessa encontrada nesta busca.</p>
              )}
            </div>

            <div className="freight-pagination">
              <span>
                {filtered.length} oportunidade(s)
              </span>

              <div className="freight-pagination-controls">
                <button
                  type="button"
                  className="secondary-button"
                  disabled={currentPage === 1 || isBusy}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Anterior
                </button>

                <span>
                  Página {currentPage} de {totalPages}
                </span>

                <button
                  type="button"
                  className="secondary-button"
                  disabled={currentPage >= totalPages || isBusy}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Próxima
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}