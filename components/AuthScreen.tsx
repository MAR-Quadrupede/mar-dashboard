"use client";

import React, { useState, FormEvent } from "react";
import { Lock, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";

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
      setLocalError("Inserisci identificativo operatore");
      return;
    }
    if (!password) {
      setLocalError("Inserisci chiave di accesso");
      return;
    }

    try {
      await onLogin(username.trim(), password);
    } catch (err: any) {
      setLocalError(err.message || "Autenticazione fallita");
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
        padding: 16,
        background: "var(--bg-app)"
      }}
    >
      <div
        className="panel"
        style={{
          width: "100%",
          maxWidth: 360
        }}
      >
        <div className="panel-header">
          <div className="panel-title">
            <Lock size={12} />
            <span>AUTENTICAZIONE OPERATORE</span>
          </div>
          <span className="tag mono">V2.0</span>
        </div>

        <div className="panel-body" style={{ padding: 16 }}>
          <div style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)", letterSpacing: "0.04em" }}>
              M.A.R. MK-1 TELEOP
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Accesso riservato alla console di teleoperazione
            </div>
          </div>

          {displayError && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 8px",
                background: "var(--color-danger-bg)",
                border: "1px solid var(--color-danger-border)",
                borderRadius: "var(--radius-xs)",
                fontSize: 11,
                color: "var(--color-danger)"
              }}
            >
              <AlertCircle size={13} />
              <span>{displayError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                Identificativo Operatore
              </label>
              <input
                className="input mono"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                autoComplete="username"
                disabled={loading}
                required
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <label style={{ fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
                Chiave di Accesso
              </label>
              <input
                className="input mono"
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
              style={{ marginTop: 4, padding: "8px 12px" }}
            >
              {loading ? (
                <span>Verifica credenziali...</span>
              ) : (
                <>
                  <span>Connetti Console</span>
                  <ArrowRight size={13} />
                </>
              )}
            </button>
          </form>

          <div
            className="mono"
            style={{
              textAlign: "center",
              fontSize: 10,
              color: "var(--text-dim)",
              borderTop: "1px solid var(--border-subtle)",
              paddingTop: 8,
              marginTop: 4
            }}
          >
            SISTEMA ANTI-COLLISIONE CONCORRENZA ATTIVO
          </div>
        </div>
      </div>
    </div>
  );
}
