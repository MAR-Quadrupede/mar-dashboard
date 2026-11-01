"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, Unlock, LogOut, Sliders, Shield, Terminal } from "lucide-react";

type ControlLockInfo = {
  isHeld: boolean;
  holderUsername: string | null;
  isHeldByCaller: boolean;
  expiresInSeconds: number;
};

type QuickTelemetry = {
  batteryVoltage?: number;
  batteryPercent?: number;
  currentAmps?: number;
  temperatureCelsius?: number;
  pitchDegrees?: number;
  rollDegrees?: number;
};

type Props = {
  username?: string;
  isAdmin?: boolean;
  lock?: ControlLockInfo | null;
  onAcquireLock?: () => Promise<void>;
  onReleaseLock?: () => Promise<void>;
  onLogout: () => void;
  liveLinkLabel?: string;
  liveLinkOk?: boolean;
  quickTelemetry?: QuickTelemetry;
};

export function Navbar({
  username,
  isAdmin,
  lock,
  onAcquireLock,
  onReleaseLock,
  onLogout,
  liveLinkLabel,
  liveLinkOk,
  quickTelemetry
}: Props) {
  const pathname = usePathname();

  const isLockedByMe = Boolean(lock?.isHeldByCaller);
  const isLockedByOther = Boolean(lock?.isHeld && !lock?.isHeldByCaller);

  return (
    <header className="flight-header">
      {/* Platform & Status */}
      <div className="system-identity">
        <div className="platform-badge">
          <div
            className={`status-dot ${
              liveLinkOk ? "online" : liveLinkLabel?.includes("SYNC") ? "warning" : "offline"
            }`}
          />
          <span>M.A.R. MK-1</span>
          <span style={{ color: "var(--text-dim)", fontWeight: 400 }}>|</span>
          <span style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 500 }}>
            TELEOP COCKPIT
          </span>
        </div>

        {liveLinkLabel && (
          <span className={`tag ${liveLinkOk ? "tag-success" : "tag-warning"} mono`}>
            {liveLinkLabel}
          </span>
        )}

        {/* Navigation Switch */}
        <nav className="flight-nav">
          <Link
            href="/"
            className={`flight-nav-item ${pathname === "/" ? "active" : ""}`}
          >
            <Terminal size={12} />
            <span>CONSOLE</span>
          </Link>
          <Link
            href="/settings"
            className={`flight-nav-item ${pathname === "/settings" ? "active" : ""}`}
          >
            <Sliders size={12} />
            <span>IMPOSTAZIONI</span>
          </Link>
        </nav>
      </div>

      {/* Quick Telemetry Tape */}
      {quickTelemetry && (
        <div className="telemetry-ribbon mono" style={{ display: "flex" }}>
          {quickTelemetry.batteryPercent !== undefined && quickTelemetry.batteryPercent > 0 && (
            <div className="ribbon-item">
              <span className="ribbon-label">BATT:</span>
              <span
                className="ribbon-val"
                style={{
                  color: quickTelemetry.batteryPercent < 25 ? "var(--color-danger)" : "var(--text-main)"
                }}
              >
                {quickTelemetry.batteryVoltage?.toFixed(1)}V ({quickTelemetry.batteryPercent}%)
              </span>
            </div>
          )}

          {quickTelemetry.currentAmps !== undefined && (
            <div className="ribbon-item">
              <span className="ribbon-label">CURR:</span>
              <span className="ribbon-val">{quickTelemetry.currentAmps.toFixed(1)}A</span>
            </div>
          )}

          {quickTelemetry.temperatureCelsius !== undefined && quickTelemetry.temperatureCelsius > 0 && (
            <div className="ribbon-item">
              <span className="ribbon-label">TEMP:</span>
              <span className="ribbon-val">{quickTelemetry.temperatureCelsius.toFixed(0)}°C</span>
            </div>
          )}

          {quickTelemetry.pitchDegrees !== undefined && (
            <div className="ribbon-item">
              <span className="ribbon-label">ATTITUDE:</span>
              <span className="ribbon-val">
                P:{quickTelemetry.pitchDegrees > 0 ? `+${quickTelemetry.pitchDegrees.toFixed(1)}` : quickTelemetry.pitchDegrees.toFixed(1)}°
              </span>
            </div>
          )}
        </div>
      )}

      {/* Operator Safety Interlock (Single Active Authority) */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div
          className={`authority-box mono ${
            isLockedByMe ? "held-by-me" : isLockedByOther ? "held-by-other" : "vacant"
          }`}
        >
          {isLockedByMe ? (
            <>
              <Lock size={12} />
              <span>CONTROLLO ATTIVO: TU</span>
              <span style={{ opacity: 0.75 }}>({lock?.expiresInSeconds}s)</span>
              {onReleaseLock && (
                <button
                  className="btn btn-xs"
                  onClick={onReleaseLock}
                  style={{ marginLeft: 4 }}
                  title="Rilascia il comando per altri operatori"
                >
                  Rilascia
                </button>
              )}
            </>
          ) : isLockedByOther ? (
            <>
              <Lock size={12} />
              <span>SOLA LETTURA (PILOTA: @{lock?.holderUsername})</span>
              {onAcquireLock && (
                <button
                  className="btn btn-xs btn-primary"
                  onClick={onAcquireLock}
                  style={{ marginLeft: 4 }}
                  title="Richiedi o forza il controllo"
                >
                  {isAdmin ? "Forza Override" : "Richiedi"}
                </button>
              )}
            </>
          ) : (
            <>
              <Unlock size={12} color="var(--text-muted)" />
              <span style={{ color: "var(--text-muted)" }}>NESSUN PILOTA ATTIVO</span>
              {onAcquireLock && (
                <button
                  className="btn btn-xs btn-primary"
                  onClick={onAcquireLock}
                  style={{ marginLeft: 4 }}
                >
                  Prendi Controllo
                </button>
              )}
            </>
          )}
        </div>

        {/* User Info & Logout */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
          <span style={{ color: "var(--text-muted)" }}>OP:</span>
          <span className="mono" style={{ fontWeight: 600, color: "var(--text-main)" }}>
            {username}
          </span>
          {isAdmin && (
            <span className="tag tag-info" style={{ fontSize: 9, padding: "1px 4px" }}>
              ADM
            </span>
          )}
          <button
            className="btn btn-xs"
            onClick={onLogout}
            title="Disconnetti operatore"
            style={{ marginLeft: 4 }}
          >
            <LogOut size={11} />
          </button>
        </div>
      </div>
    </header>
  );
}
