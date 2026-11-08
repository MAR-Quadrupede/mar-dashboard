"use client";

import React from "react";
import { Brain, Crosshair, Eye, Radar, Waves, Compass, Cpu, AlertTriangle, Bot } from "lucide-react";
import type { FusionState, HardwareHealth } from "@/lib/fusionTypes";
import { SECTOR_ORDER, riskColor, sectorLabelIt } from "@/lib/fusionTypes";

type Props = {
  fusion?: FusionState | null;
  hardware?: HardwareHealth;
};

const STALE_MS = 4000;

function Chip({
  ok,
  warn,
  label,
  detail,
  icon
}: {
  ok: boolean;
  warn?: boolean;
  label: string;
  detail?: string;
  icon: React.ReactNode;
}) {
  const color = ok ? (warn ? "var(--color-warning)" : "var(--color-success)") : "var(--color-danger)";
  return (
    <div
      className="mono"
      title={detail}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 7px",
        borderRadius: 4,
        border: `1px solid ${color}`,
        background: "var(--bg-input)",
        fontSize: 10,
        color
      }}
    >
      {icon}
      <span style={{ fontWeight: 700 }}>{label}</span>
      {detail ? <span style={{ color: "var(--text-muted)" }}>{detail}</span> : null}
    </div>
  );
}

