"use client";

import React from "react";
import { Brain, Cpu, ArrowRight, ShieldAlert, CheckCircle2, AlertTriangle, Layers } from "lucide-react";

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
    riskLevel: "LOW" | "MODERATE" | "CRITICAL";
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

const stages = [
  { key: "SCANNING_PERIMETER", label: "1. Scansione LiDAR" },
  { key: "SACCADE_TARGETING", label: "2. Puntamento Saccade" },
  { key: "YOLO_CLASSIFICATION", label: "3. Classificazione YOLO" },
  { key: "DEPTH_EVALUATION", label: "4. Stima Profondità 3D" },
  { key: "ACTION_DECISION", label: "5. Decisione Azione" }
];

export function LineOfThoughtPanel({ data }: Props) {
  if (!data) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Brain size={15} />
            <span>Line of Thought Modello Classificativo</span>
          </div>
        </div>
        <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)" }}>
          Caricamento ragionamento modello in corso...
        </div>
      </div>
    );
  }

  const { activeTarget, currentDecision, recentThoughts } = data;

  return (
    <div className="card">
      {/* Header */}
      <div className="card-header">
        <div className="card-title">
          <Brain size={15} />
          <span>Line of Thought Modello Classificativo (Active Perception)</span>
        </div>
        <span className="badge badge-info">YOLO + FSM Reasoning</span>
      </div>

      {/* Sequential Processing Pipeline Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 6,
          background: "var(--bg-input)",
          padding: "8px 12px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border-subtle)",
          overflowX: "auto"
        }}
      >
        {stages.map((stage, idx) => {
          const isCurrent = stage.key === data.currentStage;
          return (
            <React.Fragment key={stage.key}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  fontWeight: isCurrent ? 700 : 500,
                  color: isCurrent ? "var(--color-info)" : "var(--text-muted)",
                  whiteSpace: "nowrap"
                }}
              >
                {isCurrent && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-info)" }} />}
                <span>{stage.label}</span>
              </div>
              {idx < stages.length - 1 && (
                <ArrowRight size={11} color="var(--border-default)" style={{ flexShrink: 0 }} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Target & Decision Breakdown */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Active Target Identified */}
        <div
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-sm)",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 6
          }}
        >
          <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Target Riconosciuto (YOLO)
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-main)" }}>
            {activeTarget.label}
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 12, marginTop: 2 }}>
            <div>
              <span style={{ color: "var(--text-muted)" }}>Confidenza: </span>
              <span className="mono" style={{ fontWeight: 600, color: "var(--color-success)" }}>
                {Math.round(activeTarget.confidence * 100)}%
              </span>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)" }}>Distanza Z: </span>
              <span className="mono" style={{ fontWeight: 600 }}>
                {activeTarget.distanceMeters.toFixed(2)} m
              </span>
            </div>
            <div>
              <span style={{ color: "var(--text-muted)" }}>Azimut θ: </span>
              <span className="mono" style={{ fontWeight: 600 }}>
                {activeTarget.azimuthDeg > 0 ? `+${activeTarget.azimuthDeg}°` : `${activeTarget.azimuthDeg}°`}
              </span>
            </div>
          </div>
        </div>

        {/* Current Decision Taken */}
        <div
          style={{
            background: "var(--bg-input)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-sm)",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 6
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Decisione FSM
            </span>
            <span
              className={`badge ${
                currentDecision.riskLevel === "CRITICAL"
                  ? "badge-danger"
                  : currentDecision.riskLevel === "MODERATE"
                  ? "badge-warning"
                  : "badge-success"
              }`}
            >
              Rischio {currentDecision.riskLevel}
            </span>
          </div>

          <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--color-info)" }}>
            {currentDecision.command}
          </div>

          <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4 }}>
            {currentDecision.justification}
          </div>
        </div>
      </div>

      {/* Reasoning History Feed */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.04em" }}>
          Cronologia Ragionamento Recente
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {recentThoughts.map((t) => (
            <div
              key={t.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                padding: "8px 10px",
                background: "var(--bg-app)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                fontSize: 12,
                gap: 10
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    {t.timestamp}
                  </span>
                  <span style={{ fontWeight: 600, color: "var(--text-main)" }}>
                    {t.targetObject}
                  </span>
                  <span className="mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>
                    (d={t.distanceMeters.toFixed(2)}m @ {t.azimuthDeg}°)
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                  {t.reasoning}
                </div>
              </div>

              <div style={{ flexShrink: 0, textAlign: "right" }}>
                <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: "var(--color-info)" }}>
                  {t.chosenAction}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
