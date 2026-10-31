"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
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
  visionFps?: { camera?: number; depth?: number; stream?: number } | null;
};

function isSafariBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Android/i.test(ua);
}

function resolveStreamUrl(rawUrl?: string, defaultPath: string = "/api/video/left"): string {
  if (!rawUrl) return defaultPath;
  if (
    rawUrl.includes("100.77.") ||
    rawUrl.includes("100.72.") ||
    rawUrl.includes(":8443") ||
    rawUrl.includes(":30080") ||
    rawUrl.includes("localhost")
  ) {
    return defaultPath;
  }
  return rawUrl.startsWith("/") ? rawUrl : defaultPath;
}

function withQuery(url: string, params: Record<string, string | number>): string {
  const u = new URL(url, "http://local");
  Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, String(v)));
  return `${u.pathname}${u.search}`;
}

/** Parse MJPEG multipart (or raw concatenated JPEGs) and paint onto a canvas. */
async function playMjpegToCanvas(
  url: string,
  canvas: HTMLCanvasElement,
  signal: AbortSignal,
  onFrame: () => void
): Promise<void> {
  const res = await fetch(url, {
    cache: "no-store",
    signal,
    headers: { Accept: "multipart/x-mixed-replace, image/jpeg, */*" }
  });
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) throw new Error("no 2d context");

  let buffer = new Uint8Array(0);
  const append = (chunk: Uint8Array) => {
    const next = new Uint8Array(buffer.length + chunk.length);
    next.set(buffer, 0);
    next.set(chunk, buffer.length);
    buffer = next;
  };

  const findMarker = (arr: Uint8Array, a: number, b: number, from: number) => {
    for (let i = from; i < arr.length - 1; i++) {
      if (arr[i] === a && arr[i + 1] === b) return i;
    }
    return -1;
  };

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) append(value);

    // Extract complete JPEG frames (FFD8 … FFD9)
    while (true) {
      const soi = findMarker(buffer, 0xff, 0xd8, 0);
      if (soi < 0) {
        // keep last byte in case of split marker
        buffer = buffer.length ? buffer.slice(-1) : buffer;
        break;
      }
      if (soi > 0) buffer = buffer.slice(soi);
      const eoi = findMarker(buffer, 0xff, 0xd9, 2);
      if (eoi < 0) break;

      const frame = buffer.slice(0, eoi + 2);
      buffer = buffer.slice(eoi + 2);

      const blob = new Blob([frame], { type: "image/jpeg" });
      const bmp = await createImageBitmap(blob);
      if (canvas.width !== bmp.width || canvas.height !== bmp.height) {
        canvas.width = bmp.width;
        canvas.height = bmp.height;
      }
      ctx.drawImage(bmp, 0, 0);
      bmp.close();
      onFrame();
    }

    // Cap buffer growth if stream is corrupt
    if (buffer.length > 2_000_000) {
      buffer = buffer.slice(-64_000);
    }
  }
}

