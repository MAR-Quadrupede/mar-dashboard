"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoverLineOfThought, RoverTelemetry, ThoughtEvent } from "@/lib/roverData";

export type LiveLinkState = "connecting" | "live" | "reconnecting" | "offline";

function resolveGatewayWsUrl(configured?: string | null): string {
  if (typeof window === "undefined") {
    return configured || "ws://127.0.0.1:30765";
  }

  const host = window.location.hostname || "127.0.0.1";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

  if (configured && configured.trim()) {
    const raw = configured.trim();
    // Rewrite localhost / placeholder / stale Tailscale IPs to the host in the address bar
    if (
      raw.includes("auto") ||
      raw.includes("localhost") ||
      raw.includes("127.0.0.1") ||
      raw.includes("100.77.") ||
      raw.includes(":8765")
    ) {
      return `${protocol}//${host}:30765`;
    }
    return raw.replace(/^http/, "ws");
  }

  return `${protocol}//${host}:30765`;
}

function formatTime(ts?: number): string {
  const d = ts ? new Date(ts * 1000) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toTimeString().split(" ")[0];
  return d.toTimeString().split(" ")[0];
}

/** Unified bands (m): CRITICAL <0.40 | HIGH <0.70 | MODERATE <1.20 | LOW */
function riskFromCommand(cmd: string, frontM?: number): "LOW" | "MODERATE" | "HIGH" | "CRITICAL" {
  if (frontM !== undefined && frontM > 0) {
    if (frontM < 0.4) return "CRITICAL";
    if (frontM < 0.7) return "HIGH";
    if (frontM < 1.2) return "MODERATE";
  }
  const c = (cmd || "").toUpperCase();
  if (c.includes("CRITICAL") || (c.includes("STOP") && c.includes("EMERGENCY"))) return "CRITICAL";
  if (c.includes("STOP") || c.includes("FRENA") || c.includes("HIGH")) return "HIGH";
  if (c.includes("TURN") || c.includes("MODERATE") || c.includes("SLOW")) return "MODERATE";
  if (c.includes("STOP")) return "HIGH";
  return "LOW";
}

function stageFromFsm(state?: string, hasVisionTarget?: boolean): RoverLineOfThought["currentStage"] {
  switch ((state || "").toUpperCase()) {
    case "INSPECTING_OBJECT":
      return hasVisionTarget ? "YOLO_CLASSIFICATION" : "SACCADE_TARGETING";
    case "AVOIDANCE":
    case "TERRAIN_HAZARD":
    case "EMERGENCY_STOP":
      return "ACTION_DECISION";
    case "MANUAL":
      return "ACTION_DECISION";
    default:
      return hasVisionTarget ? "DEPTH_EVALUATION" : "SCANNING_PERIMETER";
  }
}

const emptyThought = (): RoverLineOfThought => ({
  currentStage: "SCANNING_PERIMETER",
  activeTarget: {
    label: "In attesa sensori…",
    confidence: 0,
    distanceMeters: 0,
    azimuthDeg: 0
  },
  currentDecision: {
    command: "—",
    justification: "Connessione telemetria in corso",
    riskLevel: "LOW"
  },
  recentThoughts: []
});

const emptyTelemetry = (): RoverTelemetry => ({
  batteryPercent: 0,
  batteryVoltage: 0,
  currentAmps: 0,
  temperatureCelsius: 0,
  frontDistanceMeters: 0,
  ultrasonicMeters: 0,
  lidarPoints: 0,
  rollDegrees: 0,
  pitchDegrees: 0,
  latitude: 0,
  longitude: 0,
  connectivity: "offline",
  fsmState: "IDLE",
  updatedAt: new Date().toISOString()
});

export type VisionFps = { camera?: number; depth?: number; stream?: number };

