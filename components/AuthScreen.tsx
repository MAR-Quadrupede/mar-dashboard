"use client";

import React, { useState, FormEvent } from "react";
import { Lock, User, AlertCircle, ArrowRight } from "lucide-react";

type Props = {
  onLogin: (username: string, password: string) => Promise<void>;
  loading?: boolean;
  error?: string | null;
};

export function AuthScreen({ onLogin, loading, error }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!username.trim()) {
      setLocalError("Inserisci l'username");
      return;
    }
    if (!password) {
      setLocalError("Inserisci la password");
      return;
    }

    try {
      await onLogin(username.trim(), password);
    } catch (err: any) {
      setLocalError(err.message || "Errore di accesso");
    }
  };

  const displayError = localError || error;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16
      }}
    >
      <div
        className="card"
        style={{
          width: "100%",
          maxWidth: 380,
          padding: 24,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
        }}
      >
        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-main)" }}>
            M.A.R. Console
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            Accesso alla piattaforma di teleoperazione
          </div>
        </div>

        {displayError && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              background: "var(--color-danger-bg)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "var(--radius-sm)",
              fontSize: 12,
              color: "#fca5a5"
            }}
          >
            <AlertCircle size={15} />
            <span>{displayError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
              Username
            </label>
            <input
              className="input"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="username"
              disabled={loading}
              required
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)" }}>
              Password
            </label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={loading}
              required
            />
          </div>

          <button
            className="btn btn-primary"
            type="submit"
            disabled={loading}
            style={{ marginTop: 6, padding: "9px 14px" }}
          >
            {loading ? (
              <span>Autenticazione...</span>
            ) : (
              <>
                <span>Accedi</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: "center", fontSize: 11, color: "var(--text-muted)", marginTop: 12 }}>
          Accesso protetto • Concorrenza operatore singolo abilitata
        </div>
      </div>
    </div>
  );
}
