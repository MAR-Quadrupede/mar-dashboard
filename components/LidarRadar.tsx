"use client";

import React, { useEffect, useRef } from "react";
import { Radar } from "lucide-react";

export type LidarPoint = [number, number]; // [angle_deg, dist_m]

type Props = {
  points?: LidarPoint[];
  frontDistanceM?: number;
  maxRangeM?: number;
};

/** Top-down polar LiDAR cloud (robot at center, 0° = up / fronte). */
export function LidarRadar({ points = [], frontDistanceM, maxRangeM = 4 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    const cx = css / 2;
    const cy = css / 2;
    const R = css * 0.42;

    ctx.fillStyle = "#0b0f19";
    ctx.fillRect(0, 0, css, css);

    // range rings
    ctx.strokeStyle = "rgba(148,163,184,0.25)";
    ctx.lineWidth = 1;
    for (const frac of [0.25, 0.5, 0.75, 1]) {
      ctx.beginPath();
      ctx.arc(cx, cy, R * frac, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = "rgba(148,163,184,0.55)";
      ctx.font = "9px ui-monospace, monospace";
      ctx.fillText(`${(maxRangeM * frac).toFixed(1)}m`, cx + 4, cy - R * frac + 10);
    }

    // axes
    ctx.strokeStyle = "rgba(56,189,248,0.35)";
    ctx.beginPath();
    ctx.moveTo(cx, cy - R);
    ctx.lineTo(cx, cy + R);
    ctx.moveTo(cx - R, cy);
    ctx.lineTo(cx + R, cy);
    ctx.stroke();

    // forward wedge
    ctx.fillStyle = "rgba(16,185,129,0.08)";
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, R, (-22.5 * Math.PI) / 180 - Math.PI / 2, (22.5 * Math.PI) / 180 - Math.PI / 2);
    ctx.closePath();
    ctx.fill();

    // points: 0° = fronte = up
    for (const pt of points) {
      if (!pt || pt.length < 2) continue;
      const ang = Number(pt[0]);
      const dist = Number(pt[1]);
      if (!Number.isFinite(ang) || !Number.isFinite(dist) || dist <= 0) continue;
      const r = Math.min(dist, maxRangeM) / maxRangeM * R;
      const rad = ((ang - 90) * Math.PI) / 180; // 0° up
      const x = cx + r * Math.cos(rad);
      const y = cy + r * Math.sin(rad);
      const near = dist < 0.7;
      ctx.fillStyle = near ? "#ef4444" : dist < 1.2 ? "#f59e0b" : "#38bdf8";
      ctx.beginPath();
      ctx.arc(x, y, near ? 2.2 : 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // robot
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx - 6, cy + 6);
    ctx.lineTo(cx + 6, cy + 6);
    ctx.closePath();
    ctx.fill();

    if (frontDistanceM != null && frontDistanceM > 0 && frontDistanceM < 90) {
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "bold 11px ui-monospace, monospace";
      ctx.fillText(`F ${frontDistanceM.toFixed(2)} m`, cx - 28, cy + R + 16);
    }
  }, [points, frontDistanceM, maxRangeM]);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <Radar size={15} />
          <span>LiDAR — Nuvola 360°</span>
        </div>
        <span className="badge badge-info mono">{points.length} pts</span>
      </div>
      <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 8px" }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