export function useGatewayLive(enabled: boolean, configuredWsUrl?: string | null) {
  const [link, setLink] = useState<LiveLinkState>("offline");
  const [telemetry, setTelemetry] = useState<RoverTelemetry>(emptyTelemetry);
  const [thought, setThought] = useState<RoverLineOfThought>(emptyThought);
  const [lastTopicAt, setLastTopicAt] = useState<number>(0);
  const [visionFps, setVisionFps] = useState<VisionFps | null>(null);
  const [lidarPointsCloud, setLidarPointsCloud] = useState<[number, number][]>([]);
  const [slamPose, setSlamPose] = useState<any>(null);
  const [slamMap, setSlamMap] = useState<any>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const thoughtsRef = useRef<ThoughtEvent[]>([]);
  const telemRef = useRef<RoverTelemetry>(emptyTelemetry());
  const reconnectAttempt = useRef(0);
  const disposed = useRef(false);

  const pushThought = useCallback((event: ThoughtEvent) => {
    const next = [event, ...thoughtsRef.current.filter((t) => t.id !== event.id)].slice(0, 12);
    thoughtsRef.current = next;
    setThought((prev) => ({ ...prev, recentThoughts: next }));
  }, []);

  const applyPacket = useCallback(
    (topic: string, payload: any) => {
      const nowIso = new Date().toISOString();
      setLastTopicAt(Date.now());

      if (topic === "mar/slam/pose") {
        setSlamPose(payload);
        return;
      }

      if (topic === "mar/slam/map") {
        setSlamMap(payload);
        return;
      }

      if (topic === "mar/fsm/state") {
        const cmd = String(payload?.active_command || "—");
        const state = String(payload?.state || "IDLE");
        const reason = String(payload?.reason || "");
        const front = telemRef.current.frontDistanceMeters;
        const risk = riskFromCommand(cmd, front);

        setTelemetry((prev) => {
          const next = {
            ...prev,
            fsmState: state as RoverTelemetry["fsmState"],
            connectivity: "online" as const,
            updatedAt: nowIso
          };
          telemRef.current = next;
          return next;
        });

        setThought((prev) => ({
          ...prev,
          currentStage: stageFromFsm(state, Boolean(prev.activeTarget?.confidence)),
          currentDecision: {
            command: cmd,
            justification: reason || prev.currentDecision.justification,
            riskLevel: risk
          }
        }));

        pushThought({
          id: `fsm-${payload?.timestamp || Date.now()}`,
          timestamp: formatTime(payload?.timestamp),
          stage: stageFromFsm(state, true),
          targetObject: state,
          confidence: 1,
          distanceMeters: front,
          azimuthDeg: 0,
          reasoning: reason || `Stato FSM: ${state}`,
          chosenAction: cmd
        });
        return;
      }

      if (topic === "mar/lidar/alert" || topic === "mar/lidar/telemetry" || topic === "mar/lidar/scan") {
        const front =
          Number(payload?.front_distance_m ?? payload?.sector_mins?.Fronte ?? telemRef.current.frontDistanceMeters) ||
          0;
        const points =
          Number(payload?.point_count ?? payload?.cloud_count ?? payload?.points?.length ?? telemRef.current.lidarPoints) || 0;
        const theta = Number(payload?.theta ?? 0);
        const sector = String(payload?.sector || payload?.sector_en || "Fronte");
        const dist = Number(payload?.dist_m ?? front);

        if (topic === "mar/lidar/scan" && Array.isArray(payload?.points)) {
          const cloud = payload.points
            .map((p: unknown) => {
              if (Array.isArray(p) && p.length >= 2) return [Number(p[0]), Number(p[1])] as [number, number];
              return null;
            })
            .filter(Boolean) as [number, number][];
          if (cloud.length) setLidarPointsCloud(cloud);
        }

        setTelemetry((prev) => {
          const next = {
            ...prev,
            frontDistanceMeters: front > 0 ? front : prev.frontDistanceMeters,
            lidarPoints: points > 0 ? points : prev.lidarPoints,
            connectivity: "online" as const,
            updatedAt: nowIso
          };
          telemRef.current = next;
          return next;
        });

        if (topic !== "mar/lidar/scan") {
          const emergency = Boolean(payload?.is_emergency);
          pushThought({
            id: `lidar-${payload?.timestamp || Date.now()}`,
            timestamp: formatTime(payload?.timestamp),
            stage: emergency ? "ACTION_DECISION" : "SCANNING_PERIMETER",
            targetObject: `LiDAR ${sector}`,
            confidence: emergency ? 0.99 : 0.8,
            distanceMeters: dist,
            azimuthDeg: theta,
            reasoning: emergency
              ? `Allerta ${sector}: ${dist.toFixed(2)} m (emergency=${emergency})`
              : `Settore ${sector} a ${dist.toFixed(2)} m · fronte ${front.toFixed(2)} m`,
            chosenAction: emergency ? "ALERT" : "SCAN"
          });
        }
        return;
      }

      if (topic === "mar/vision/detections" || topic === "mar/vision/status") {
        if (
          payload?.fps_camera != null ||
          payload?.fps_depth != null ||
          payload?.fps_stream != null
        ) {
          setVisionFps({
            camera: Number(payload?.fps_camera) || undefined,
            depth: Number(payload?.fps_depth) || undefined,
            stream: Number(payload?.fps_stream) || undefined
          });
        }
        const objects = Array.isArray(payload?.objects) ? payload.objects : [];
        const top = objects[0];
        const z =
          Number(
            payload?.target_dist_cm ??
              payload?.z_basso_cm ??
              (top?.estimated_distance_cm ?? 0)
          ) / (payload?.target_dist_cm || payload?.z_basso_cm ? 100 : 1);
        const label = top?.class || top?.label || (objects.length ? `${objects.length} oggetti` : "Nessun target");
        const conf = Number(top?.confidence ?? (objects.length ? 0.5 : 0));

        setThought((prev) => ({
          ...prev,
          currentStage: objects.length ? "YOLO_CLASSIFICATION" : prev.currentStage,
          activeTarget: {
            label: String(label),
            confidence: conf,
            distanceMeters: z > 0 && z < 50 ? z : prev.activeTarget.distanceMeters,
            azimuthDeg: prev.activeTarget.azimuthDeg,
            bbox: top?.bbox
          }
        }));

        if (top) {
          pushThought({
            id: `yolo-${payload?.timestamp || Date.now()}`,
            timestamp: formatTime(payload?.timestamp),
            stage: "YOLO_CLASSIFICATION",
            targetObject: String(label),
            confidence: conf,
            distanceMeters: z > 0 && z < 50 ? z : 0,
            azimuthDeg: 0,
            reasoning: `YOLO on-edge: ${label} (${Math.round(conf * 100)}%)${
              payload?.ground_hazard ? " · hazard terreno" : ""
            }`,
            chosenAction: payload?.ground_hazard ? "GROUND_HAZARD" : "DETECT"
          });
        }
        return;
      }

      if (topic === "mar/vision/command") {
        const cmd = String(payload?.command || "");
        const reason = String(payload?.reason || "");
        const distCm = Number(payload?.obstacle_near_cm ?? payload?.target_dist_cm ?? 0);
        const riskRaw = String(payload?.risk_level || "").toUpperCase();
        const risk =
          riskRaw === "CRITICAL" || riskRaw === "HIGH" || riskRaw === "MODERATE" || riskRaw === "LOW"
            ? (riskRaw as "LOW" | "MODERATE" | "HIGH" | "CRITICAL")
            : riskFromCommand(cmd, distCm > 0 ? distCm / 100 : undefined);
        setTelemetry((prev) => {
          const next = {
            ...prev,
            frontDistanceMeters: distCm > 0 && distCm < 900 ? distCm / 100 : prev.frontDistanceMeters,
            connectivity: "online" as const,
            updatedAt: nowIso
          };
          telemRef.current = next;
          return next;
        });
        setThought((prev) => ({
          ...prev,
          currentStage: "ACTION_DECISION",
          currentDecision: {
            command: cmd.startsWith("CMD:") ? cmd : `VISION:${cmd}`,
            justification: reason || prev.currentDecision.justification,
            riskLevel: risk
          }
        }));
        return;
      }

      if (topic === "mar/imu/telemetry") {
        setTelemetry((prev) => {
          const next = {
            ...prev,
            rollDegrees: Number(payload?.roll ?? prev.rollDegrees),
            pitchDegrees: Number(payload?.pitch ?? prev.pitchDegrees),
            connectivity: "online" as const,
            updatedAt: nowIso
          };
          telemRef.current = next;
          return next;
        });
        return;
      }

      if (topic === "mar/ultrasonic/range" || topic === "mar/hardware/telemetry") {
        const battV = Number(payload?.batt ?? payload?.battery_v ?? payload?.voltage ?? NaN);
        const ultrasonic = Number(
          payload?.us_cm ?? payload?.ultrasonic_cm ?? payload?.ultrasonic ?? payload?.us ?? NaN
        );
        setTelemetry((prev) => {
          let batteryPercent = prev.batteryPercent;
          let batteryVoltage = prev.batteryVoltage;
          if (!Number.isNaN(battV) && battV > 0) {
            batteryVoltage = battV;
            // rough 4S pack mapping 12.8–16.8V
            batteryPercent = Math.max(0, Math.min(100, Math.round(((battV - 12.8) / 4.0) * 100)));
          }
          const next = {
            ...prev,
            batteryPercent,
            batteryVoltage: batteryVoltage || prev.batteryVoltage,
            ultrasonicMeters:
              !Number.isNaN(ultrasonic) && ultrasonic > 0 ? ultrasonic / 100 : prev.ultrasonicMeters,
            connectivity: "online" as const,
            updatedAt: nowIso
          };
          telemRef.current = next;
          return next;
        });
      }
    },
    [pushThought]
  );

  const sendJson = useCallback((msg: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
      return true;
    }
    return false;
  }, []);

  const sendMotion = useCallback(
    (command: string, speed?: number) => {
      const raw = command.replace(/^CMD:/i, "").trim();
      const [cmd, paramFromCmd] = raw.split(",", 2);
      const param = paramFromCmd !== undefined ? paramFromCmd : speed !== undefined ? String(speed) : "";
      return sendJson({
        type: "MOTION_CMD",
        data: {
          cmd: cmd.toUpperCase(),
          param,
          reason: "DASHBOARD_MANUAL",
          state: "MANUAL"
        }
      });
    },
    [sendJson]
  );

  const sendEstop = useCallback(() => sendJson({ type: "ESTOP" }), [sendJson]);

  useEffect(() => {
    disposed.current = false;
    if (!enabled) {
      setLink("offline");
      return;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (disposed.current) return;
      const url = resolveGatewayWsUrl(configuredWsUrl);
      setLink(reconnectAttempt.current === 0 ? "connecting" : "reconnecting");

      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        reconnectAttempt.current += 1;
        timer = setTimeout(connect, Math.min(8000, 500 * 2 ** reconnectAttempt.current));
        return;
      }

      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttempt.current = 0;
        setLink("live");
        try {
          ws.send(JSON.stringify({ type: "PING" }));
        } catch {
          // ignore
        }
      };

      ws.onmessage = (ev) => {
        try {
          const packet = JSON.parse(String(ev.data));
          const topic = packet?.topic;
          if (!topic || topic === "mar/gateway/hello" || topic === "mar/gateway/pong") {
            if (topic === "mar/gateway/hello" || topic === "mar/gateway/pong") {
              setLink("live");
            }
            return;
          }
          applyPacket(topic, packet.payload);
        } catch {
          // ignore malformed
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (disposed.current) return;
        setLink("reconnecting");
        setTelemetry((prev) => {
          const next = { ...prev, connectivity: "degraded" as const };
          telemRef.current = next;
          return next;
        });
        reconnectAttempt.current += 1;
        timer = setTimeout(connect, Math.min(8000, 600 * 2 ** Math.min(reconnectAttempt.current, 4)));
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          // ignore
        }
      };
    };

    connect();

    const ping = setInterval(() => {
      sendJson({ type: "PING" });
    }, 15000);

    return () => {
      disposed.current = true;
      if (timer) clearTimeout(timer);
      clearInterval(ping);
      try {
        wsRef.current?.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
    };
  }, [enabled, configuredWsUrl, applyPacket, sendJson]);

  return {
    link,
    telemetry,
    thought,
    visionFps,
    lidarPointsCloud,
    slamPose,
    slamMap,
    lastTopicAt,
    sendMotion,
    sendEstop,
    wsUrl: typeof window !== "undefined" ? resolveGatewayWsUrl(configuredWsUrl) : ""
  };
}
