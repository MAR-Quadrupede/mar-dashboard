"use client";

import React, { useState, useEffect, useRef } from "react";
import { Camera, RefreshCw, Maximize2, AlertCircle, Play, Image as ImageIcon } from "lucide-react";

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

function resolveStreamUrl(rawUrl?: string, defaultPath: string = "/api/video/left"): string {
  if (!rawUrl) return defaultPath;
  if (rawUrl.includes("100.77.16.116") || rawUrl.includes(":8443") || rawUrl.includes(":30080")) {
    return defaultPath;
  }
  return rawUrl.startsWith("/") ? rawUrl : defaultPath;
}

export function CameraView({ streams = [] }: Props) {
  const [viewMode, setViewMode] = useState<"dual" | "left" | "right">("dual");
  const [refreshKey, setRefreshKey] = useState(0);

  const rawLeft = streams.find((s) => s.role === "left_yolo" || s.id === "left")?.url;
  const rawRight = streams.find((s) => s.role === "right_depth" || s.id === "right")?.url;

  const leftStream = {
    id: "left",
    name: "Camera Sinistra // YOLO On-Edge",
    url: resolveStreamUrl(rawLeft, "/api/video/left"),
    snapshotUrl: "/api/video/left?snapshot=1"
  };

  const rightStream = {
    id: "right",
    name: "Camera Destra // Stereoscopia",
    url: resolveStreamUrl(rawRight, "/api/video/right"),
    snapshotUrl: "/api/video/right?snapshot=1"
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
            fallbackSnapshotUrl={leftStream.snapshotUrl}
            label="Camera Sinistra // YOLO On-Edge"
            badge="AI Inference"
          />
        )}

        {(viewMode === "dual" || viewMode === "right") && (
          <CameraFeedTile
            key={`right-${refreshKey}`}
            url={`${rightStream.url}?k=${refreshKey}`}
            fallbackSnapshotUrl={rightStream.snapshotUrl}
            label="Camera Destra // Stereoscopia"
            badge="Depth Map"
          />
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-muted)", paddingTop: 4 }}>
        <span>Global Shutter 30 FPS • Protocollo MJPEG / Proxy K8s</span>
        <span className="mono">mar-vision-service:8443</span>
      </div>
    </div>
  );
}

function CameraFeedTile({
  url,
  fallbackSnapshotUrl,
  label,
  badge
}: {
  url: string;
  fallbackSnapshotUrl: string;
  label: string;
  badge: string;
}) {
  const [streamError, setStreamError] = useState(false);
  const [useSnapshot, setUseSnapshot] = useState(false);
  const [snapshotSrc, setSnapshotSrc] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const errorCountRef = useRef(0);

  // Snapshot polling fallback if browser blocks multipart streaming
  useEffect(() => {
    if (!useSnapshot || !fallbackSnapshotUrl) return;

    let mounted = true;
    const interval = setInterval(() => {
      if (mounted) {
        setSnapshotSrc(`${fallbackSnapshotUrl}&_t=${Date.now()}`);
      }
    }, 120);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [useSnapshot, fallbackSnapshotUrl]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleImageError = () => {
    if (!useSnapshot) {
      console.warn(`MJPEG stream error on ${url}, switching to snapshot mode.`);
      setUseSnapshot(true);
      setSnapshotSrc(`${fallbackSnapshotUrl}&_t=${Date.now()}`);
      errorCountRef.current = 0;
    } else {
      errorCountRef.current += 1;
      if (errorCountRef.current > 8) {
        setStreamError(true);
      }
    }
  };

  const handleImageLoad = () => {
    errorCountRef.current = 0;
    if (streamError) setStreamError(false);
  };

  const currentSrc = useSnapshot ? (snapshotSrc || `${fallbackSnapshotUrl}&_t=${Date.now()}`) : url;

  return (
    <div
      ref={containerRef}
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={currentSrc}
        alt={label}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: streamError ? "none" : "block"
        }}
        onError={handleImageError}
        onLoad={handleImageLoad}
      />

      {streamError && (
        <div style={{ padding: 16, textAlign: "center", fontSize: 12, color: "var(--text-muted)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <AlertCircle size={20} color="var(--color-warning)" />
          <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Flusso non disponibile</span>
          <span style={{ fontSize: 11, maxWidth: 260 }}>Verifica connessione al servizio stereocamera</span>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button
              className="btn btn-sm"
              onClick={() => {
                errorCountRef.current = 0;
                setStreamError(false);
                setUseSnapshot(false);
              }}
            >
              Riprova Stream
            </button>
            <button
              className="btn btn-sm"
              onClick={() => {
                errorCountRef.current = 0;
                setStreamError(false);
                setUseSnapshot(true);
                setSnapshotSrc(`${fallbackSnapshotUrl}&_t=${Date.now()}`);
              }}
            >
              Modalità Snapshot
            </button>
          </div>
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
          pointerEvents: "auto"
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

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {/* Mode Switch Button */}
          <button
            onClick={() => {
              const next = !useSnapshot;
              setUseSnapshot(next);
              if (next) {
                setSnapshotSrc(`${fallbackSnapshotUrl}&_t=${Date.now()}`);
              }
            }}
            style={{
              background: useSnapshot ? "rgba(234, 179, 8, 0.85)" : "rgba(11, 15, 25, 0.75)",
              color: useSnapshot ? "#000" : "var(--color-info)",
              border: "none",
              cursor: "pointer",
              padding: "2px 6px",
              borderRadius: 3,
              fontSize: 9,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 3
            }}
            title={useSnapshot ? "Passa a Stream Continuo" : "Passa a Snapshot Polling"}
          >
            {useSnapshot ? <ImageIcon size={10} /> : <Play size={10} />}
            {useSnapshot ? "SNAPSHOT" : "STREAM"}
          </button>

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

          <button
            onClick={toggleFullscreen}
            style={{
              background: "rgba(11, 15, 25, 0.75)",
              border: "none",
              color: "var(--text-main)",
              cursor: "pointer",
              padding: "3px 5px",
              borderRadius: 3,
              display: "flex",
              alignItems: "center"
            }}
            title="Schermo intero"
          >
            <Maximize2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}
