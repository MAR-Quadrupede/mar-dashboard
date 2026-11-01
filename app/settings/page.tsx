"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { AuthScreen } from "@/components/AuthScreen";
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Edit3, 
  Lock, 
  Unlock, 
  Sliders, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  Network
} from "lucide-react";

type UserItem = {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
};

export default function SettingsPage() {
  const { token, user, loading: authLoading, error: authError, login, logout } = useAuth();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [lockStatus, setLockStatus] = useState<any>(null);
  const [settings, setSettings] = useState<any>({
    leftStreamUrl: "",
    rightStreamUrl: "",
    gatewayWsUrl: "",
    lockTimeoutSeconds: 35,
    criticalDistanceMeters: 0.35
  });

  const [showUserForm, setShowUserForm] = useState(false);
  const [formUsername, setFormUsername] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formIsAdmin, setFormIsAdmin] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);

  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const loadAll = useCallback(async () => {
    if (!token) return;
    try {
      const [usersData, lockData, settingsData] = await Promise.all([
        api.getUsers(token).catch(() => []),
        api.getControlLock(token).catch(() => null),
        api.getSettings(token).catch(() => null)
      ]);

      setUsers(usersData);
      setLockStatus(lockData);
      if (settingsData) {
        setSettings(settingsData);
      }
    } catch (err) {
      console.warn("Settings load error:", err);
    }
  }, [token]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(async () => {
      try {
        const lockData = await api.getControlLock(token);
        setLockStatus(lockData);
      } catch {
        // ignore
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      if (editingUserId) {
        const payload: any = {};
        if (formUsername.trim()) payload.username = formUsername.trim();
        if (formPassword) payload.password = formPassword;
        payload.isAdmin = formIsAdmin;

        await api.updateUser(token, editingUserId, payload);
        setFeedbackMsg({ text: "Operatore aggiornato con successo", type: "success" });
      } else {
        if (!formUsername.trim() || !formPassword) {
          alert("Compila tutti i campi richiesti");
          return;
        }
        await api.createUser(token, formUsername.trim(), formPassword, formIsAdmin);
        setFeedbackMsg({ text: "Nuovo operatore creato con successo", type: "success" });
      }

      setEditingUserId(null);
      setShowUserForm(false);
      setFormUsername("");
      setFormPassword("");
      setFormIsAdmin(false);
      loadAll();
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || "Errore salvataggio utente", type: "error" });
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!token) return;
    if (!confirm("Sei sicuro di voler rimuovere questo operatore?")) return;

    try {
      await api.deleteUser(token, userId);
      setFeedbackMsg({ text: "Operatore eliminato", type: "success" });
      loadAll();
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || "Errore eliminazione utente", type: "error" });
    }
  };

  const handleForceUnlock = async () => {
    if (!token) return;
    try {
      await api.releaseControlLock(token, true);
      setFeedbackMsg({ text: "Autorità di controllo forzatamente azzerata", type: "success" });
      loadAll();
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || "Errore sblocco lock", type: "error" });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSavingSettings(true);
    try {
      await api.updateSettings(token, settings);
      setFeedbackMsg({ text: "Parametri di sistema salvati nel database", type: "success" });
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || "Errore salvataggio impostazioni", type: "error" });
    } finally {
      setSavingSettings(false);
    }
  };

  if (authLoading) {
    return (
      <div className="mono" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 12 }}>
        CARICAMENTO PARAMETRI DI SISTEMA...
      </div>
    );
  }

  if (!token) {
    return <AuthScreen onLogin={login} loading={authLoading} error={authError} />;
  }

  return (
    <div className="workstation">
      <Navbar
        username={user?.username}
        isAdmin={user?.isAdmin}
        lock={lockStatus}
        onLogout={logout}
      />

      <main className="workstation-content">
        {feedbackMsg && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: feedbackMsg.type === "success" ? "var(--color-success-bg)" : "var(--color-danger-bg)",
              border: `1px solid ${feedbackMsg.type === "success" ? "var(--color-success-border)" : "var(--color-danger-border)"}`,
              borderRadius: "var(--radius-xs)",
              fontSize: 11,
              color: feedbackMsg.type === "success" ? "var(--color-success)" : "var(--color-danger)"
            }}
          >
            {feedbackMsg.type === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            <span>{feedbackMsg.text}</span>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 12 }}>
          {/* Left Column: Operator Management */}
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <Users size={13} />
                <span>REGISTRO OPERATORI AUTORIZZATI</span>
              </div>

              {!showUserForm && (
                <button
                  className="btn btn-xs btn-primary"
                  onClick={() => {
                    setEditingUserId(null);
                    setFormUsername("");
                    setFormPassword("");
                    setFormIsAdmin(false);
                    setShowUserForm(true);
                  }}
                >
                  <UserPlus size={11} />
                  <span>Aggiungi Operatore</span>
                </button>
              )}
            </div>

            <div className="panel-body">
              {showUserForm && (
                <form
                  onSubmit={handleSaveUser}
                  style={{
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-default)",
                    borderRadius: "var(--radius-xs)",
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                    {editingUserId ? "MODIFICA CREDENZIALI OPERATORE" : "REGISTRA NUOVO OPERATORE"}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <label style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
                        Username
                      </label>
                      <input
                        className="input mono"
                        type="text"
                        value={formUsername}
                        onChange={(e) => setFormUsername(e.target.value)}
                        placeholder="operatore_1"
                        required
                      />
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <label style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
                        Password {editingUserId ? "(lascia vuoto per non cambiare)" : ""}
                      </label>
                      <input
                        className="input mono"
                        type="password"
                        value={formPassword}
                        onChange={(e) => setFormPassword(e.target.value)}
                        placeholder="Minimo 6 caratteri"
                        required={!editingUserId}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="checkbox"
                      id="isAdminCheck"
                      checked={formIsAdmin}
                      onChange={(e) => setFormIsAdmin(e.target.checked)}
                    />
                    <label htmlFor="isAdminCheck" style={{ fontSize: 11, cursor: "pointer", color: "var(--text-secondary)" }}>
                      Privilegi di Amministratore (Override lock & gestione sistema)
                    </label>
                  </div>

                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    <button className="btn btn-xs btn-primary" type="submit">
                      {editingUserId ? "Salva Modifiche" : "Registra"}
                    </button>
                    <button className="btn btn-xs" type="button" onClick={() => setShowUserForm(false)}>
                      Annulla
                    </button>
                  </div>
                </form>
              )}

              {/* Table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border-default)", textAlign: "left" }}>
                      <th style={{ padding: "6px 8px", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Operatore</th>
                      <th style={{ padding: "6px 8px", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Ruolo</th>
                      <th style={{ padding: "6px 8px", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Creato Il</th>
                      <th style={{ padding: "6px 8px", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", textAlign: "right" }}>Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "8px 8px" }}>
                          <span className="mono" style={{ fontWeight: 600, color: "var(--text-main)" }}>
                            {u.username}
                          </span>
                          {u.id === user?.id && (
                            <span className="tag mono" style={{ fontSize: 9, marginLeft: 6 }}>TU</span>
                          )}
                        </td>
                        <td style={{ padding: "8px 8px" }}>
                          <span className={`tag mono ${u.isAdmin ? "tag-info" : ""}`}>
                            {u.isAdmin ? "ADMIN" : "OPERATORE"}
                          </span>
                        </td>
                        <td className="mono" style={{ padding: "8px 8px", fontSize: 11, color: "var(--text-muted)" }}>
                          {new Date(u.createdAt).toLocaleDateString("it-IT")}
                        </td>
                        <td style={{ padding: "8px 8px", textAlign: "right" }}>
                          <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                            <button
                              className="btn btn-xs"
                              onClick={() => {
                                setEditingUserId(u.id);
                                setFormUsername(u.username);
                                setFormPassword("");
                                setFormIsAdmin(u.isAdmin);
                                setShowUserForm(true);
                              }}
                              title="Modifica"
                            >
                              <Edit3 size={11} />
                            </button>
                            <button
                              className="btn btn-xs btn-danger"
                              disabled={u.id === user?.id}
                              onClick={() => handleDeleteUser(u.id)}
                              title={u.id === user?.id ? "Impossibile rimuovere il proprio account" : "Elimina"}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Interlock Monitor & Network Configuration */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {/* Safety Interlock Monitor */}
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <Lock size={13} />
                  <span>INTERLOCK & AUTORITÀ PILOTA SINGOLO</span>
                </div>
                <span className={`tag mono ${lockStatus?.isHeld ? "tag-warning" : "tag-success"}`}>
                  {lockStatus?.isHeld ? "OCCUPATO" : "STANDBY"}
                </span>
              </div>

              <div className="panel-body">
                <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4 }}>
                  Per prevenire race conditions sui motori, <strong>un solo utente alla volta</strong> può impartire comandi di marcia. Eventuali altri operatori accedono in sola lettura.
                </div>

                <div className="field-grid mono">
                  <div className="field-cell" style={{ gridColumn: "span 2" }}>
                    <span className="field-label">PILOTA ATTUALE</span>
                    <span className="field-value" style={{ fontSize: 12 }}>
                      {lockStatus?.holderUsername ? `@${lockStatus.holderUsername}` : "NESSUN PILOTA ATTIVO"}
                    </span>
                  </div>

                  {lockStatus?.isHeld && (
                    <>
                      <div className="field-cell">
                        <span className="field-label">HEARTBEAT EXPIRE</span>
                        <span className="field-value" style={{ color: "var(--color-warning)" }}>
                          {lockStatus.expiresInSeconds}s
                        </span>
                      </div>
                      <div className="field-cell">
                        <span className="field-label">IP PILOTA</span>
                        <span className="field-value" style={{ fontSize: 11 }}>
                          {lockStatus.holderIp || "127.0.0.1"}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {lockStatus?.isHeld && user?.isAdmin && (
                  <button className="btn btn-xs btn-danger" onClick={handleForceUnlock} style={{ marginTop: 4 }}>
                    <Unlock size={11} />
                    <span>Azzeramento Forzato Interlock</span>
                  </button>
                )}
              </div>
            </div>

            {/* Network Endpoints Configuration */}
            <form className="panel" onSubmit={handleSaveSettings}>
              <div className="panel-header">
                <div className="panel-title">
                  <Network size={13} />
                  <span>PARAMETRI ENDPOINTS HARDWARE</span>
                </div>
              </div>

              <div className="panel-body">
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <label style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Stream Camera Sinistra (YOLO / RGB)
                  </label>
                  <input
                    className="input mono"
                    type="text"
                    value={settings.leftStreamUrl}
                    onChange={(e) => setSettings({ ...settings, leftStreamUrl: e.target.value })}
                    placeholder="http://100.72.15.72:30080/stream_left.mjpg"
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <label style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
                    Stream Camera Destra (Stereoscopia Disparità)
                  </label>
                  <input
                    className="input mono"
                    type="text"
                    value={settings.rightStreamUrl}
                    onChange={(e) => setSettings({ ...settings, rightStreamUrl: e.target.value })}
                    placeholder="http://100.72.15.72:30080/stream_right.mjpg"
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <label style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
                    WebSocket Telemetry Gateway (mar-gateway)
                  </label>
                  <input
                    className="input mono"
                    type="text"
                    value={settings.gatewayWsUrl}
                    onChange={(e) => setSettings({ ...settings, gatewayWsUrl: e.target.value })}
                    placeholder="ws://localhost:8765"
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <label style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Timeout Inattività (sec)
                    </label>
                    <input
                      className="input mono"
                      type="number"
                      value={settings.lockTimeoutSeconds}
                      onChange={(e) => setSettings({ ...settings, lockTimeoutSeconds: Number(e.target.value) })}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <label style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
                      Distanza Critica Arresto (m)
                    </label>
                    <input
                      className="input mono"
                      type="number"
                      step="0.05"
                      value={settings.criticalDistanceMeters}
                      onChange={(e) => setSettings({ ...settings, criticalDistanceMeters: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={savingSettings || !user?.isAdmin}
                  style={{ marginTop: 4, padding: "7px 10px" }}
                >
                  <Save size={13} />
                  <span>{savingSettings ? "Salvataggio..." : "Salva Configurazione"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
