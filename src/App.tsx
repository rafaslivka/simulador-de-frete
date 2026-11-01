import { useState } from "react";
import NewSimulation from "./NewSimulation";
import FreightTables from "./FreightTables";
import FreightHistory from "./FreightHistory";
import FreightValidations from "./FreightValidations";

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
    description: "Registre e consulte suas decisões por remessa.",
  },
  {
    id: "history",
    label: "Histórico",
    description: "Consulte as análises, cotações e decisões salvas.",
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

function DashboardOverview() {
  return (
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
          <h3>Indicadores ainda não conectados</h3>

          <p>
            As análises salvas já podem ser consultadas no Histórico.
            Os indicadores desta página ainda não consultam esses
            registros.
          </p>
        </div>
      </section>

      <section className="explanation-grid">
        <article className="explanation-card">
          <h2>Economia potencial</h2>

          <p>
            Diferença entre o frete calculado na transportadora atual
            e a melhor opção elegível encontrada na simulação.
          </p>
        </article>

        <article className="explanation-card">
          <h2>Economia realizada</h2>

          <p>
            Considera somente as mudanças que você confirmou ter
            realizado.
          </p>
        </article>
      </section>
    </>
  );
}

export default function App({ role }: AppProps) {
  const [activePage, setActivePage] =
    useState<PageId>("dashboard");

  const visiblePages = pages.filter(
    (page) => page.id !== "tables" || role === "admin",
  );

  const currentPage =
    visiblePages.find((page) => page.id === activePage) ?? pages[0];

  function renderPage() {
    switch (currentPage.id) {
      case "dashboard":
        return <DashboardOverview />;

      case "simulation":
        return <NewSimulation />;

      case "validations":
        return <FreightValidations />;

      case "history":
        return <FreightHistory />;

      case "tables":
        return role === "admin" ? <FreightTables /> : null;
    }
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-symbol" aria-hidden="true">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 18h5l4-6h7" />
              <path d="m16 8 4 4-4 4" />
              <path d="M4 6h5" />
              <path d="M4 10h3" />
            </svg>
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
          <strong>Buiatte Armazéns</strong>
          <span>CD Extrema · Gestão de fretes</span>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <span>Gestão de transportes</span>
          <span>CD Extrema</span>
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

            {currentPage.id === "dashboard" && (
              <button
                type="button"
                className="primary-button"
                onClick={() => setActivePage("simulation")}
              >
                Nova simulação
              </button>
            )}
          </div>

          {renderPage()}
        </main>
      </div>
    </div>
  );
}