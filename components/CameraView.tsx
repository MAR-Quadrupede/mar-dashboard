"use client";

import React, { useState } from "react";
import { Camera, RefreshCw, Maximize2, AlertCircle } from "lucide-react";

type Stream = {
  id: string;
  name: string;
  url: string;
  role: string;
  active: boolean;
};

type Props = {
  streams?: Stream[];
};

export function CameraView({ streams = [] }: Props) {
  const [viewMode, setViewMode] = useState<"dual" | "left" | "right">("dual");
  const [refreshKey, setRefreshKey] = useState(0);

  const leftStream = streams.find((s) => s.role === "left_yolo" || s.id === "left") || {
    id: "left",
    name: "Camera Sinistra (YOLO)",
    url: "http://100.77.16.116:8443/stream_left.mjpg"
  };

  const rightStream = streams.find((s) => s.role === "right_depth" || s.id === "right") || {
    id: "right",
    name: "Camera Destra (Depth)",
    url: "http://100.77.16.116:8443/stream_right.mjpg"
  };

  const reload = () => setRefreshKey((k) => k + 1);

  return (
    <div className="card">
      {/* Header */}
      <div className="card-header">
        <div className="card-title">
          <Camera size={15} />
          <span>Visione Stereoscopica in Tempo Reale</span>
        </div>

        {/* View Switchers */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ display: "flex", background: "var(--bg-app)", padding: 2, borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
            <button
              className={`btn btn-sm ${viewMode === "dual" ? "btn-primary" : ""}`}
              style={{ border: "none", padding: "2px 8px", fontSize: 11 }}
              onClick={() => setViewMode("dual")}
            >
              Dual
            </button>
            <button
              className={`btn btn-sm ${viewMode === "left" ? "btn-primary" : ""}`}
              style={{ border: "none", padding: "2px 8px", fontSize: 11 }}
              onClick={() => setViewMode("left")}
            >
              Sinistra (YOLO)
            </button>
            <button
              className={`btn btn-sm ${viewMode === "right" ? "btn-primary" : ""}`}
              style={{ border: "none", padding: "2px 8px", fontSize: 11 }}
              onClick={() => setViewMode("right")}
            >
              Destra (Depth)
            </button>
          </div>

          <button className="btn btn-sm" onClick={reload} title="Ricarica streaming">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Camera Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: viewMode === "dual" ? "1fr 1fr" : "1fr",
          gap: 12
        }}
      >
        {(viewMode === "dual" || viewMode === "left") && (
          <CameraFeedTile
            key={`left-${refreshKey}`}
            url={`${leftStream.url}?k=${refreshKey}`}
            label="Camera Sinistra // YOLO On-Edge"
            badge="AI Inference"
          />
        )}

        {(viewMode === "dual" || viewMode === "right") && (
          <CameraFeedTile
            key={`right-${refreshKey}`}
            url={`${rightStream.url}?k=${refreshKey}`}
            label="Camera Destra // Stereoscopia"
            badge="Depth Map"
          />
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", paddingTop: 4 }}>
        <span>Global Shutter 30 FPS • Protocollo MJPEG</span>
        <span className="mono">{leftStream.url}</span>
      </div>
    </div>
  );
}

function CameraFeedTile({ url, label, badge }: { url: string; label: string; badge: string }) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  return (
    <div
      style={{
        position: "relative",
        background: "var(--bg-app)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-sm)",
        aspectRatio: "16 / 9",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      {!error && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={url}
          alt={label}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: loaded ? "block" : "none" }}
          onLoad={() => {
            setLoaded(true);
            setError(false);
          }}
          onError={() => {
            setError(true);
            setLoaded(false);
          }}
        />
      )}

      {!loaded && !error && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <span>Connessione al flusso video in corso...</span>
          <span className="mono" style={{ fontSize: 10, opacity: 0.6 }}>{url}</span>
        </div>
      )}

      {error && (
        <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "var(--text-muted)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <AlertCircle size={20} color="var(--color-warning)" />
          <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Flusso non disponibile</span>
          <span style={{ fontSize: 11, maxWidth: 260 }}>Verifica che il modulo stereocamera sia attivo sulla porta 8443</span>
          <button className="btn btn-sm" onClick={() => setError(false)} style={{ marginTop: 4 }}>
            Riprova
          </button>
        </div>
      )}

      {/* Top Banner */}
      <div
        style={{
          position: "absolute",
          top: 6,
          left: 6,
          right: 6,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          pointerEvents: "none"
        }}
      >
        <span
          style={{
            background: "rgba(11, 15, 25, 0.75)",
            backdropFilter: "blur(2px)",
            padding: "2px 6px",
            borderRadius: 3,
            fontSize: 10,
            fontWeight: 600,
            color: "var(--text-main)"
          }}
        >
          {label}
        </span>
        <span
          style={{
            background: "rgba(11, 15, 25, 0.75)",
            backdropFilter: "blur(2px)",
            padding: "2px 6px",
            borderRadius: 3,
            fontSize: 10,
            color: "var(--color-info)"
          }}
        >
          {badge}
        </span>
      </div>
    </div>
  );
}
