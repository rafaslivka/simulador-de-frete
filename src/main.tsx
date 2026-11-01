import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AuthGate from "./AuthGate";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Elemento principal da página não encontrado.");
}

createRoot(rootElement).render(
  <StrictMode>
    <AuthGate>
      {(profile) => <App role={profile.role} />}
    </AuthGate>
  </StrictMode>,
);