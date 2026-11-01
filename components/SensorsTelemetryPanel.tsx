"use client";

import React from "react";
import { Activity, Battery, Zap, Thermometer, Compass, Radio, MapPin } from "lucide-react";

type TelemetryData = {
  batteryPercent: number;
  batteryVoltage: number;
  currentAmps: number;
  temperatureCelsius: number;
  frontDistanceMeters: number;
  ultrasonicMeters?: number;
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
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <Activity size={13} />
            <span>TELEMETRIA SENSORI & HARDWARE</span>
          </div>
        </div>
        <div style={{ padding: 16, textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>
          In attesa pacchetto telemetrico...
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
    ultrasonicMeters = 0,
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
  const powerWatts = batteryVoltage * currentAmps;

  return (
    <div className="panel">
      {/* Header */}
      <div className="panel-header">
        <div className="panel-title">
          <Activity size={13} />
          <span>TELEMETRIA SENSORI & HARDWARE</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span className="tag mono">FSM: {fsmState || "STANDBY"}</span>
          <span
            className={`tag mono ${
              connectivity === "online" ? "tag-success" : "tag-warning"
            }`}
          >
            {connectivity === "online" ? "LINK ATTIVO" : "DEGRADATO"}
          </span>
        </div>
      </div>

      <div className="panel-body">
        {/* Section 1: Power & Battery 4S */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Alimentazione Pacco 4S LiPo
            </span>
            <span
              className="mono"
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: isLowBatt ? "var(--color-danger)" : "var(--color-success)"
              }}
            >
              SoC {batteryPercent}%
            </span>
          </div>

          {/* Precision Meter Bar */}
          <div
            style={{
              width: "100%",
              height: 4,
              background: "var(--bg-input)",
              borderRadius: 2,
              overflow: "hidden"
            }}
          >
            <div
              style={{
                width: `${Math.min(100, Math.max(0, batteryPercent))}%`,
                height: "100%",
                background: isLowBatt
                  ? "var(--color-danger)"
                  : batteryPercent < 45
                  ? "var(--color-warning)"
                  : "var(--color-success)"
              }}
            />
          </div>

          <div className="field-grid mono">
            <div className="field-cell">
              <span className="field-label">TENSIONE</span>
              <span className="field-value">
                {batteryVoltage.toFixed(1)} <span className="field-unit">V</span>
              </span>
            </div>

            <div className="field-cell">
              <span className="field-label">CORRENTE</span>
              <span className="field-value">
                {currentAmps.toFixed(1)} <span className="field-unit">A</span>
              </span>
            </div>

            <div className="field-cell">
              <span className="field-label">POTENZA</span>
              <span className="field-value">
                {powerWatts.toFixed(0)} <span className="field-unit">W</span>
              </span>
            </div>

            <div className="field-cell">
              <span className="field-label">TEMP RPi</span>
              <span
                className="field-value"
                style={{ color: isHot ? "var(--color-danger)" : undefined }}
              >
                {temperatureCelsius.toFixed(0)} <span className="field-unit">°C</span>
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Proximity & Spatial Obstacles */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, borderTop: "1px solid var(--border-subtle)", paddingTop: 8 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Distanziometri & Perimetro
          </div>

          <div className="field-grid mono">
            <div className="field-cell">
              <span className="field-label">LiDAR FRONTE</span>
              <span
                className="field-value"
                style={{
                  color: frontDistanceMeters > 0 && frontDistanceMeters < 0.8 ? "var(--color-danger)" : undefined
                }}
              >
                {frontDistanceMeters > 0 ? frontDistanceMeters.toFixed(2) : "—"}{" "}
                <span className="field-unit">m</span>
              </span>
            </div>

            <div className="field-cell">
              <span className="field-label">ULTRASUONI A2</span>
              <span
                className="field-value"
                style={{
                  color: ultrasonicMeters > 0 && ultrasonicMeters < 0.8 ? "var(--color-danger)" : undefined
                }}
              >
                {ultrasonicMeters > 0 ? ultrasonicMeters.toFixed(2) : "—"}{" "}
                <span className="field-unit">m</span>
              </span>
            </div>

            <div className="field-cell">
              <span className="field-label">PUNTI LiDAR</span>
              <span className="field-value">
                {lidarPoints} <span className="field-unit">pts</span>
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: IMU Attitude & Position */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, borderTop: "1px solid var(--border-subtle)", paddingTop: 8 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Assetto Dinamico IMU & GNSS
          </div>

          <div className="field-grid mono">
            <div className="field-cell">
              <span className="field-label">PITCH θ</span>
              <span className="field-value">
                {pitchDegrees > 0 ? `+${pitchDegrees.toFixed(1)}` : pitchDegrees.toFixed(1)} <span className="field-unit">°</span>
              </span>
            </div>

            <div className="field-cell">
              <span className="field-label">ROLL φ</span>
              <span className="field-value">
                {rollDegrees > 0 ? `+${rollDegrees.toFixed(1)}` : rollDegrees.toFixed(1)} <span className="field-unit">°</span>
              </span>
            </div>

            <div className="field-cell" style={{ gridColumn: "span 2" }}>
              <span className="field-label">COORDINATE GNSS</span>
              <span className="field-value" style={{ fontSize: 11 }}>
                {latitude !== 0 ? `${latitude.toFixed(5)}°, ${longitude.toFixed(5)}°` : "NO FIX SATELLITARE"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
