"use client";

import React from "react";
import { Activity, Battery, Zap, Thermometer, Compass, Radio, MapPin } from "lucide-react";

type TelemetryData = {
  batteryPercent: number;
  batteryVoltage: number;
  currentAmps: number;
  temperatureCelsius: number;
  frontDistanceMeters: number;
  lidarPoints: number;
  rollDegrees: number;
  pitchDegrees: number;
  latitude: number;
  longitude: number;
  connectivity: "online" | "degraded" | "offline";
  fsmState: string;
  updatedAt: string;
};

type Props = {
  telemetry?: TelemetryData | null;
};

export function SensorsTelemetryPanel({ telemetry }: Props) {
  if (!telemetry) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <Activity size={15} />
            <span>Sensori & Telemetria di Bordo</span>
          </div>
        </div>
        <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)" }}>
          In attesa dei dati telemetrici...
        </div>
      </div>
    );
  }

  const {
    batteryPercent,
    batteryVoltage,
    currentAmps,
    temperatureCelsius,
    frontDistanceMeters,
    lidarPoints,
    rollDegrees,
    pitchDegrees,
    latitude,
    longitude,
    connectivity,
    fsmState
  } = telemetry;

  const isLowBatt = batteryPercent < 25;
  const isHot = temperatureCelsius > 65;

  return (
    <div className="card">
      {/* Header */}
      <div className="card-header">
        <div className="card-title">
          <Activity size={15} />
          <span>Sensori & Telemetria Hardware</span>
        </div>
        <span className={`badge ${connectivity === "online" ? "badge-success" : "badge-warning"}`}>
          {connectivity === "online" ? "Link Seriale Attivo" : "Link Degradato"}
        </span>
      </div>

      {/* Row 1: Power & Battery */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
          <span>Alimentazione Pacco 4S</span>
          <span className="mono" style={{ color: isLowBatt ? "var(--color-danger)" : "var(--color-success)" }}>
            {batteryPercent}%
          </span>
        </div>

        {/* Minimal Progress Bar */}
        <div style={{ width: "100%", height: 6, background: "var(--bg-input)", borderRadius: 3, overflow: "hidden" }}>
          <div
            style={{
              width: `${Math.min(100, Math.max(0, batteryPercent))}%`,
              height: "100%",
              background: isLowBatt ? "var(--color-danger)" : batteryPercent < 45 ? "var(--color-warning)" : "var(--color-success)",
              transition: "width 0.3s ease"
            }}
          />
        </div>

        <div className="metric-row" style={{ marginTop: 4 }}>
          <div className="metric-item">
            <div className="metric-label">Tensione Pacco</div>
            <div className="metric-val mono">{batteryVoltage.toFixed(1)} <span style={{ fontSize: 11, color: "var(--text-muted)" }}>V</span></div>
          </div>
          <div className="metric-item">
            <div className="metric-label">Corrente</div>
            <div className="metric-val mono">{currentAmps.toFixed(1)} <span style={{ fontSize: 11, color: "var(--text-muted)" }}>A</span></div>
          </div>
          <div className="metric-item">
            <div className="metric-label">Potenza</div>
            <div className="metric-val mono">{(batteryVoltage * currentAmps).toFixed(0)} <span style={{ fontSize: 11, color: "var(--text-muted)" }}>W</span></div>
          </div>
        </div>
      </div>

      {/* Row 2: Distance & Environmental Sensors */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid var(--border-subtle)", paddingTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
          Sensori di Prossimità & Perimetro
        </div>

        <div className="metric-row">
          <div className="metric-item">
            <div className="metric-label">Laser Frontale</div>
            <div className="metric-val mono" style={{ color: frontDistanceMeters < 0.8 ? "var(--color-danger)" : undefined }}>
              {frontDistanceMeters.toFixed(2)} <span style={{ fontSize: 11, color: "var(--text-muted)" }}>m</span>
            </div>
          </div>

          <div className="metric-item">
            <div className="metric-label">LiDAR 360°</div>
            <div className="metric-val mono">{lidarPoints} <span style={{ fontSize: 11, color: "var(--text-muted)" }}>punti</span></div>
          </div>

          <div className="metric-item">
            <div className="metric-label">Temp. RPi 5</div>
            <div className="metric-val mono" style={{ color: isHot ? "var(--color-danger)" : undefined }}>
              {temperatureCelsius.toFixed(1)} <span style={{ fontSize: 11, color: "var(--text-muted)" }}>°C</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: IMU Attitude (Pitch & Roll) */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid var(--border-subtle)", paddingTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>
          <span>Inclinazione Chassis (IMU)</span>
          <span style={{ color: Math.abs(rollDegrees) > 20 || Math.abs(pitchDegrees) > 20 ? "var(--color-danger)" : "var(--color-success)" }}>
            {Math.abs(rollDegrees) > 20 || Math.abs(pitchDegrees) > 20 ? "Inclinazione Elevata" : "Assetto Stabile"}
          </span>
        </div>

        <div className="metric-row">
          <div className="metric-item">
            <div className="metric-label">Rollio (Roll)</div>
            <div className="metric-val mono">{rollDegrees >= 0 ? `+${rollDegrees.toFixed(1)}` : rollDegrees.toFixed(1)}°</div>
          </div>

          <div className="metric-item">
            <div className="metric-label">Beccheggio (Pitch)</div>
            <div className="metric-val mono">{pitchDegrees >= 0 ? `+${pitchDegrees.toFixed(1)}` : pitchDegrees.toFixed(1)}°</div>
          </div>

          <div className="metric-item">
            <div className="metric-label">Stato Autonomo</div>
            <div className="metric-val" style={{ fontSize: 13, fontWeight: 700, color: "var(--color-info)" }}>
              {fsmState}
            </div>
          </div>
        </div>
      </div>

      {/* Row 4: GNSS Position */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-input)", padding: "8px 10px", borderRadius: "var(--radius-sm)", fontSize: 12, borderTop: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <MapPin size={13} color="var(--text-muted)" />
          <span className="mono">{latitude.toFixed(5)}° N, {longitude.toFixed(5)}° E</span>
        </div>
        <span className="badge badge-success">RTK Valid</span>
      </div>
    </div>
  );
}
