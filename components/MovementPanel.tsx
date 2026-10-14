"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight, 
  RotateCcw, 
  RotateCw, 
  Octagon, 
  Lock, 
  Gauge, 
  ShieldAlert,
  Footprints
} from "lucide-react";

type Props = {
  canControl: boolean;
  holderUsername?: string | null;
  onSendCommand: (command: string, speed?: number) => Promise<void>;
  onAcquireLock?: () => Promise<void>;
};

export function MovementPanel({
  canControl,
  holderUsername,
  onSendCommand,
  onAcquireLock
}: Props) {
  const [speed, setSpeed] = useState<number>(50);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const send = useCallback(
    async (cmd: string, customSpeed?: number) => {
      if (!canControl) return;
      await onSendCommand(cmd, customSpeed !== undefined ? customSpeed : speed);
    },
    [canControl, onSendCommand, speed]
  );

  // Keyboard navigation
  useEffect(() => {
    if (!canControl) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.repeat) return;

      const k = e.key.toLowerCase();
      switch (k) {
        case "w":
        case "arrowup":
          setActiveKey("w");
          send("CMD:FORWARD");
          break;
        case "s":
        case "arrowdown":
          setActiveKey("s");
          send("CMD:BACKWARD");
          break;
        case "a":
          setActiveKey("a");
          send("CMD:TURN_L");
          break;
        case "d":
          setActiveKey("d");
          send("CMD:TURN_R");
          break;
        case "q":
          setActiveKey("q");
          send("CMD:STRAFE_L");
          break;
        case "e":
          setActiveKey("e");
          send("CMD:STRAFE_R");
          break;
        case " ":
          setActiveKey("space");
          send("CMD:STOP");
          break;
        default:
          break;
      }
    };

    const handleKeyUp = () => {
      setActiveKey(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [canControl, send]);

  return (
    <div className="card">
      {/* Header */}
      <div className="card-header">
        <div className="card-title">
          <Footprints size={15} />
          <span>Controllo Movimento & Assetto</span>
        </div>
        <span className="badge badge-muted mono">WASD / D-Pad</span>
      </div>

      {/* Viewer Mode / Read-Only Warning Banner */}
      {!canControl && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            background: "rgba(245, 158, 11, 0.08)",
            border: "1px solid rgba(245, 158, 11, 0.25)",
            borderRadius: "var(--radius-sm)",
            fontSize: 12,
            gap: 12
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Lock size={15} color="var(--color-warning)" />
            <span style={{ color: "var(--text-secondary)" }}>
              {holderUsername
                ? `Modalità sola lettura: Il robot è controllato da '${holderUsername}'`
                : "Modalità sola lettura: Nessun pilota attivo"}
            </span>
          </div>

          {onAcquireLock && (
            <button
              className="btn btn-sm btn-primary"
              onClick={onAcquireLock}
              style={{ padding: "3px 8px", fontSize: 11 }}
            >
              Prendi Controllo
            </button>
          )}
        </div>
      )}

      {/* Gait / Posture Selectors */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
          Assetto e Andatura
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {[
            { label: "Trot", cmd: "CMD:TROT" },
            { label: "Walk", cmd: "CMD:WALK" },
            { label: "Stand", cmd: "CMD:STAND" },
            { label: "Sit", cmd: "CMD:SIT" }
          ].map((item) => (
            <button
              key={item.label}
              className="btn btn-sm"
              disabled={!canControl}
              onClick={() => send(item.cmd)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Directional Keypad */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
          Manovra Direzionale
        </div>

        <div className="dpad">
          {/* Row 1: Strafe Left, Forward, Strafe Right */}
          <button
            className="dpad-btn"
            disabled={!canControl}
            onClick={() => send("CMD:STRAFE_L")}
            title="Passo laterale sinistro (Q)"
            style={{ background: activeKey === "q" ? "#1e3a8a" : undefined }}
          >
            <ArrowLeft size={16} />
            <span style={{ fontSize: 10, marginTop: 2 }}>Strafe L</span>
          </button>

          <button
            className="dpad-btn"
            disabled={!canControl}
            onClick={() => send("CMD:FORWARD")}
            title="Avanzamento (W)"
            style={{ background: activeKey === "w" ? "#1e3a8a" : undefined }}
          >
            <ArrowUp size={18} color={canControl ? "var(--color-info)" : undefined} />
            <span style={{ fontSize: 10, marginTop: 2 }}>Avanti</span>
          </button>

          <button
            className="dpad-btn"
            disabled={!canControl}
            onClick={() => send("CMD:STRAFE_R")}
            title="Passo laterale destro (E)"
            style={{ background: activeKey === "e" ? "#1e3a8a" : undefined }}
          >
            <ArrowRight size={16} />
            <span style={{ fontSize: 10, marginTop: 2 }}>Strafe R</span>
          </button>

          {/* Row 2: Turn Left, Stop/Brake, Turn Right */}
          <button
            className="dpad-btn"
            disabled={!canControl}
            onClick={() => send("CMD:TURN_L")}
            title="Ruota a sinistra (A)"
            style={{ background: activeKey === "a" ? "#1e3a8a" : undefined }}
          >
            <RotateCcw size={16} />
            <span style={{ fontSize: 10, marginTop: 2 }}>Ruota L</span>
          </button>

          <button
            className="dpad-btn dpad-stop"
            disabled={!canControl}
            onClick={() => send("CMD:STOP")}
            title="Arresto immediato (Spazio)"
          >
            <Octagon size={18} />
            <span style={{ fontSize: 10, marginTop: 2, fontWeight: 700 }}>STOP</span>
          </button>

          <button
            className="dpad-btn"
            disabled={!canControl}
            onClick={() => send("CMD:TURN_R")}
            title="Ruota a destra (D)"
            style={{ background: activeKey === "d" ? "#1e3a8a" : undefined }}
          >
            <RotateCw size={16} />
            <span style={{ fontSize: 10, marginTop: 2 }}>Ruota R</span>
          </button>

          {/* Row 3: Blank, Backward, Emergency */}
          <div />

          <button
            className="dpad-btn"
            disabled={!canControl}
            onClick={() => send("CMD:BACKWARD")}
            title="Retromarcia (S)"
            style={{ background: activeKey === "s" ? "#1e3a8a" : undefined }}
          >
            <ArrowDown size={18} />
            <span style={{ fontSize: 10, marginTop: 2 }}>Indietro</span>
          </button>

          <button
            className="btn btn-sm btn-danger"
            disabled={!canControl}
            onClick={() => send("CMD:EMERGENCY_STOP")}
            title="Emergency Stop"
            style={{ height: "100%", padding: 4, display: "flex", flexDirection: "column", gap: 2 }}
          >
            <ShieldAlert size={14} />
            <span style={{ fontSize: 10 }}>E-CUT</span>
          </button>
        </div>
      </div>

      {/* Speed Slider */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>
            <Gauge size={13} />
            <span>Velocità / Spinta Nominale</span>
          </div>
          <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>
            {speed}%
          </span>
        </div>

        <input
          type="range"
          min="10"
          max="100"
          step="5"
          value={speed}
          disabled={!canControl}
          onChange={(e) => setSpeed(Number(e.target.value))}
          style={{ width: "100%", cursor: canControl ? "pointer" : "not-allowed" }}
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {[25, 50, 75, 100].map((val) => (
            <button
              key={val}
              className={`btn btn-sm ${speed === val ? "btn-primary" : ""}`}
              disabled={!canControl}
              style={{ padding: "2px 4px", fontSize: 11 }}
              onClick={() => setSpeed(val)}
            >
              {val}%
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
