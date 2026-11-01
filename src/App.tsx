import { useState } from "react";

const pages = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Acompanhe os resultados das análises de frete.",
  },
  {
    id: "simulation",
    label: "Nova simulação",
    description: "Compare as opções de transporte para suas remessas.",
  },
  {
    id: "validations",
    label: "Validações",
    description: "Confirme quais recomendações foram aplicadas.",
  },
  {
    id: "history",
    label: "Histórico",
    description: "Consulte as análises e os resultados anteriores.",
  },
  {
    id: "tables",
    label: "Tabelas de frete",
    description: "Gerencie as tarifas e a base de materiais.",
  },
] as const;

type PageId = (typeof pages)[number]["id"];

type AppProps = {
  role: "admin" | "employee";
};

const indicators = [
  {
    label: "Remessas analisadas",
    detail: "Quantidade de remessas no período",
  },
  {
    label: "Custo original",
    detail: "Frete calculado na transportadora atual",
  },
  {
    label: "Economia potencial",
    detail: "Economia identificada nas simulações",
  },
  {
    label: "Economia realizada",
    detail: "Economia com aplicação confirmada",
  },
];

export default function App({ role }: AppProps) {
  const [activePage, setActivePage] = useState<PageId>("dashboard");

  const visiblePages = pages.filter(
    (page) => page.id !== "tables" || role === "admin",
  );

  const currentPage =
    visiblePages.find((page) => page.id === activePage) ?? pages[0];

  const isDashboard = currentPage.id === "dashboard";

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-symbol" aria-hidden="true">
            F
          </span>

          <div>
            <strong>Frete</strong>
            <span>Simulação e economia</span>
          </div>
        </div>

        <p className="nav-label">ÁREA DE TRABALHO</p>

        <nav className="navigation" aria-label="Menu principal">
          {visiblePages.map((page) => (
            <button
              key={page.id}
              type="button"
              className={
                currentPage.id === page.id
                  ? "nav-item active"
                  : "nav-item"
              }
              aria-current={
                currentPage.id === page.id ? "page" : undefined
              }
              onClick={() => setActivePage(page.id)}
            >
              {page.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <strong>Simulador de Frete</strong>
          <span>Versão em desenvolvimento</span>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <span>Gestão de transportes</span>
          <span className="preview-badge">Prévia da interface</span>
        </header>

        <main className="main-content">
          <div className="page-heading">
            <div>
              <p className="eyebrow">SIMULADOR DE FRETE</p>
              <h1>{currentPage.label}</h1>
              <p className="page-description">
                {currentPage.description}
              </p>
            </div>

            {isDashboard && (
              <button
                type="button"
                className="primary-button"
                onClick={() => setActivePage("simulation")}
              >
                Nova simulação
              </button>
            )}
          </div>

          <div className="development-notice">
            Sistema em desenvolvimento. As simulações, as tarifas e os
            indicadores ainda não estão disponíveis para uso operacional.
          </div>

          {isDashboard ? (
            <>
              <section
                className="indicator-grid"
                aria-label="Indicadores de frete"
              >
                {indicators.map((indicator) => (
                  <article
                    className="indicator-card"
                    key={indicator.label}
                  >
                    <h2>{indicator.label}</h2>
                    <strong className="indicator-value">—</strong>
                    <p>{indicator.detail}</p>
                  </article>
                ))}
              </section>

              <section className="panel">
                <div className="panel-heading">
                  <h2>Resultados das simulações</h2>
                  <span>Visão geral</span>
                </div>

                <div className="empty-state">
                  <div className="empty-symbol" aria-hidden="true">
                    ≡
                  </div>

                  <h3>Seus resultados aparecerão aqui</h3>

                  <p>
                    Após a integração, você poderá acompanhar os custos,
                    as recomendações e a economia confirmada.
                  </p>
                </div>
              </section>

              <section className="explanation-grid">
                <article className="explanation-card">
                  <h2>Economia potencial</h2>

                  <p>
                    Diferença entre o custo original e a melhor opção
                    elegível encontrada pelo simulador.
                  </p>
                </article>

                <article className="explanation-card">
                  <h2>Economia realizada</h2>

                  <p>
                    Considera somente as recomendações cuja aplicação
                    foi confirmada pela operação.
                  </p>
                </article>
              </section>
            </>
          ) : (
            <section className="panel">
              <div className="empty-state">
                <h2>{currentPage.label}</h2>

                <p>
                  Esta área será implementada nas próximas etapas.
                </p>

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setActivePage("dashboard")}
                >
                  Voltar ao dashboard
                </button>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}