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
  Settings, 
  Save, 
  CheckCircle2, 
  AlertCircle,
  Radio,
  Sliders
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

  // User form state
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

  // Periodic refresh of lock status
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

  // Create or Update user
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      if (editingUserId) {
        // Update
        const payload: any = {};
        if (formUsername.trim()) payload.username = formUsername.trim();
        if (formPassword) payload.password = formPassword;
        payload.isAdmin = formIsAdmin;

        await api.updateUser(token, editingUserId, payload);
        setFeedbackMsg({ text: "Operatore aggiornato con successo", type: "success" });
      } else {
        // Create
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

  // Force unlock
  const handleForceUnlock = async () => {
    if (!token) return;
    try {
      await api.releaseControlLock(token, true);
      setFeedbackMsg({ text: "Lock di controllo forzatamente liberato", type: "success" });
      loadAll();
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || "Errore sblocco lock", type: "error" });
    }
  };

  // Save system settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSavingSettings(true);
    try {
      await api.updateSettings(token, settings);
      setFeedbackMsg({ text: "Configurazione salvata con successo", type: "success" });
    } catch (err: any) {
      setFeedbackMsg({ text: err.message || "Errore salvataggio impostazioni", type: "error" });
    } finally {
      setSavingSettings(false);
    }
  };

  if (authLoading) {
    return <div className="container" style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Caricamento impostazioni...</div>;
  }

  if (!token) {
    return <AuthScreen onLogin={login} loading={authLoading} error={authError} />;
  }

  return (
    <div className="container">
      {/* Header */}
      <Navbar
        username={user?.username}
        isAdmin={user?.isAdmin}
        lock={lockStatus}
        onLogout={logout}
      />

      {feedbackMsg && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 14px",
            background: feedbackMsg.type === "success" ? "var(--color-success-bg)" : "var(--color-danger-bg)",
            border: `1px solid ${feedbackMsg.type === "success" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            borderRadius: "var(--radius-sm)",
            fontSize: 13,
            color: feedbackMsg.type === "success" ? "var(--color-success)" : "var(--color-danger)"
          }}
        >
          {feedbackMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Main Settings Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
        {/* Section 1: User Management */}
        <section className="card">
          <div className="card-header">
            <div className="card-title">
              <Users size={15} />
              <span>Gestione Operatori e Autorizzazioni</span>
            </div>
            {!showUserForm && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  setEditingUserId(null);
                  setFormUsername("");
                  setFormPassword("");
                  setFormIsAdmin(false);
                  setShowUserForm(true);
                }}
              >
                <UserPlus size={13} />
                <span>Nuovo Operatore</span>
              </button>
            )}
          </div>

          {/* User Form */}
          {showUserForm && (
            <form
              onSubmit={handleSaveUser}
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-default)",
                borderRadius: "var(--radius-sm)",
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700 }}>
                {editingUserId ? "Modifica Operatore" : "Registra Nuovo Operatore"}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, color: "var(--text-muted)" }}>Username</label>
                  <input
                    className="input"
                    type="text"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    placeholder="es. pilota_1"
                    required
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Password {editingUserId ? "(opzionale per modifica)" : ""}
                  </label>
                  <input
                    className="input"
                    type="password"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Minimo 6 caratteri"
                    required={!editingUserId}
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "4px 0" }}>
                <input
                  type="checkbox"
                  id="isAdminCheck"
                  checked={formIsAdmin}
                  onChange={(e) => setFormIsAdmin(e.target.checked)}
                />
                <label htmlFor="isAdminCheck" style={{ fontSize: 12, cursor: "pointer", color: "var(--text-secondary)" }}>
                  Privilegi di Amministratore (può gestire utenti e impostazioni)
                </label>
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                <button className="btn btn-sm btn-primary" type="submit">
                  {editingUserId ? "Salva Modifiche" : "Crea Utente"}
                </button>
                <button className="btn btn-sm" type="button" onClick={() => setShowUserForm(false)}>
                  Annulla
                </button>
              </div>
            </form>
          )}

          {/* User List Table */}
          <table className="table">
            <thead>
              <tr>
                <th>Operatore</th>
                <th>Ruolo</th>
                <th>Registrato</th>
                <th style={{ textAlign: "right" }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--text-main)" }}>
                      {u.username}
                      {u.id === user?.id && <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 6 }}>(tu)</span>}
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${u.isAdmin ? "badge-info" : "badge-muted"}`}>
                      {u.isAdmin ? "Amministratore" : "Operatore"}
                    </span>
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>
                    {new Date(u.createdAt).toLocaleDateString("it-IT")}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                      <button
                        className="btn btn-sm"
                        onClick={() => {
                          setEditingUserId(u.id);
                          setFormUsername(u.username);
                          setFormPassword("");
                          setFormIsAdmin(u.isAdmin);
                          setShowUserForm(true);
                        }}
                        title="Modifica"
                      >
                        <Edit3 size={12} />
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        disabled={u.id === user?.id}
                        onClick={() => handleDeleteUser(u.id)}
                        title={u.id === user?.id ? "Non puoi eliminare il tuo stesso account" : "Elimina"}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Section 2: Concurrency Lock & Network Configuration */}
        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Concurrency / Race Condition Guard Monitor */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">
                <Lock size={15} />
                <span>Gestione Lock di Controllo (Prevenzione Race Conditions)</span>
              </div>
              <span className={`badge ${lockStatus?.isHeld ? "badge-warning" : "badge-success"}`}>
                {lockStatus?.isHeld ? "Controllo Riservato" : "Nessun Pilota"}
              </span>
            </div>

            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>
              Il sistema applica il vincolo di <strong>un solo pilota attivo alla volta</strong>. Gli altri utenti connessi possono osservare telemetria e telecamere in sola lettura senza interferire con i comandi motori.
            </div>

            <div
              style={{
                background: "var(--bg-input)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                fontSize: 12
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Pilota Attuale:</span>
                <span style={{ fontWeight: 700, color: "var(--text-main)" }}>
                  {lockStatus?.holderUsername || "Nessun operatore (Controllo libero)"}
                </span>
              </div>

              {lockStatus?.isHeld && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Scadenza Inattività:</span>
                    <span className="mono" style={{ color: "var(--color-warning)" }}>
                      {lockStatus?.expiresInSeconds} secondi
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Indirizzo Connessione:</span>
                    <span className="mono">{lockStatus?.holderIp || "locale"}</span>
                  </div>
                </>
              )}
            </div>

            {lockStatus?.isHeld && user?.isAdmin && (
              <button className="btn btn-sm btn-danger" onClick={handleForceUnlock}>
                <Unlock size={13} />
                <span>Sblocco Forzato Amministratore</span>
              </button>
            )}
          </div>

          {/* Network & Video Streams Configuration */}
          <form className="card" onSubmit={handleSaveSettings}>
            <div className="card-header">
              <div className="card-title">
                <Sliders size={15} />
                <span>Endpoint Telecamere & Parametri Robot</span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  URL Stream Camera Sinistra (YOLO Inference)
                </label>
                <input
                  className="input"
                  type="text"
                  value={settings.leftStreamUrl}
                  onChange={(e) => setSettings({ ...settings, leftStreamUrl: e.target.value })}
                  placeholder="http://100.77.16.116:8443/stream_left.mjpg"
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  URL Stream Camera Destra (Stereoscopia Disparità)
                </label>
                <input
                  className="input"
                  type="text"
                  value={settings.rightStreamUrl}
                  onChange={(e) => setSettings({ ...settings, rightStreamUrl: e.target.value })}
                  placeholder="http://100.77.16.116:8443/stream_right.mjpg"
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  WebSocket Telemetry Gateway (mar-gateway)
                </label>
                <input
                  className="input"
                  type="text"
                  value={settings.gatewayWsUrl}
                  onChange={(e) => setSettings({ ...settings, gatewayWsUrl: e.target.value })}
                  placeholder="ws://localhost:8765"
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Timeout Inattività Lock (sec)
                  </label>
                  <input
                    className="input"
                    type="number"
                    value={settings.lockTimeoutSeconds}
                    onChange={(e) => setSettings({ ...settings, lockTimeoutSeconds: Number(e.target.value) })}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    Distanza Critica Arresto (m)
                  </label>
                  <input
                    className="input"
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
                style={{ marginTop: 6 }}
              >
                <Save size={14} />
                <span>{savingSettings ? "Salvataggio..." : "Salva Configurazione"}</span>
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