export function CameraView({ streams = [], visionFps = null }: Props) {
  const [viewMode, setViewMode] = useState<"dual" | "left" | "right">("dual");
  const [refreshKey, setRefreshKey] = useState(0);
  const [safari, setSafari] = useState(false);

  useEffect(() => {
    setSafari(isSafariBrowser());
  }, []);

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

  const camFps = visionFps?.camera;
  const depthFps = visionFps?.depth;
  const fpsLabel =
    camFps != null
      ? `Sorgente camera ${camFps.toFixed(0)} FPS · depth ${(depthFps ?? camFps).toFixed(0)} FPS`
      : "Stream MJPEG (FPS riquadro = frame effettivamente disegnati)";

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <Camera size={15} />
          <span>Visione Stereoscopica in Tempo Reale</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              display: "flex",
              background: "var(--bg-app)",
              padding: 2,
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border-subtle)"
            }}
          >
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
              Sinistra
            </button>
            <button
              className={`btn btn-sm ${viewMode === "right" ? "btn-primary" : ""}`}
              style={{ border: "none", padding: "2px 8px", fontSize: 11 }}
              onClick={() => setViewMode("right")}
            >
              Destra
            </button>
          </div>

          <button className="btn btn-sm" onClick={reload} title="Ricarica streaming">
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {safari && (
        <div
          style={{
            margin: "0 0 10px",
            padding: "8px 10px",
            fontSize: 11,
            lineHeight: 1.35,
            color: "var(--text-secondary)",
            background: "rgba(56, 189, 248, 0.1)",
            border: "1px solid rgba(56, 189, 248, 0.35)",
            borderRadius: "var(--radius-sm)"
          }}
        >
          Su Safari lo stream usa un player MJPEG via fetch/canvas (non &lt;img&gt; multipart). Se resta lento,
          Chrome è comunque più efficiente — ma non è obbligatorio.
        </div>
      )}

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
            url={withQuery(leftStream.url, { k: refreshKey })}
            fallbackSnapshotUrl={leftStream.snapshotUrl}
            label="Camera Sinistra"
            badge="Left / HUD"
          />
        )}

        {(viewMode === "dual" || viewMode === "right") && (
          <CameraFeedTile
            key={`right-${refreshKey}`}
            url={withQuery(rightStream.url, { k: refreshKey })}
            fallbackSnapshotUrl={rightStream.snapshotUrl}
            label="Camera Destra"
            badge="Right eye"
          />
        )}
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          color: "var(--text-muted)",
          paddingTop: 4
        }}
      >
        <span>{fpsLabel}</span>
        <span className="mono">proxy /api/video → :30080</span>
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
  const [mode, setMode] = useState<"stream" | "snapshot">("stream");
  const [streamError, setStreamError] = useState(false);
  const [snapshotSrc, setSnapshotSrc] = useState("");
  const [displayFps, setDisplayFps] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const errorCountRef = useRef(0);
  const fpsCountRef = useRef(0);
  const fpsTsRef = useRef(0);

  const bumpFps = useCallback(() => {
    fpsCountRef.current += 1;
    const now = performance.now();
    if (!fpsTsRef.current) fpsTsRef.current = now;
    const dt = now - fpsTsRef.current;
    if (dt >= 1000) {
      setDisplayFps(Math.round((fpsCountRef.current * 1000) / dt));
      fpsCountRef.current = 0;
      fpsTsRef.current = now;
    }
  }, []);

  // Continuous MJPEG via fetch → canvas (works Chrome + Safari; counts real FPS)
  useEffect(() => {
    if (mode !== "stream") return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ac = new AbortController();
    let stopped = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const run = async () => {
      try {
        setStreamError(false);
        await playMjpegToCanvas(url, canvas, ac.signal, bumpFps);
        if (!stopped && !ac.signal.aborted) {
          // stream ended — retry
          retryTimer = setTimeout(run, 400);
        }
      } catch (e) {
        if (ac.signal.aborted || stopped) return;
        errorCountRef.current += 1;
        if (errorCountRef.current >= 3) {
          console.warn("MJPEG canvas player failed, falling back to snapshot", e);
          setMode("snapshot");
          setStreamError(false);
        } else {
          retryTimer = setTimeout(run, 500);
        }
      }
    };

    run();
    return () => {
      stopped = true;
      ac.abort();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [mode, url, bumpFps]);

  // Snapshot fallback polling (~10 Hz)
  useEffect(() => {
    if (mode !== "snapshot") return;
    let mounted = true;
    let inFlight = false;

    const tick = async () => {
      if (!mounted || inFlight) return;
      inFlight = true;
      try {
        const src = withQuery(fallbackSnapshotUrl, { _t: Date.now() });
        const res = await fetch(src, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const obj = URL.createObjectURL(blob);
        if (mounted) {
          setSnapshotSrc((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return obj;
          });
          bumpFps();
          errorCountRef.current = 0;
          setStreamError(false);
        } else {
          URL.revokeObjectURL(obj);
        }
      } catch {
        errorCountRef.current += 1;
        if (errorCountRef.current > 12) setStreamError(true);
      } finally {
        inFlight = false;
      }
    };

    tick();
    const interval = setInterval(tick, 100);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [mode, fallbackSnapshotUrl, bumpFps]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

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
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: mode === "stream" && !streamError ? "block" : "none"
        }}
      />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={snapshotSrc || undefined}
        alt={label}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          display: mode === "snapshot" && !streamError && snapshotSrc ? "block" : "none"
        }}
      />

      {streamError && (
        <div
          style={{
            padding: 16,
            textAlign: "center",
            fontSize: 12,
            color: "var(--text-muted)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6
          }}
        >
          <AlertCircle size={20} color="var(--color-warning)" />
          <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Flusso non disponibile</span>
          <button
            className="btn btn-sm"
            onClick={() => {
              errorCountRef.current = 0;
              setStreamError(false);
              setMode("stream");
            }}
          >
            Riprova Stream
          </button>
        </div>
      )}

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
          <span
            style={{
              background: "rgba(11, 15, 25, 0.75)",
              padding: "2px 6px",
              borderRadius: 3,
              fontSize: 10,
              fontWeight: 700,
              color: displayFps >= 8 ? "var(--color-info)" : "var(--color-warning)",
              fontVariantNumeric: "tabular-nums"
            }}
            title="Frame al secondo effettivamente disegnati in questo riquadro"
          >
            {displayFps} FPS
          </span>

          <button
            onClick={() => {
              errorCountRef.current = 0;
              setStreamError(false);
              setMode((m) => (m === "stream" ? "snapshot" : "stream"));
            }}
            style={{
              background: mode === "snapshot" ? "rgba(234, 179, 8, 0.85)" : "rgba(11, 15, 25, 0.75)",
              color: mode === "snapshot" ? "#000" : "var(--color-info)",
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
            title={mode === "snapshot" ? "Passa a Stream MJPEG" : "Passa a Snapshot"}
          >
            {mode === "snapshot" ? <ImageIcon size={10} /> : <Play size={10} />}
            {mode === "snapshot" ? "SNAPSHOT" : "STREAM"}
          </button>

          <span
            style={{
              background: "rgba(11, 15, 25, 0.75)",
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
