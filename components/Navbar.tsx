"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock, Unlock, LogOut, Sliders, Shield, Terminal, Radio } from "lucide-react";

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

type LoraControl = {
  isSupported: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  rxCount: number;
  txCount: number;
  lastError: string | null;
  connect: (baudRate?: number) => Promise<boolean>;
  disconnect: () => Promise<void>;
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
  lora?: LoraControl;
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
  quickTelemetry,
  lora
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
          <span
            className={`tag ${
              liveLinkLabel.includes("LORA")
                ? "tag-success"
                : liveLinkOk
                  ? "tag-success"
                  : "tag-warning"
            } mono`}
          >
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

        {/* LoRa USB Ground Link Trigger */}
        {lora && (
          <div style={{ display: "flex", alignItems: "center", marginLeft: 4 }}>
            {lora.isConnected ? (
              <div
                className="tag mono"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: "rgba(16, 185, 129, 0.15)",
                  border: "1px solid rgba(16, 185, 129, 0.5)",
                  color: "#34d399",
                  fontSize: 10,
                  padding: "3px 8px",
                  borderRadius: 4
                }}
                title={`LoRa 868MHz connesso via USB | RX: ${lora.rxCount} pacchetti | TX: ${lora.txCount} comandi`}
              >
                <Radio size={11} className="spin-slow" />
                <span>LORA USB (868MHz)</span>
                <span style={{ opacity: 0.7, fontSize: 9 }}>
                  RX:{lora.rxCount} TX:{lora.txCount}
                </span>
                <button
                  type="button"
                  onClick={() => lora.disconnect()}
                  style={{
                    background: "none",
                    border: "none",
                    color: "inherit",
                    cursor: "pointer",
                    fontSize: 10,
                    fontWeight: "bold",
                    padding: "0 2px"
                  }}
                  title="Disconnetti porta seriale LoRa"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-xs mono"
                onClick={() => {
                  if (!lora.isSupported) {
                    alert(
                      "La Web Serial API richiede un contesto sicuro (HTTPS o http://localhost:3000) e un browser compatibile (Google Chrome, Microsoft Edge, Opera, Chromium).\n\nSe sei connesso tramite IP Tailscale su HTTP puro, puoi aprire un tunnel locale (es. ssh -L 3000:localhost:3000) oppure abilitare il flag chrome://flags/#unsafely-treat-insecure-origin-as-secure."
                    );
                    return;
                  }
                  lora.connect(9600);
                }}
                disabled={lora.isConnecting}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 10,
                  background: "rgba(59, 130, 246, 0.12)",
                  borderColor: "rgba(59, 130, 246, 0.4)",
                  color: "#60a5fa"
                }}
                title={
                  lora.isSupported
                    ? "Collega transceiver radio LoRa SX1262 / dongle USB locale (9600 baud)"
                    : "Web Serial non disponibile su questo browser/contesto (clicca per dettagli)"
                }
              >
                <Radio size={11} />
                <span>{lora.isConnecting ? "APERTURA..." : "COLLEGA LORA USB"}</span>
              </button>
            )}
          </div>
        )}
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