export function FusionPanel({ fusion, hardware }: Props) {
  const now = Date.now();
  const fresh = fusion ? now - fusion.updatedAt < STALE_MS : false;

  const lidarHw = hardware?.lidar;
  const serialHw = hardware?.serial;
  const lidarOnline = Boolean(fusion?.sensors.lidar) || Boolean(lidarHw?.connected && now - lidarHw.at < STALE_MS);
  const usOnline = Boolean(fusion?.sensors.ultrasonic);
  const usSim = Boolean(serialHw?.ultrasonic_simulated);
  const stereoOnline = Boolean(fusion?.sensors.stereo);
  const imuOnline = Boolean(fusion?.sensors.imu) || Boolean(hardware?.imu?.available && now - (hardware?.imu?.at || 0) < STALE_MS);
  const slamOnline = Boolean(fusion?.sensors.slam);
  const motionOnline = Boolean(serialHw?.motion_connected && now - serialHw.at < STALE_MS);

  const level = fusion?.riskLevel || "LOW";
  const color = riskColor(level);
  const riskPct = Math.round(Math.max(0, Math.min(1, fusion?.riskValue ?? 0)) * 100);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <Brain size={13} color="#a78bfa" />
          <span>SENSOR FUSION & RISCHIO</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {fusion ? (
            <span className={`tag mono ${fusion.autonomous && !fusion.manualOverride ? "tag-success" : "tag-warning"}`}>
              {fusion.manualOverride ? "OVERRIDE MANUALE" : fusion.autonomous ? "AUTONOMO" : "MANUALE"}
            </span>
          ) : null}
          <span className={`tag mono ${fresh ? "tag-info" : "tag-warning"}`}>{fresh ? "ENGINE LIVE" : "ENGINE —"}</span>
        </div>
      </div>

      <div className="panel-body">
        {!fusion ? (
          <div style={{ padding: 12, textAlign: "center", color: "var(--text-muted)", fontSize: 11 }}>
            In attesa del Decision Engine (mar/fsm/state → fusion)…
          </div>
        ) : (
          <>
            {/* Rischio frontale */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Rischio frontale R = 1 − (1−P)(1−Q)
                </span>
                <span className="mono" style={{ fontSize: 11, fontWeight: 700, color }}>
                  {level} · {fusion.riskValue.toFixed(2)}
                </span>
              </div>
              <div style={{ width: "100%", height: 6, background: "var(--bg-input)", borderRadius: 3, overflow: "hidden", position: "relative" }}>
                <div style={{ width: `${riskPct}%`, height: "100%", background: color, transition: "width 120ms linear" }} />
                {[30, 60, 85].map((t) => (
                  <div key={t} style={{ position: "absolute", left: `${t}%`, top: 0, width: 1, height: "100%", background: "rgba(255,255,255,0.25)" }} />
                ))}
              </div>
              <div className="field-grid mono">
                <div className="field-cell">
                  <span className="field-label">US (w {fusion.weights.ultrasonic.toFixed(1)})</span>
                  <span className="field-value" style={{ color: usOnline ? undefined : "var(--text-muted)" }}>
                    {fusion.inputs.ultrasonic_cm != null ? fusion.inputs.ultrasonic_cm.toFixed(0) : "—"} <span className="field-unit">cm</span>
                  </span>
                </div>
                <div className="field-cell">
                  <span className="field-label">LiDAR (w {fusion.weights.lidar.toFixed(1)})</span>
                  <span className="field-value" style={{ color: lidarOnline ? undefined : "var(--text-muted)" }}>
                    {fusion.inputs.lidar_front_cm != null ? fusion.inputs.lidar_front_cm.toFixed(0) : "—"} <span className="field-unit">cm</span>
                  </span>
                </div>
                <div className="field-cell">
                  <span className="field-label">STEREO (w {fusion.weights.stereo.toFixed(1)})</span>
                  <span className="field-value" style={{ color: stereoOnline ? undefined : "var(--text-muted)" }}>
                    {fusion.inputs.stereo_front_cm != null ? fusion.inputs.stereo_front_cm.toFixed(0) : "—"} <span className="field-unit">cm</span>
                  </span>
                </div>
                <div className="field-cell">
                  <span className="field-label">SOGLIA FSM</span>
                  <span className="field-value">
                    {fusion.gateDistCm != null ? fusion.gateDistCm.toFixed(0) : "∞"} <span className="field-unit">cm</span>
                  </span>
                </div>
              </div>
              {fusion.degraded ? (
                <div className="mono" style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 10, color: "var(--color-warning)" }}>
                  <AlertTriangle size={12} /> MODALITÀ DEGRADATA: solo stereocamera in linea (peso 1.0, velocità ridotta)
                </div>
              ) : null}
              {fusion.fovBlocked ? (
                <div className="mono" style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 10, color: "var(--color-danger)" }}>
                  <AlertTriangle size={12} /> FOV stereocamera ostruito
                </div>
              ) : null}
              {fusion.groundHazard ? (
                <div className="mono" style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 10, color: "var(--color-danger)" }}>
                  <AlertTriangle size={12} /> Ostacolo / dislivello a terra
                </div>
              ) : null}
            </div>

            {/* Sensori in linea */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6, borderTop: "1px solid var(--border-subtle)", paddingTop: 8 }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Sorgenti in fusione
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                <Chip ok={lidarOnline} label="LiDAR" icon={<Radar size={11} />} detail={lidarHw?.scan_hz ? `${lidarHw.scan_hz.toFixed(0)} Hz` : lidarHw && !lidarHw.connected ? "no dati" : undefined} />
                <Chip ok={usOnline} warn={usSim} label="US" icon={<Waves size={11} />} detail={usSim ? "simulato" : undefined} />
                <Chip ok={stereoOnline} label="Stereo" icon={<Eye size={11} />} detail={hardware?.vision?.fps_depth ? `${hardware.vision.fps_depth.toFixed(0)} fps` : undefined} />
                <Chip ok={Boolean(hardware?.vision?.fps_yolo)} label="YOLO" icon={<Crosshair size={11} />} detail={hardware?.vision?.fps_yolo ? `${hardware.vision.fps_yolo.toFixed(1)} Hz` : "off"} />
                <Chip ok={imuOnline} label="IMU" icon={<Compass size={11} />} detail={hardware?.imu && !hardware.imu.available ? "in attesa" : undefined} />
                <Chip ok={slamOnline} label="SLAM" icon={<Cpu size={11} />} detail={lidarHw?.slam_points ? `${lidarHw.slam_points} celle` : undefined} />
                <Chip ok={motionOnline} label="Motion" icon={<Bot size={11} />} detail={serialHw ? (serialHw.motion_connected ? serialHw.motion_port || "" : "Arduino assente") : undefined} />
              </div>
            </div>

            {/* Settori */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, borderTop: "1px solid var(--border-subtle)", paddingTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Rischio per settore (8 × 45°)
                </span>
                {fusion.navigation.choice ? (
                  <span className="mono" style={{ fontSize: 10, color: "#38bdf8" }}>
                    rotta → {fusion.navigation.choice}
                  </span>
                ) : null}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 4 }}>
                {SECTOR_ORDER.map((name) => {
                  const s = fusion.sectors[name];
                  const r = s?.risk ?? 0;
                  const c = riskColor(s?.level);
                  const chosen = fusion.navigation.choice === name;
                  const d = s?.fused_dist_cm;
                  return (
                    <div
                      key={name}
                      className="mono"
                      style={{
                        border: `1px solid ${chosen ? "#38bdf8" : "var(--border-subtle)"}`,
                        borderRadius: 4,
                        padding: "3px 5px",
                        background: "var(--bg-input)",
                        fontSize: 9.5
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
                        <span>{sectorLabelIt(name)}</span>
                        <span style={{ color: c, fontWeight: 700 }}>{r.toFixed(2)}</span>
                      </div>
                      <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginTop: 2, overflow: "hidden" }}>
                        <div style={{ width: `${Math.round(r * 100)}%`, height: "100%", background: c }} />
                      </div>
                      <div style={{ color: "var(--text-muted)", marginTop: 2 }}>
                        {d != null && d < 900 ? `${d.toFixed(0)} cm` : "libero"}
                        {s?.objects && s.objects.length ? ` · ${s.objects.length} ogg.` : ""}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Oggetti YOLO */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4, borderTop: "1px solid var(--border-subtle)", paddingTop: 8 }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Oggetti riconosciuti (peso pieno come presenza)
              </div>
              {fusion.objects.length === 0 ? (
                <div className="mono" style={{ fontSize: 10, color: "var(--text-muted)" }}>Nessun oggetto nel campo visivo</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {fusion.objects.slice(0, 5).map((o, i) => (
                    <div key={`${o.class}-${i}`} className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
                      <span style={{ color: "#f1f5f9" }}>
                        {o.class} <span style={{ color: "var(--text-muted)" }}>{Math.round(o.confidence * 100)}%</span>
                      </span>
                      <span style={{ color: "var(--text-muted)" }}>
                        {o.dist_cm != null ? `${o.dist_cm.toFixed(0)} cm` : "dist n/d"} · {o.bearing_deg >= 0 ? "+" : ""}
                        {o.bearing_deg.toFixed(0)}° · {o.sector || "—"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
