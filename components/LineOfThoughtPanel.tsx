"use client";

import React from "react";
import { Terminal, ShieldAlert, CheckCircle2, AlertTriangle, Layers, Crosshair } from "lucide-react";

type ThoughtData = {
  currentStage: string;
  activeTarget: {
    label: string;
    confidence: number;
    distanceMeters: number;
    azimuthDeg: number;
  };
  currentDecision: {
    command: string;
    justification: string;
    riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  };
  recentThoughts: Array<{
    id: string;
    timestamp: string;
    stage: string;
    targetObject: string;
    confidence: number;
    distanceMeters: number;
    azimuthDeg: number;
    reasoning: string;
    chosenAction: string;
  }>;
};

type Props = {
  data?: ThoughtData | null;
};

const pipelineStages = [
  { id: "SCANNING_PERIMETER", code: "01", name: "SCAN LiDAR" },
  { id: "SACCADE_TARGETING", code: "02", name: "SACCADE" },
  { id: "YOLO_CLASSIFICATION", code: "03", name: "YOLOv8" },
  { id: "DEPTH_EVALUATION", code: "04", name: "DEPTH 3D" },
  { id: "ACTION_DECISION", code: "05", name: "FSM ACTION" }
];

export function LineOfThoughtPanel({ data }: Props) {
  if (!data) {
    return (
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <Terminal size={13} />
            <span>ISPETTORE PERCEZIONE & DECISION ENGINE</span>
          </div>
        </div>
        <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>
          In attesa del flusso decisionale autonomo...
        </div>
      </div>
    );
  }

  const { activeTarget, currentDecision, recentThoughts, currentStage } = data;

  const isRiskHigh = currentDecision.riskLevel === "CRITICAL" || currentDecision.riskLevel === "HIGH";
  const isRiskMod = currentDecision.riskLevel === "MODERATE";

  return (
    <div className="panel">
      {/* Panel Header */}
      <div className="panel-header">
        <div className="panel-title">
          <Crosshair size={13} />
          <span>ISPETTORE PERCEZIONE & DECISION ENGINE</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            className={`tag mono ${
              isRiskHigh ? "tag-danger" : isRiskMod ? "tag-warning" : "tag-success"
            }`}
          >
            RISK: {currentDecision.riskLevel}
          </span>
        </div>
      </div>

      <div className="panel-body">
        {/* Hardware / Perception Pipeline Steps Ribbon */}
        <div
          className="mono"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 4,
            background: "var(--bg-input)",
            padding: 4,
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-xs)"
          }}
        >
          {pipelineStages.map((stage) => {
            const isActive = stage.id === currentStage;
            return (
              <div
                key={stage.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  padding: "4px 2px",
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 500,
                  background: isActive ? "var(--bg-panel-hover)" : "transparent",
                  color: isActive ? "var(--color-accent)" : "var(--text-muted)",
                  border: isActive ? "1px solid var(--border-strong)" : "1px solid transparent",
                  borderRadius: "var(--radius-xs)",
                  textAlign: "center"
                }}
              >
                <span>{stage.code}</span>
                <span>{stage.name}</span>
              </div>
            );
          })}
        </div>

        {/* Tactical Readouts: Target Vector & FSM Decision */}
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 8 }}>
          {/* Active Target Vector */}
          <div
            style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-xs)",
              padding: "8px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 4
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
              <span>Target Tracciato (YOLO / Vision)</span>
              <span className="mono" style={{ color: "var(--color-accent)" }}>
                CONF: {Math.round(activeTarget.confidence * 100)}%
              </span>
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)" }}>
              {activeTarget.label || "Nessun target rilevato"}
            </div>

            <div className="field-grid mono" style={{ marginTop: 2 }}>
              <div className="field-cell" style={{ padding: "4px 6px" }}>
                <span className="field-label">DISTANZA Z</span>
                <span className="field-value" style={{ fontSize: 11 }}>
                  {activeTarget.distanceMeters > 0 && activeTarget.confidence > 0
                    ? `${activeTarget.distanceMeters.toFixed(2)} m`
                    : "—"}
                </span>
              </div>
              <div className="field-cell" style={{ padding: "4px 6px" }}>
                <span className="field-label">AZIMUT θ</span>
                <span className="field-value" style={{ fontSize: 11 }}>
                  {activeTarget.azimuthDeg > 0 ? `+${activeTarget.azimuthDeg}` : activeTarget.azimuthDeg}°
                </span>
              </div>
            </div>
          </div>

          {/* Current Decision Output */}
          <div
            style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-xs)",
              padding: "8px 10px",
              display: "flex",
              flexDirection: "column",
              gap: 4
            }}
          >
            <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>
              Azione Calcolata dal Modello (FSM)
            </div>

            <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: "var(--color-warning)" }}>
              {currentDecision.command || "CMD:HOLD"}
            </div>

            <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.35 }}>
              {currentDecision.justification || "Nessuna azione richiesta"}
            </div>
          </div>
        </div>

        {/* Flight Recorder / Decision Trace Terminal */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Decision Trace Log (Autonomous Loop)
            </span>
            <span className="tag mono" style={{ fontSize: 9 }}>
              {recentThoughts.length} RECORD
            </span>
          </div>

          <div className="trace-terminal">
            {recentThoughts.length === 0 ? (
              <div style={{ color: "var(--text-dim)", padding: "12px 0", textAlign: "center" }}>
                Nessun evento registrato nella sessione corrente
              </div>
            ) : (
              recentThoughts.map((t) => (
                <div key={t.id} className="trace-line">
                  <span className="trace-time">{t.timestamp}</span>
                  <span className="trace-stage">[{t.stage.replace("_", " ")}]</span>
                  <span className="trace-msg">
                    <strong style={{ color: "var(--text-main)" }}>{t.targetObject}</strong> ({t.distanceMeters.toFixed(2)}m @ {t.azimuthDeg}°) — {t.reasoning}
                  </span>
                  <span className="trace-action">{t.chosenAction}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
