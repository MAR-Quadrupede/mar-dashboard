"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  ArrowUp, 
  ArrowDown, 
  RotateCcw, 
  RotateCw, 
  Square,
  Lock, 
  ArrowUpLeft,
  ArrowUpRight,
  AlertTriangle
} from "lucide-react";

type Props = {
  canControl: boolean;
  holderUsername?: string | null;
  onSendCommand: (command: string, speed?: number) => Promise<void>;
  onAcquireLock?: () => Promise<void>;
  onEstop?: () => void;
};

export function MovementPanel({
  canControl,
  holderUsername,
  onSendCommand,
  onAcquireLock,
  onEstop
}: Props) {
  const [speed, setSpeed] = useState<number>(50);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [currentGait, setCurrentGait] = useState<string>("TROT");

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

  const handleGait = async (gait: string) => {
    setCurrentGait(gait);
    await send(`CMD:GAIT_${gait}`);
  };

  return (
    <div className="panel">
      {/* Header */}
      <div className="panel-header">
        <div className="panel-title">
          <span>CONTROLLO VETTORIALE & ANDATURA</span>
        </div>
        <span className="tag mono">KEY: WASD / SPACE</span>
      </div>

      <div className="panel-body">
        {/* Read-Only Interlock Banner */}
        {!canControl && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 10px",
              background: "var(--color-warning-bg)",
              border: "1px solid var(--color-warning-border)",
              borderRadius: "var(--radius-xs)",
              fontSize: 11,
              gap: 8
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--color-warning)" }}>
              <Lock size={13} />
              <span>
                {holderUsername
                  ? `Sola lettura: Manovrato da @${holderUsername}`
                  : "Sola lettura: Nessun pilota attivo"}
              </span>
            </div>

            {onAcquireLock && (
              <button
                className="btn btn-xs btn-primary"
                onClick={onAcquireLock}
              >
                Prendi Controllo
              </button>
            )}
          </div>
        )}

        {/* Gait Selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Andatura Cinematica
          </div>
          <div className="segmented-control">
            {["STAND", "TROT", "WALK", "SIT"].map((g) => (
              <button
                key={g}
                className={`segmented-btn ${currentGait === g ? "active" : ""}`}
                onClick={() => handleGait(g)}
                disabled={!canControl}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Tactical Directional Pad */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Vettori di Spostamento
          </div>

          <div className="tac-pad">
            {/* Row 1 */}
            <button
              className={`tac-pad-btn ${activeKey === "q" ? "active" : ""}`}
              onClick={() => send("CMD:STRAFE_L")}
              disabled={!canControl}
              title="Strafe Sinistra (Q)"
            >
              <ArrowUpLeft size={14} />
              <span className="tac-pad-key">Q</span>
            </button>

            <button
              className={`tac-pad-btn ${activeKey === "w" ? "active" : ""}`}
              onClick={() => send("CMD:FORWARD")}
              disabled={!canControl}
              title="Avanti (W)"
            >
              <ArrowUp size={15} />
              <span className="tac-pad-key">W</span>
            </button>

            <button
              className={`tac-pad-btn ${activeKey === "e" ? "active" : ""}`}
              onClick={() => send("CMD:STRAFE_R")}
              disabled={!canControl}
              title="Strafe Destra (E)"
            >
              <ArrowUpRight size={14} />
              <span className="tac-pad-key">E</span>
            </button>

            {/* Row 2 */}
            <button
              className={`tac-pad-btn ${activeKey === "a" ? "active" : ""}`}
              onClick={() => send("CMD:TURN_L")}
              disabled={!canControl}
              title="Ruota Sinistra (A)"
            >
              <RotateCcw size={14} />
              <span className="tac-pad-key">A</span>
            </button>

            <button
              className={`tac-pad-btn ${activeKey === "space" ? "active" : ""}`}
              onClick={() => send("CMD:STOP")}
              disabled={!canControl}
              style={{ background: "#262b36", borderColor: "#3f4756" }}
              title="Stop (Spazio)"
            >
              <Square size={13} color="var(--color-warning)" />
              <span className="tac-pad-key" style={{ color: "var(--color-warning)" }}>STOP</span>
            </button>

            <button
              className={`tac-pad-btn ${activeKey === "d" ? "active" : ""}`}
              onClick={() => send("CMD:TURN_R")}
              disabled={!canControl}
              title="Ruota Destra (D)"
            >
              <RotateCw size={14} />
              <span className="tac-pad-key">D</span>
            </button>

            {/* Row 3 */}
            <button
              className="tac-pad-btn"
              onClick={() => send("CMD:TURN_L,20")}
              disabled={!canControl}
              title="Indietro Sinistra"
            >
              <span style={{ fontSize: 10 }}>↶</span>
              <span className="tac-pad-key">REV-L</span>
            </button>

            <button
              className={`tac-pad-btn ${activeKey === "s" ? "active" : ""}`}
              onClick={() => send("CMD:BACKWARD")}
              disabled={!canControl}
              title="Indietro (S)"
            >
              <ArrowDown size={15} />
              <span className="tac-pad-key">S</span>
            </button>

            <button
              className="tac-pad-btn"
              onClick={() => send("CMD:TURN_R,20")}
              disabled={!canControl}
              title="Indietro Destra"
            >
              <span style={{ fontSize: 10 }}>↷</span>
              <span className="tac-pad-key">REV-R</span>
            </button>
          </div>
        </div>

        {/* Speed Regulator */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 2 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Limitatore Velocità
            </span>
            <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--text-main)" }}>
              {speed}%
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="range"
              min="10"
              max="100"
              step="5"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              disabled={!canControl}
              style={{
                flex: 1,
                accentColor: "#38bdf8",
                cursor: canControl ? "pointer" : "not-allowed"
              }}
            />

            <div style={{ display: "flex", gap: 2 }}>
              {[25, 50, 75, 100].map((preset) => (
                <button
                  key={preset}
                  className="btn btn-xs mono"
                  style={{
                    padding: "2px 5px",
                    background: speed === preset ? "var(--bg-panel-hover)" : undefined,
                    borderColor: speed === preset ? "var(--border-strong)" : undefined
                  }}
                  onClick={() => setSpeed(preset)}
                  disabled={!canControl}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Immediate Hardware E-Stop */}
        <button
          className="estop-btn"
          onClick={() => {
            if (onEstop) onEstop();
            send("CMD:ESTOP");
          }}
          title="ARRESTO DI EMERGENZA IMMEDIATO (E-STOP)"
        >
          <AlertTriangle size={15} />
          <span>E-STOP ARRESTO IMMEDIATO</span>
        </button>
      </div>
    </div>
  );
}
