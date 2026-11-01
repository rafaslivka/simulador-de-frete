import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import "./AuthGate.css";

type Profile = {
  id: string;
  display_name: string;
  role: "admin" | "employee";
};

type AuthGateProps = {
  children: (profile: Profile) => ReactNode;
};

function FreightMark() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 18h5l4-6h7" />
      <path d="m16 8 4 4-4 4" />
      <path d="M4 6h5" />
      <path d="M4 10h3" />
    </svg>
  );
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? "";
  const last =
    parts.length > 1
      ? parts[parts.length - 1]?.charAt(0) ?? ""
      : "";

  return `${first}${last}`.toUpperCase() || "U";
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setMessage(
          "Não foi possível entrar. Confira o e-mail e a senha e tente novamente.",
        );
      }
    } catch {
      setMessage(
        "Não foi possível conectar. Verifique sua internet e tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="freight-login-page">
      <div className="freight-login-shell">
        <section
          className="freight-login-visual"
          aria-label="Simulador de Frete"
        >
          <div className="freight-login-brand">
            <span className="freight-login-mark">
              <FreightMark />
            </span>

            <div>
              <strong>Simulador de Frete</strong>
              <span>Simulação e economia</span>
            </div>
          </div>

          <div className="freight-login-intro">
            <span className="freight-login-eyebrow">
              GESTÃO DE TRANSPORTES · CD EXTREMA
            </span>

            <h2>
              Clareza nos custos.
              <br />
              Controle nas decisões.
            </h2>

            <p>
              Compare as opções de transporte, registre suas escolhas
              e acompanhe a economia das mudanças realizadas.
            </p>
          </div>

          <div className="freight-login-glass">
            <div className="freight-login-glass-heading">
              <span className="freight-login-dot" aria-hidden="true" />
              <span>Da análise ao resultado</span>
              <FreightMark />
            </div>

            <div className="freight-login-steps">
              <div>
                <span>01</span>
                <div>
                  <strong>Compare</strong>
                  <p>Custos por remessa e transportadora.</p>
                </div>
              </div>

              <div>
                <span>02</span>
                <div>
                  <strong>Decida</strong>
                  <p>Você confirma as mudanças realizadas.</p>
                </div>
              </div>

              <div>
                <span>03</span>
                <div>
                  <strong>Acompanhe</strong>
                  <p>Resultados e histórico em um só lugar.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="freight-login-visual-footer">
            <span>GESTÃO DE TRANSPORTES</span>
            <span>EXTREMA · MG</span>
          </div>
        </section>

        <section
          className="freight-login-form-panel"
          aria-labelledby="login-title"
        >
          <div className="freight-login-form-content">
            <span className="freight-login-access-label">
              ACESSO À PLATAFORMA
            </span>

            <h1 id="login-title">Bem-vindo de volta.</h1>

            <p className="freight-login-description">
              Entre com sua conta para acessar o simulador.
            </p>

            <form
              className="freight-login-form"
              onSubmit={handleSubmit}
              aria-busy={loading}
            >
              <div className="freight-login-field">
                <label htmlFor="login-email">E-mail</label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="freight-login-field">
                <label htmlFor="login-password">Senha</label>

                <div className="freight-login-password">
                  <input
                    id="login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={loading}
                    required
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    disabled={loading}
                    aria-label={
                      showPassword ? "Ocultar senha" : "Mostrar senha"
                    }
                    aria-pressed={showPassword}
                    aria-controls="login-password"
                  >
                    {showPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>

              {message && (
                <p className="freight-auth-error" role="alert">
                  {message}
                </p>
              )}

              <button
                type="submit"
                className="freight-login-submit"
                disabled={loading}
              >
                <span>
                  {loading ? "Entrando…" : "Entrar na plataforma"}
                </span>
                <span aria-hidden="true">→</span>
              </button>
            </form>

            <p className="freight-login-support">
              Precisa de acesso ou ajuda com sua senha?
              <br />
              Entre em contato com o administrador.
            </p>
          </div>

          <footer className="freight-login-form-footer">
            <span>Simulador de Frete</span>
            <span>Acesso para usuários cadastrados</span>
          </footer>
        </section>
      </div>
    </main>
  );
}

function ProfileAccess({
  session,
  children,
}: AuthGateProps & { session: Session }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState("");
  const [logoutError, setLogoutError] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function loadProfile() {
      setProfile(null);
      setProfileError("");

      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, display_name, role")
          .eq("id", session.user.id)
          .abortSignal(controller.signal)
          .single();

        if (cancelled) return;

        if (
          error ||
          !data ||
          (data.role !== "admin" && data.role !== "employee")
        ) {
          setProfileError(
            "Não foi possível carregar seu perfil de acesso. Tente novamente ou contate o administrador.",
          );
          return;
        }

        setProfile({
          id: data.id,
          display_name: data.display_name?.trim() || "Usuário",
          role: data.role,
        });
      } catch {
        if (!cancelled) {
          setProfileError(
            "Falha de conexão ao consultar seu perfil. Tente novamente.",
          );
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [session.user.id, attempt]);

  async function handleSignOut() {
    if (leaving) return;

    setLeaving(true);
    setLogoutError("");

    try {
      const { error } = await supabase.auth.signOut({
        scope: "local",
      });

      if (error) {
        setLogoutError("Não foi possível sair. Tente novamente.");
      }
    } catch {
      setLogoutError("Falha de conexão ao sair. Tente novamente.");
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="freight-authenticated">
      <header className="freight-account-header">
        <div className="freight-account-company">
          <span className="freight-account-company-mark">
            <FreightMark />
          </span>

          <div>
            <strong>Simulador de Frete</strong>
            <span>Simulação e economia</span>
          </div>
        </div>

        <div className="freight-account-actions">
          <div className="freight-account-person">
            <span className="freight-account-avatar" aria-hidden="true">
              {profile ? getInitials(profile.display_name) : "…"}
            </span>

            <div>
              <strong>
                {profile?.display_name ?? "Verificando acesso"}
              </strong>

              <span>
                {profile
                  ? profile.role === "admin"
                    ? "Administrador"
                    : "Colaborador"
                  : "Carregando perfil"}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="freight-account-signout"
            onClick={() => void handleSignOut()}
            disabled={leaving}
          >
            {leaving ? "Saindo…" : "Sair"}

            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 5H4v14h5" />
              <path d="M10 12h10" />
              <path d="m16 8 4 4-4 4" />
            </svg>
          </button>
        </div>
      </header>

      {logoutError && (
        <p
          className="freight-auth-error freight-account-error"
          role="alert"
        >
          {logoutError}
        </p>
      )}

      {profileError && (
        <main className="freight-auth-status-page">
          <section className="freight-auth-status-card">
            <span className="freight-login-mark">
              <FreightMark />
            </span>

            <h1>Acesso indisponível</h1>

            <p className="freight-auth-error" role="alert">
              {profileError}
            </p>

            <button
              type="button"
              className="primary-button"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Tentar novamente
            </button>
          </section>
        </main>
      )}

      {!profileError && !profile && (
        <div className="freight-auth-loading" role="status">
          <span className="freight-auth-spinner" aria-hidden="true" />
          Carregando seu perfil…
        </div>
      )}

      {!profileError && profile && children(profile)}
    </div>
  );
}

export default function AuthGate({ children }: AuthGateProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(
      (_event, currentSession) => {
        setSession(currentSession);
        setReady(true);
      },
    );

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  if (!ready) {
    return (
      <div className="freight-auth-loading" role="status">
        <span className="freight-auth-spinner" aria-hidden="true" />
        Verificando sessão…
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return (
    <ProfileAccess key={session.user.id} session={session}>
      {children}
    </ProfileAccess>
  );
}