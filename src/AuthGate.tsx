import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";

type Profile = {
  id: string;
  display_name: string;
  role: "admin" | "employee";
};

type AuthGateProps = {
  children: (profile: Profile) => ReactNode;
};

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-logo" aria-hidden="true">
          F
        </div>

        <p className="eyebrow">SIMULADOR DE FRETE</p>
        <h1>Acesse sua conta</h1>
        <p className="auth-description">
          Entre para consultar e comparar as opções de transporte.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="seu@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="login-password">Senha</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading}
              required
            />
          </div>

          {message && (
            <p className="auth-error" role="alert">
              {message}
            </p>
          )}

          <button
            type="submit"
            className="primary-button auth-submit"
            disabled={loading}
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="auth-footer">
          Acesso exclusivo para usuários cadastrados.
        </p>
      </section>
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
          display_name: data.display_name,
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
    <>
      <div className="account-bar">
        <span>
          {profile
            ? `${profile.display_name} · ${
                profile.role === "admin" ? "Administrador" : "Funcionários"
              }`
            : "Verificando acesso"}
        </span>

        <button
          type="button"
          className="account-signout"
          onClick={() => void handleSignOut()}
          disabled={leaving}
        >
          {leaving ? "Saindo..." : "Sair"}
        </button>
      </div>

      {logoutError && (
        <p className="auth-error account-message" role="alert">
          {logoutError}
        </p>
      )}

      {profileError && (
        <main className="auth-page">
          <section className="auth-card">
            <h1>Acesso indisponível</h1>
            <p className="auth-error" role="alert">
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
        <div className="auth-loading" role="status">
          Carregando seu perfil...
        </div>
      )}

      {!profileError && profile && children(profile)}
    </>
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
      <div className="auth-loading" role="status">
        Verificando sessão...
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