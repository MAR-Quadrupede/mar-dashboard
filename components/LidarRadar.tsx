"use client";

import React, { useEffect, useRef } from "react";
import { Radar } from "lucide-react";

export type LidarPoint = [number, number]; // [angle_deg, dist_m]

type Props = {
  points?: LidarPoint[];
  frontDistanceM?: number;
  maxRangeM?: number;
};

/** Polar LiDAR Radar Scope (robot at center, 0° = up / forward). */
export function LidarRadar({ points = [], frontDistanceM, maxRangeM = 4 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const css = 240;
    canvas.width = css * dpr;
    canvas.height = css * dpr;
    canvas.style.width = `${css}px`;
    canvas.style.height = `${css}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const cx = css / 2;
    const cy = css / 2;
    const R = css * 0.42;

    ctx.fillStyle = "#090a0d";
    ctx.fillRect(0, 0, css, css);

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

    // LiDAR points
    for (const pt of points) {
      if (!pt || pt.length < 2) continue;
      const ang = Number(pt[0]);
      const dist = Number(pt[1]);
      if (!Number.isFinite(ang) || !Number.isFinite(dist) || dist <= 0) continue;
      const r = (Math.min(dist, maxRangeM) / maxRangeM) * R;
      const rad = ((ang - 90) * Math.PI) / 180;
      const x = cx + r * Math.cos(rad);
      const y = cy + r * Math.sin(rad);
      const near = dist < 0.7;
      ctx.fillStyle = near ? "#ef4444" : dist < 1.2 ? "#eab308" : "#38bdf8";
      ctx.beginPath();
      ctx.arc(x, y, near ? 2 : 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Robot center glyph
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.moveTo(cx, cy - 7);
    ctx.lineTo(cx - 5, cy + 5);
    ctx.lineTo(cx + 5, cy + 5);
    ctx.closePath();
    ctx.fill();

    // Forward reading tag
    if (frontDistanceM != null && frontDistanceM > 0 && frontDistanceM < 90) {
      ctx.fillStyle = frontDistanceM < 0.8 ? "#ef4444" : "#f1f5f9";
      ctx.font = "bold 10px ui-monospace, monospace";
      ctx.fillText(`FRONTE: ${frontDistanceM.toFixed(2)} m`, cx - 35, cy + R + 14);
    }
  }, [points, frontDistanceM, maxRangeM]);

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <Radar size={13} />
          <span>RADAR LiDAR 360°</span>
        </div>
        <span className="tag mono">{points.length} PTS</span>
      </div>

      <div style={{ display: "flex", justifyContent: "center", padding: "8px 0" }}>
        <canvas ref={canvasRef} style={{ borderRadius: "var(--radius-xs)" }} />
      </div>
    </div>
  );
}
