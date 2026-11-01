import { useState } from "react";
import {
  REQUIRED_HEADERS,
  readShipments,
} from "./utils/readShipments";
import type { ShipmentReadResult } from "./utils/readShipments";
import "./NewSimulation.css";

export default function NewSimulation() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<ShipmentReadResult | null>(null);

  function handleTextChange(value: string) {
    setText(value);
    setResult(null);
  }

  function handleCheck() {
    setResult(readShipments(text));
  }

  function handleClear() {
    setText("");
    setResult(null);
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
            placeholder="Cole o cabeçalho e as linhas copiadas do Excel..."
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
            A conferência encontrou {result.errors.length} problema(s).
            Corrija os dados e confira novamente.
          </p>

          <ul>
            {result.errors.slice(0, 30).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>

          {result.errors.length > 30 && (
            <p>
              Mostrando os primeiros 30 problemas. Os demais serão
              apresentados conforme você corrigir os dados.
            </p>
          )}
        </section>
      )}

      {result?.success && (
        <>
          <section
            className="simulation-summary"
            aria-label="Resumo da conferência"
            role="status"
          >
            <article>
              <span>Cabeçalhos identificados</span>
              <strong>{REQUIRED_HEADERS.length}</strong>
            </article>

            <article>
              <span>Linhas de itens</span>
              <strong>{result.items.length}</strong>
            </article>

            <article>
              <span>Remessas distintas</span>
              <strong>{result.shipments.length}</strong>
            </article>
          </section>

          <div className="simulation-success">
            Estrutura conferida e itens agrupados por remessa.
            Valores, datas e regras de frete ainda não foram validados.
          </div>

          <section className="panel">
            <div className="panel-heading">
              <h2>Prévia das remessas</h2>
              <span>Sem cálculo de frete</span>
            </div>

            <div className="simulation-body">
              <p className="simulation-instructions">
                Abra uma remessa para conferir os itens. A quantidade
                de linhas não representa a soma de unidades ou volumes.
              </p>

              {result.shipments.length > 50 && (
                <p className="simulation-help">
                  Prévia limitada às primeiras 50 remessas.
                  O resumo acima considera todas as remessas lidas.
                </p>
              )}

              <div className="shipment-list">
                {result.shipments.slice(0, 50).map((group) => (
                  <details
                    className="shipment-detail"
                    key={group.shipment}
                  >
                    <summary>
                      <span>Remessa {group.shipment}</span>
                      <span className="shipment-count">
                        {group.items.length} linha(s)
                      </span>
                    </summary>

                    <div className="shipment-table-wrap">
                      <table className="shipment-table">
                        <caption>
                          Itens da remessa {group.shipment}
                        </caption>

                        <thead>
                          <tr>
                            <th scope="col">Linha</th>
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
                              <td>{item.values.Material}</td>
                              <td>
                                {item.values["Denominação de item"]}
                              </td>
                              <td>{item.values["Qtd.remessa"]}</td>
                              <td>{item.values["Preço Crédito"]}</td>
                              <td>
                                {[
                                  item.values.Cidade,
                                  item.values.Região,
                                ]
                                  .filter(Boolean)
                                  .join(" / ")}
                              </td>
                              <td>{item.values.Transportadora}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {group.items.length > 20 && (
                      <p className="shipment-preview-note">
                        Mostrando os primeiros 20 itens desta remessa.
                        Todos os itens foram mantidos na leitura.
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