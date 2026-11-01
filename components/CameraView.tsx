"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Eye, RefreshCw, Maximize2, AlertCircle, Play, Image as ImageIcon, Radio } from "lucide-react";

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
  loraMode?: boolean;
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

/** Parse MJPEG multipart and paint onto canvas */
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

    while (true) {
      const soi = findMarker(buffer, 0xff, 0xd8, 0);
      if (soi < 0) {
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
    name: "CAM 01 // STEREO LEFT (YOLOv8)",
    url: resolveStreamUrl(rawLeft, "/api/video/left"),
    snapshotUrl: "/api/video/left?snapshot=1"
  };

  const rightStream = {
    id: "right",
    name: "CAM 02 // STEREO RIGHT (DEPTH)",
    url: resolveStreamUrl(rawRight, "/api/video/right"),
    snapshotUrl: "/api/video/right?snapshot=1"
  };

  const reload = () => setRefreshKey((k) => k + 1);

  const camFps = visionFps?.camera;
  const depthFps = visionFps?.depth;
  const fpsText =
    camFps != null
      ? `Source: ${camFps.toFixed(0)} FPS | Depth: ${(depthFps ?? camFps).toFixed(0)} FPS`
      : "Feed MJPEG attivo";

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <Eye size={13} />
          <span>FLUSSO OTTICO STEREOSCOPICO</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* View mode segmented switcher */}
          <div className="segmented-control" style={{ padding: 1 }}>
            <button
              className={`segmented-btn ${viewMode === "dual" ? "active" : ""}`}
              style={{ padding: "3px 8px", fontSize: 10 }}
              onClick={() => setViewMode("dual")}
            >
              DUAL
            </button>
            <button
              className={`segmented-btn ${viewMode === "left" ? "active" : ""}`}
              style={{ padding: "3px 8px", fontSize: 10 }}
              onClick={() => setViewMode("left")}
            >
              LEFT (YOLO)
            </button>
            <button
              className={`segmented-btn ${viewMode === "right" ? "active" : ""}`}
              style={{ padding: "3px 8px", fontSize: 10 }}
              onClick={() => setViewMode("right")}
            >
              RIGHT (DEPTH)
            </button>
          </div>

          <button className="btn btn-xs" onClick={reload} title="Ricarica flusso ottico">
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      <div style={{ padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
        {safari && (
          <div
            style={{
              padding: "6px 8px",
              fontSize: 10,
              color: "var(--text-secondary)",
              background: "var(--bg-panel)",
              border: "1px solid var(--border-default)",
              borderRadius: "var(--radius-xs)"
            }}
          >
            Modalità canvas attiva per compatibilità Safari.
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: viewMode === "dual" ? "1fr 1fr" : "1fr",
            gap: 8
          }}
        >
          {(viewMode === "dual" || viewMode === "left") && (
            <TacticalFeedTile
              key={`left-${refreshKey}`}
              url={withQuery(leftStream.url, { k: refreshKey })}
              fallbackSnapshotUrl={leftStream.snapshotUrl}
              label={leftStream.name}
              badge="YOLO ON-EDGE"
            />
          )}

          {(viewMode === "dual" || viewMode === "right") && (
            <TacticalFeedTile
              key={`right-${refreshKey}`}
              url={withQuery(rightStream.url, { k: refreshKey })}
              fallbackSnapshotUrl={rightStream.snapshotUrl}
              label={rightStream.name}
              badge="STEREO DEPTH"
            />
          )}
        </div>

        {/* Footer telemetry status line */}
        <div
          className="mono"
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 10,
            color: "var(--text-muted)",
            padding: "2px 4px"
          }}
        >
          <span>{fpsText}</span>
          <span>ROUTER: /api/video → PORT: 30080</span>
        </div>
      </div>
    </div>
  );
}

function TacticalFeedTile({
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
          retryTimer = setTimeout(run, 400);
        }
      } catch (e) {
        if (ac.signal.aborted || stopped) return;
        errorCountRef.current += 1;
        if (errorCountRef.current >= 3) {
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
        background: "var(--bg-inset)",
        border: "1px solid var(--border-default)",
        borderRadius: "var(--radius-xs)",
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

      {/* Subtle HUD Reticle in center */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 24,
          height: 24,
          pointerEvents: "none",
          opacity: 0.35
        }}
      >
        <div style={{ position: "absolute", top: 11, left: 0, width: 8, height: 2, background: "#fff" }} />
        <div style={{ position: "absolute", top: 11, right: 0, width: 8, height: 2, background: "#fff" }} />
        <div style={{ position: "absolute", left: 11, top: 0, width: 2, height: 8, background: "#fff" }} />
        <div style={{ position: "absolute", left: 11, bottom: 0, width: 2, height: 8, background: "#fff" }} />
      </div>

      {streamError && (
        <div
          style={{
            padding: 16,
            textAlign: "center",
            fontSize: 11,
            color: "var(--text-muted)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6
          }}
        >
          <AlertCircle size={18} color="var(--color-warning)" />
          <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>SEGNALE OTTICO ASSENTE</span>
          <button
            className="btn btn-xs"
            onClick={() => {
              errorCountRef.current = 0;
              setStreamError(false);
              setMode("stream");
            }}
          >
            Riconnetti
          </button>
        </div>
      )}

      {/* Tactical HUD Header */}
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
          className="mono"
          style={{
            background: "rgba(12, 14, 18, 0.85)",
            border: "1px solid var(--border-subtle)",
            padding: "2px 6px",
            borderRadius: 2,
            fontSize: 9,
            fontWeight: 700,
            color: "var(--text-main)",
            letterSpacing: "0.04em"
          }}
        >
          {label}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span
            className="mono"
            style={{
              background: "rgba(12, 14, 18, 0.85)",
              border: "1px solid var(--border-subtle)",
              padding: "2px 6px",
              borderRadius: 2,
              fontSize: 9,
              fontWeight: 700,
              color: displayFps >= 8 ? "var(--color-success)" : "var(--color-warning)"
            }}
          >
            {displayFps} FPS
          </span>

          <button
            onClick={() => {
              errorCountRef.current = 0;
              setStreamError(false);
              setMode((m) => (m === "stream" ? "snapshot" : "stream"));
            }}
            className="mono"
            style={{
              background: mode === "snapshot" ? "rgba(234, 179, 8, 0.9)" : "rgba(12, 14, 18, 0.85)",
              color: mode === "snapshot" ? "#000" : "var(--text-secondary)",
              border: "1px solid var(--border-subtle)",
              cursor: "pointer",
              padding: "2px 5px",
              borderRadius: 2,
              fontSize: 9,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: 3
            }}
            title={mode === "snapshot" ? "Passa a Stream MJPEG" : "Passa a Snapshot"}
          >
            {mode === "snapshot" ? <ImageIcon size={9} /> : <Play size={9} />}
            <span>{mode === "snapshot" ? "SNAP" : "STREAM"}</span>
          </button>

          <span
            className="tag mono"
            style={{
              fontSize: 9,
              padding: "2px 5px",
              background: "rgba(12, 14, 18, 0.85)"
            }}
          >
            {badge}
          </span>

          <button
            onClick={toggleFullscreen}
            style={{
              background: "rgba(12, 14, 18, 0.85)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-main)",
              cursor: "pointer",
              padding: "3px 4px",
              borderRadius: 2,
              display: "flex",
              alignItems: "center"
            }}
            title="Schermo intero"
          >
            <Maximize2 size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}
