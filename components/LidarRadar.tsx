"use client";

import React, { useEffect, useRef, useState } from "react";
import { Radar, Compass, MapPin } from "lucide-react";

export type LidarPoint = [number, number]; // [angle_deg, dist_m]

type Props = {
  points?: LidarPoint[];
  frontDistanceM?: number;
  maxRangeM?: number;
  slamPose?: {
    x_m?: number;
    y_m?: number;
    theta_deg?: number;
    linear_speed_mps?: number;
    angular_speed_dps?: number;
    distance_traveled_m?: number;
    map_points_count?: number;
    room_bounds_m?: {
      min_x: number;
      max_x: number;
      min_y: number;
      max_y: number;
      width_m: number;
      length_m: number;
      area_m2: number;
    };
  } | null;
  slamMap?: {
    pose?: { x: number; y: number; theta: number };
    trajectory?: [number, number][];
    cloud?: [number, number][];
    room?: { width_m: number; length_m: number; area_m2: number };
    point_count?: number;
  } | null;
};

export function LidarRadar({ points = [], frontDistanceM, maxRangeM = 4, slamPose, slamMap }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [viewMode, setViewMode] = useState<"radar" | "slam">("slam");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const css = 260;
    canvas.width = css * dpr;
    canvas.height = css * dpr;
    canvas.style.width = `${css}px`;
    canvas.style.height = `${css}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#090a0d";
    ctx.fillRect(0, 0, css, css);

    if (viewMode === "radar") {
      // ================= RADAR POLARE 360° =================
      const cx = css / 2;
      const cy = css / 2;
      const R = css * 0.42;

      // Range rings
      ctx.strokeStyle = "#1e232e";
      ctx.lineWidth = 1;
      for (const frac of [0.25, 0.5, 0.75, 1]) {
        ctx.beginPath();
        ctx.arc(cx, cy, R * frac, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#64748b";
        ctx.font = "9px ui-monospace, monospace";
        ctx.fillText(`${(maxRangeM * frac).toFixed(1)}m`, cx + 4, cy - R * frac + 9);
      }

      // Cross axes
      ctx.strokeStyle = "#2a3140";
      ctx.beginPath();
      ctx.moveTo(cx, cy - R);
      ctx.lineTo(cx, cy + R);
      ctx.moveTo(cx - R, cy);
      ctx.lineTo(cx + R, cy);
      ctx.stroke();

      // Forward safety cone (45°)
      ctx.fillStyle = "rgba(56, 189, 248, 0.05)";
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, (-22.5 * Math.PI) / 180 - Math.PI / 2, (22.5 * Math.PI) / 180 - Math.PI / 2);
      ctx.closePath();
      ctx.fill();

      // Points
      for (const pt of points) {
        if (!pt || pt.length < 2) continue;
        const ang = Number(pt[0]);
        const dist = Number(pt[1]);
        if (!Number.isFinite(ang) || !Number.isFinite(dist) || dist <= 0) continue;
        const r = (Math.min(dist, maxRangeM) / maxRangeM) * R;
        const rad = ((ang - 90) * Math.PI) / 180;
        const x = cx + r * Math.cos(rad);
        const y = cy + r * Math.sin(rad);
        const near = dist < 0.35;
        ctx.fillStyle = near ? "#ef4444" : dist < 0.7 ? "#eab308" : "#38bdf8";
        ctx.beginPath();
        ctx.arc(x, y, near ? 2.5 : 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Robot glyph
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.moveTo(cx, cy - 7);
      ctx.lineTo(cx - 5, cy + 5);
      ctx.lineTo(cx + 5, cy + 5);
      ctx.closePath();
      ctx.fill();

      if (frontDistanceM != null && frontDistanceM > 0 && frontDistanceM < 90) {
        ctx.fillStyle = frontDistanceM < 0.35 ? "#ef4444" : "#f1f5f9";
        ctx.font = "bold 10px ui-monospace, monospace";
        ctx.fillText(`FRONTE: ${frontDistanceM.toFixed(2)} m`, cx - 35, cy + R + 14);
      }
    } else {
      // ================= MAPPA SLAM 2D DELLA STANZA =================
      const cx = css / 2;
      const cy = css / 2;

      // Coordinate scala stanza (default 6m vista)
      const scaleM = 6.0;
      const pxPerM = (css * 0.42) / (scaleM / 2);

      // Disegna griglia metrica mondo (1 metro a maglia)
      ctx.strokeStyle = "#161b26";
      ctx.lineWidth = 1;
      for (let m = -4; m <= 4; m++) {
        const gx = cx + m * pxPerM;
        const gy = cy - m * pxPerM;
        ctx.beginPath();
        ctx.moveTo(gx, 10);
        ctx.lineTo(gx, css - 10);
        ctx.moveTo(10, gy);
        ctx.lineTo(css - 10, gy);
        ctx.stroke();
      }

      // Assi cartesiani mondo (0, 0)
      ctx.strokeStyle = "#243046";
      ctx.beginPath();
      ctx.moveTo(cx, 10);
      ctx.lineTo(cx, css - 10);
      ctx.moveTo(10, cy);
      ctx.lineTo(css - 10, cy);
      ctx.stroke();

      // Punti Mappa Stanza (ostacoli e muri rilevati dalla mappa globale SLAM)
      const cloud = slamMap?.cloud || [];
      ctx.fillStyle = "#06b6d4";
      for (const pt of cloud) {
        const mx = cx + pt[0] * pxPerM;
        const my = cy - pt[1] * pxPerM;
        if (mx >= 5 && mx <= css - 5 && my >= 5 && my <= css - 5) {
          ctx.fillRect(mx - 1, my - 1, 2, 2);
        }
      }

      // Se la mappa globale è ancora in caricamento, visualizza i punti live della scansione locale
      if (cloud.length === 0 && points.length > 0) {
        ctx.fillStyle = "rgba(56, 189, 248, 0.75)";
        for (const pt of points) {
          if (!pt || pt.length < 2) continue;
          const ang = Number(pt[0]);
          const dist = Number(pt[1]);
          if (!Number.isFinite(ang) || !Number.isFinite(dist) || dist <= 0.2) continue;
          const rad = ((ang - 90) * Math.PI) / 180;
          const mx = cx + (dist * Math.cos(rad)) * pxPerM;
          const my = cy + (dist * Math.sin(rad)) * pxPerM;
          if (mx >= 5 && mx <= css - 5 && my >= 5 && my <= css - 5) {
            ctx.fillRect(mx - 1, my - 1, 2, 2);
          }
        }
      }

      // Traiettoria percorsa dal robot
      const traj = slamMap?.trajectory || [];
      if (traj.length > 1) {
        ctx.strokeStyle = "rgba(234, 179, 8, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < traj.length; i++) {
          const tx = cx + traj[i][0] * pxPerM;
          const ty = cy - traj[i][1] * pxPerM;
          if (i === 0) ctx.moveTo(tx, ty);
          else ctx.lineTo(tx, ty);
        }
        ctx.stroke();
      }

      // Posa corrente robot (X, Y, Theta)
      const rx = (slamPose?.x_m ?? slamMap?.pose?.x ?? 0) * pxPerM;
      const ry = -(slamPose?.y_m ?? slamMap?.pose?.y ?? 0) * pxPerM;
      const th = ((slamPose?.theta_deg ?? slamMap?.pose?.theta ?? 0) * Math.PI) / 180;

      const robX = cx + rx;
      const robY = cy + ry;

      // Robot cono visivo e corpo orientato
      ctx.save();
      ctx.translate(robX, robY);
      ctx.rotate(-th + Math.PI / 2); // 0° = +X (destra) o up a seconda della convenzione

      // Triangolo corpo robot
      ctx.fillStyle = "#22c55e";
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(-6, 6);
      ctx.lineTo(6, 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Testo metrico stanza / localizzazione
      const room = slamPose?.room_bounds_m || slamMap?.room;
      ctx.fillStyle = "#94a3b8";
      ctx.font = "9px ui-monospace, monospace";
      if (room && room.width_m > 0) {
        ctx.fillText(`STANZA: ${room.width_m.toFixed(1)}x${room.length_m.toFixed(1)}m (${room.area_m2.toFixed(1)}m²)`, 10, css - 22);
      }
      const xStr = (slamPose?.x_m ?? 0) >= 0 ? `+${(slamPose?.x_m ?? 0).toFixed(2)}` : (slamPose?.x_m ?? 0).toFixed(2);
      const yStr = (slamPose?.y_m ?? 0) >= 0 ? `+${(slamPose?.y_m ?? 0).toFixed(2)}` : (slamPose?.y_m ?? 0).toFixed(2);
      ctx.fillText(`POSA: X:${xStr}m Y:${yStr}m θ:${(slamPose?.theta_deg ?? 0).toFixed(0)}°`, 10, css - 10);
    }
  }, [points, frontDistanceM, maxRangeM, viewMode, slamPose, slamMap]);

  const mapCount =
    (slamMap?.point_count != null && slamMap.point_count > 0)
      ? slamMap.point_count
      : (slamPose?.map_points_count != null && slamPose.map_points_count > 0)
      ? slamPose.map_points_count
      : points.length;

  return (
    <div className="panel">
      <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="panel-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {viewMode === "slam" ? <MapPin size={13} color="#06b6d4" /> : <Radar size={13} color="#38bdf8" />}
          <span>{viewMode === "slam" ? "LOCALIZZAZIONE & SLAM STANZA" : "RADAR LiDAR 360°"}</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            type="button"
            onClick={() => setViewMode("slam")}
            style={{
              padding: "2px 6px",
              fontSize: 10,
              borderRadius: 4,
              border: "1px solid",
              borderColor: viewMode === "slam" ? "#06b6d4" : "#334155",
              background: viewMode === "slam" ? "rgba(6,182,212,0.2)" : "transparent",
              color: viewMode === "slam" ? "#38bdf8" : "#94a3b8",
              cursor: "pointer"
            }}
          >
            Mappa 2D
          </button>
          <button
            type="button"
            onClick={() => setViewMode("radar")}
            style={{
              padding: "2px 6px",
              fontSize: 10,
              borderRadius: 4,
              border: "1px solid",
              borderColor: viewMode === "radar" ? "#38bdf8" : "#334155",
              background: viewMode === "radar" ? "rgba(56,189,248,0.2)" : "transparent",
              color: viewMode === "radar" ? "#38bdf8" : "#94a3b8",
              cursor: "pointer"
            }}
          >
            Radar
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "6px 0" }}>
        <canvas ref={canvasRef} style={{ borderRadius: "var(--radius-xs)" }} />
        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", padding: "4px 10px", fontSize: 10, color: "#64748b" }}>
          <span>Mappa: {mapCount} celle</span>
          <span>Percorsi: {slamPose?.distance_traveled_m?.toFixed(2) ?? "0.00"} m</span>
        </div>
      </div>
    </div>
  );
}
