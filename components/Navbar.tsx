"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Radio, Lock, Unlock, Shield, Settings, SlidersHorizontal } from "lucide-react";

type ControlLockInfo = {
  isHeld: boolean;
  holderUsername: string | null;
  isHeldByCaller: boolean;
  expiresInSeconds: number;
};

type Props = {
  username?: string;
  isAdmin?: boolean;
  lock?: ControlLockInfo;
  onAcquireLock?: () => Promise<void>;
  onReleaseLock?: () => Promise<void>;
  onLogout: () => void;
};

export function Navbar({
  username,
  isAdmin,
  lock,
  onAcquireLock,
  onReleaseLock,
  onLogout
}: Props) {
  const pathname = usePathname();

  return (
    <header className="header-bar">
      {/* Brand & System */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div className="brand-title">
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "var(--color-success)"
            }}
          />
          <span>M.A.R.</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>
            Console di Controllo
          </span>
        </div>

        {/* Navigation Tabs */}
        <nav className="nav-links">
          <Link
            href="/"
            className={`nav-item ${pathname === "/" ? "active" : ""}`}
          >
            Dashboard
          </Link>
          <Link
            href="/settings"
            className={`nav-item ${pathname === "/settings" ? "active" : ""}`}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            <Settings size={13} />
            <span>Impostazioni</span>
          </Link>
        </nav>
      </div>

      {/* Control Lock Status & Operator Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {/* Single Operator Lock Pill */}
        {lock && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 10px",
              background: "var(--bg-app)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-sm)",
              fontSize: 12
            }}
          >
            {lock.isHeldByCaller ? (
              <>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-success)" }} />
                <span style={{ color: "var(--color-success)", fontWeight: 600 }}>
                  Controllo Attivo: Tu
                </span>
                <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  ({lock.expiresInSeconds}s)
                </span>
                {onReleaseLock && (
                  <button
                    className="btn btn-sm"
                    onClick={onReleaseLock}
                    style={{ padding: "2px 6px", fontSize: 11 }}
                    title="Rilascia il controllo per consentire ad altri di manovrare"
                  >
                    Rilascia
                  </button>
                )}
              </>
            ) : lock.isHeld ? (
              <>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-warning)" }} />
                <span style={{ color: "var(--text-secondary)" }}>
                  Sola Lettura (Pilota: <strong style={{ color: "var(--text-main)" }}>{lock.holderUsername}</strong>)
                </span>
                {onAcquireLock && (
                  <button
                    className="btn btn-sm"
                    onClick={onAcquireLock}
                    style={{ padding: "2px 6px", fontSize: 11 }}
                    title="Richiedi o assumi il controllo del robot"
                  >
                    {isAdmin ? "Forza Controllo" : "Prendi Controllo"}
                  </button>
                )}
              </>
            ) : (
              <>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--text-muted)" }} />
                <span style={{ color: "var(--text-muted)" }}>Nessun pilota attivo</span>
                {onAcquireLock && (
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={onAcquireLock}
                    style={{ padding: "2px 8px", fontSize: 11 }}
                  >
                    Prendi Controllo
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* User badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            padding: "4px 8px",
            background: "var(--bg-app)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-sm)"
          }}
        >
          <span style={{ fontWeight: 600 }}>{username || "Operatore"}</span>
          {isAdmin && (
            <span style={{ fontSize: 10, color: "var(--color-info)", fontWeight: 700 }}>
              ADMIN
            </span>
          )}
        </div>

        {/* Logout */}
        <button
          className="btn btn-sm"
          onClick={onLogout}
          title="Disconnetti"
          style={{ color: "var(--text-muted)" }}
        >
          <LogOut size={13} />
          <span>Esci</span>
        </button>
      </div>
    </header>
  );
}
