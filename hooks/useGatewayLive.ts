"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RoverLineOfThought, RoverTelemetry, ThoughtEvent } from "@/lib/roverData";
import { useLoraSerial } from "@/hooks/useLoraSerial";
import type { ParsedLoraTelemetry } from "@/lib/loraParser";
import type { FusionState, HardwareHealth, RiskLevel, SectorFusion, SectorName } from "@/lib/fusionTypes";
import { SECTOR_ORDER, riskLevelFromValue } from "@/lib/fusionTypes";

export type LiveLinkState = "connecting" | "live" | "reconnecting" | "offline" | "lora";

function resolveGatewayWsUrl(configured?: string | null): string {
  if (typeof window === "undefined") {
    return configured || "ws://127.0.0.1:30765";
  }

  const host = window.location.hostname || "127.0.0.1";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

  // When hosted on Cloudflare Tunnel remote domain (gianlucamorello.it)
  if (host.includes("gianlucamorello.it")) {
    return `wss://mar-gateway.gianlucamorello.it`;
  }

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

export type VisionFps = { camera?: number; depth?: number; stream?: number; yolo?: number };

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeRisk(raw: unknown, fallback: RiskLevel = "LOW"): RiskLevel {
  const s = String(raw || "").toUpperCase();
  return s === "CRITICAL" || s === "HIGH" || s === "MODERATE" || s === "LOW" ? (s as RiskLevel) : fallback;
}

/** Converte il campo `fusion` + metadati di `mar/fsm/state` nello stato tipizzato della dashboard. */
function parseFusion(payload: any): FusionState | null {
  const f = payload?.fusion;
  if (!f || typeof f !== "object") return null;
  const sectors: Partial<Record<SectorName, SectorFusion>> = {};
  const rawSectors = f.sectors || {};
  for (const name of SECTOR_ORDER) {
    const s = rawSectors[name];
    if (!s) continue;
    const risk = toNum(s.risk) ?? 0;
    sectors[name] = {
      risk,
      level: normalizeRisk(s.level, riskLevelFromValue(risk)),
      proximity_risk: toNum(s.proximity_risk) ?? undefined,
      object_risk: toNum(s.object_risk) ?? undefined,
      fused_dist_cm: toNum(s.fused_dist_cm),
      min_reliable_cm: toNum(s.min_reliable_cm),
      inputs: {
        lidar: toNum(s.inputs?.lidar) ?? undefined,
        ultrasonic: toNum(s.inputs?.ultrasonic) ?? undefined,
        stereo: toNum(s.inputs?.stereo) ?? undefined
      },
      objects: Array.isArray(s.objects) ? s.objects : [],
      stereo_only_near: Boolean(s.stereo_only_near),
      note: s.note ? String(s.note) : undefined
    };
  }
  const nav = payload?.navigation || {};
  const riskValue = toNum(payload?.risk_value) ?? toNum(f.front_risk) ?? 0;
  return {
    updatedAt: Date.now(),
    frontRisk: toNum(f.front_risk) ?? 0,
    frontLevel: normalizeRisk(f.front_level, riskLevelFromValue(toNum(f.front_risk) ?? 0)),
    frontDistCm: toNum(f.front_dist_cm),
    gateDistCm: toNum(f.gate_distance_cm),
    degraded: Boolean(f.degraded),
    sectors,
    sensors: {
      lidar: Boolean(f.sensors?.lidar),
      ultrasonic: Boolean(f.sensors?.ultrasonic),
      stereo: Boolean(f.sensors?.stereo),
      imu: Boolean(f.sensors?.imu),
      slam: Boolean(f.sensors?.slam)
    },
    inputs: {
      ultrasonic_cm: toNum(f.inputs?.ultrasonic_cm),
      ultrasonic_echo: f.inputs?.ultrasonic_echo !== false,
      lidar_front_cm: toNum(f.inputs?.lidar_front_cm),
      stereo_front_cm: toNum(f.inputs?.stereo_front_cm)
    },
    weights: {
      ultrasonic: toNum(f.weights?.ultrasonic) ?? 1,
      lidar: toNum(f.weights?.lidar) ?? 1,
      stereo: toNum(f.weights?.stereo) ?? 0.6
    },
    objects: Array.isArray(f.objects)
      ? f.objects.map((o: any) => ({
          class: String(o.class || o.label || "object"),
          confidence: toNum(o.confidence) ?? 0,
          dist_cm: toNum(o.dist_cm ?? o.estimated_distance_cm),
          bearing_deg: toNum(o.bearing_deg) ?? 0,
          sector: String(o.sector || ""),
          depth_quality: toNum(o.depth_quality) ?? undefined
        }))
      : [],
    groundHazard: Boolean(f.ground_hazard),
    fovBlocked: Boolean(f.fov_blocked),
    visionRisk: String(f.vision_risk || ""),
    autonomous: payload?.autonomous !== false,
    manualOverride: Boolean(payload?.manual_override),
    riskValue,
    riskLevel: normalizeRisk(payload?.risk_level, riskLevelFromValue(riskValue)),
    state: String(payload?.state || "IDLE"),
    navigation: {
      choice: nav.choice != null ? String(nav.choice) : null,
      scores: nav.scores && typeof nav.scores === "object" ? nav.scores : {},
      front_cm: toNum(nav.front_cm) ?? undefined,
      front_risk: toNum(nav.front_risk) ?? undefined
    }
  };
}

function normalizeFsmState(raw?: string): RoverTelemetry["fsmState"] {
  const s = (raw || "").toUpperCase();
  if (s.includes("EMERGENCY") || s.includes("STOP") || s.includes("ESTOP")) return "EMERGENCY_STOP";
  if (s.includes("AVOID") || s.includes("HAZARD")) return "AVOIDANCE";
  if (s.includes("INSPECT") || s.includes("YOLO")) return "INSPECTING_OBJECT";
  if (s.includes("MANUAL")) return "MANUAL";
  if (s.includes("PATROL") || s.includes("FORWARD")) return "PATROL_FORWARD";
  return "IDLE";
}

export function useGatewayLive(enabled: boolean, configuredWsUrl?: string | null) {
  const [link, setLink] = useState<LiveLinkState>("offline");
  const [telemetry, setTelemetry] = useState<RoverTelemetry>(emptyTelemetry);
  const [thought, setThought] = useState<RoverLineOfThought>(emptyThought);
  const [lastTopicAt, setLastTopicAt] = useState<number>(0);
  const [visionFps, setVisionFps] = useState<VisionFps | null>(null);
  const [lidarPointsCloud, setLidarPointsCloud] = useState<[number, number][]>([]);
  const [slamPose, setSlamPose] = useState<any>(null);
  const [slamMap, setSlamMap] = useState<any>(null);
  const [fusion, setFusion] = useState<FusionState | null>(null);
  const [hardware, setHardware] = useState<HardwareHealth>({});

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
        const lidarFrontM = payload?.lidar_front_m != null
          ? Number(payload.lidar_front_m)
          : (payload?.fusion?.inputs?.lidar != null ? Number(payload.fusion.inputs.lidar) / 100 : null);
        const front = lidarFrontM != null && lidarFrontM > 0 ? lidarFrontM : telemRef.current.frontDistanceMeters;

        // Livello di rischio autorevole calcolato dal Decision Engine
        const riskFromFsm = String(payload?.risk_level || "").toUpperCase();
        const risk: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" =
          riskFromFsm === "CRITICAL" || riskFromFsm === "HIGH" || riskFromFsm === "MODERATE" || riskFromFsm === "LOW"
            ? (riskFromFsm as any)
            : cmd.includes("STOP")
            ? "CRITICAL"
            : cmd.includes("TURN")
            ? "MODERATE"
            : "LOW";

        // Estrai valori sincronizzati passati assieme dal decision engine
        const usVal = payload?.ultrasonic_cm != null
          ? Number(payload.ultrasonic_cm)
          : (payload?.fusion?.inputs?.ultrasonic != null ? Number(payload.fusion.inputs.ultrasonic) : null);
        const ptsCount = payload?.point_count != null && Number(payload.point_count) > 0 ? Number(payload.point_count) : null;

        if (payload?.slam_pose) {
          setSlamPose(payload.slam_pose);
        }

        const parsedFusion = parseFusion(payload);
        if (parsedFusion) setFusion(parsedFusion);

        setTelemetry((prev) => {
          const next = {
            ...prev,
            fsmState: state as RoverTelemetry["fsmState"],
            frontDistanceMeters: front > 0 ? front : prev.frontDistanceMeters,
            ultrasonicMeters: usVal != null && usVal > 0 ? usVal / 100 : prev.ultrasonicMeters,
            lidarPoints: ptsCount != null ? ptsCount : prev.lidarPoints,
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
            stream: Number(payload?.fps_stream) || undefined,
            yolo: Number(payload?.fps_yolo) || undefined
          });
          setHardware((prev) => ({
            ...prev,
            vision: {
              fps_camera: Number(payload?.fps_camera) || undefined,
              fps_depth: Number(payload?.fps_depth) || undefined,
              fps_yolo: Number(payload?.fps_yolo) || undefined,
              objects_count: Number(payload?.objects_count) || 0,
              at: Date.now()
            }
          }));
        }
        const objects = Array.isArray(payload?.objects) ? payload.objects : [];
        const top = objects[0];
        const hasTop = Boolean(top);
        const hasObs = Boolean(payload?.obstacle_found && payload?.obstacle_dist_cm > 0 && payload?.obstacle_dist_cm < 900);
        const targetLabel = hasTop
          ? String(top.class || top.label || "Oggetto")
          : hasObs
          ? "Ostacolo Stereocamera"
          : "Nessun target";
        const targetConf = hasTop
          ? Number(top?.confidence ?? 0.8)
          : hasObs
          ? 0.9
          : 0;
        const targetDistMeters = hasTop
          ? (top.estimated_distance_cm ? Number(top.estimated_distance_cm) / 100 : (payload?.target_dist_cm ? Number(payload.target_dist_cm) / 100 : 0))
          : hasObs
          ? Number(payload.obstacle_dist_cm) / 100
          : 0;

        setThought((prev) => ({
          ...prev,
          currentStage: hasTop ? "YOLO_CLASSIFICATION" : hasObs ? "DEPTH_EVALUATION" : prev.currentStage,
          activeTarget: {
            label: targetLabel,
            confidence: targetConf,
            distanceMeters: targetDistMeters,
            azimuthDeg: top?.bearing_deg != null ? Number(top.bearing_deg) || 0 : prev.activeTarget.azimuthDeg,
            bbox: top?.bbox
          }
        }));

        if (top) {
          const bearing = Number(top?.bearing_deg ?? 0) || 0;
          const sector = top?.sector ? String(top.sector) : "";
          const distTxt = targetDistMeters > 0 ? `${(targetDistMeters * 100).toFixed(0)} cm` : "dist. n/d";
          pushThought({
            id: `yolo-${payload?.timestamp || Date.now()}`,
            timestamp: formatTime(payload?.timestamp),
            stage: "YOLO_CLASSIFICATION",
            targetObject: targetLabel,
            confidence: targetConf,
            distanceMeters: targetDistMeters,
            azimuthDeg: bearing,
            reasoning: `YOLO on-edge: ${targetLabel} (${Math.round(targetConf * 100)}%) · ${distTxt} · ${bearing >= 0 ? "+" : ""}${bearing.toFixed(0)}°${
              sector ? ` · ${sector}` : ""
            }${payload?.ground_hazard ? " · hazard terreno" : ""}`,
            chosenAction: payload?.ground_hazard ? "GROUND_HAZARD" : "DETECT"
          });
        }
        return;
      }

      if (topic === "mar/lidar/status") {
        setHardware((prev) => ({
          ...prev,
          lidar: {
            connected: Boolean(payload?.connected),
            driver: payload?.driver ? String(payload.driver) : undefined,
            port: payload?.port ? String(payload.port) : undefined,
            scan_hz: toNum(payload?.scan_hz) ?? undefined,
            slam_points: toNum(payload?.slam_points) ?? undefined,
            imu_prior: Boolean(payload?.imu_prior),
            at: Date.now()
          }
        }));
        return;
      }

      if (topic === "mar/hardware/status") {
        setHardware((prev) => ({
          ...prev,
          serial: {
            motion_connected: Boolean(payload?.motion_connected),
            motion_port: payload?.motion_port ?? null,
            ultrasonic_connected: Boolean(payload?.ultrasonic_connected),
            ultrasonic_simulated: Boolean(payload?.ultrasonic_simulated),
            ultrasonic_port: payload?.ultrasonic_port ?? null,
            port_roles: payload?.port_roles && typeof payload.port_roles === "object" ? payload.port_roles : {},
            unknown_ports: Array.isArray(payload?.unknown_ports) ? payload.unknown_ports : [],
            at: Date.now()
          },
          imu: {
            available: Boolean(payload?.imu_connected),
            reason: payload?.imu_status ? String(payload.imu_status) : prev.imu?.reason,
            at: Date.now()
          }
        }));
        return;
      }

      if (topic === "mar/imu/status") {
        setHardware((prev) => ({
          ...prev,
          imu: { available: Boolean(payload?.available), reason: payload?.reason ? String(payload.reason) : undefined, at: Date.now() }
        }));
        return;
      }

      if (topic === "mar/decision/health") {
        setHardware((prev) => ({ ...prev, decision: { ...(payload || {}), at: Date.now() } }));
        return;
      }

      if (topic === "mar/vision/command") {
        // Topic informativo stereocamera; non sovrascrivere frontDistanceMeters (che appartiene al LiDAR).
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
        // le letture simulate (bridge senza Arduino ultrasuoni) non sono dati reali
        const simulated = Boolean(payload?.simulated) || String(payload?.source || "").toUpperCase().startsWith("SIM");
        const ultrasonic = simulated
          ? NaN
          : Number(payload?.us_cm ?? payload?.ultrasonic_cm ?? payload?.ultrasonic ?? payload?.us ?? NaN);
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
              !Number.isNaN(ultrasonic) && ultrasonic >= 390
                ? 0
                : !Number.isNaN(ultrasonic) && ultrasonic > 0
                  ? ultrasonic / 100
                  : prev.ultrasonicMeters,
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

  const applyLoraTelemetry = useCallback(
    (parsed: ParsedLoraTelemetry) => {
      const nowIso = new Date().toISOString();
      setLastTopicAt(Date.now());

      setTelemetry((prev) => {
        const batteryVoltage = parsed.batteryVoltage ?? prev.batteryVoltage;
        const batteryPercent = parsed.batteryPercent ?? prev.batteryPercent;
        const mappedFsm = parsed.fsmState ? normalizeFsmState(parsed.fsmState) : prev.fsmState;
        const next: RoverTelemetry = {
          ...prev,
          rollDegrees: parsed.rollDegrees ?? prev.rollDegrees,
          pitchDegrees: parsed.pitchDegrees ?? prev.pitchDegrees,
          frontDistanceMeters: parsed.frontDistanceMeters ?? prev.frontDistanceMeters,
          ultrasonicMeters: parsed.ultrasonicMeters ?? prev.ultrasonicMeters,
          batteryVoltage,
          batteryPercent,
          fsmState: mappedFsm,
          connectivity: "online",
          updatedAt: nowIso
        };
        telemRef.current = next;
        return next;
      });

      if (parsed.fsmState) {
        const stage = stageFromFsm(parsed.fsmState, false);
        const risk = parsed.riskLevel || "LOW";
        const stateName = parsed.fsmState;
        const reasonText = parsed.fsmReason || "Telemetria Radio LoRa 868MHz";

        setThought((prev) => ({
          ...prev,
          currentStage: stage,
          currentDecision: {
            command: stateName,
            justification: reasonText,
            riskLevel: risk
          }
        }));

        pushThought({
          id: `lora-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: formatTime(parsed.timestamp / 1000),
          stage,
          targetObject: "LoRa Ground Link",
          confidence: 1.0,
          distanceMeters: parsed.frontDistanceMeters ?? parsed.ultrasonicMeters ?? 0,
          azimuthDeg: 0,
          reasoning: `Radio RX [868MHz]: ${parsed.raw}`,
          chosenAction: stateName
        });
      }
    },
    [pushThought]
  );

  const lora = useLoraSerial({
    baudRate: 9600,
    onTelemetry: applyLoraTelemetry
  });

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

      let loraSent = false;
      if (lora.isConnected) {
        const frame = param !== "" ? `CMD:${cmd.toUpperCase()},${param}` : `CMD:${cmd.toUpperCase()}`;
        lora.sendFrame(frame);
        loraSent = true;
      }

      // Invia sempre anche al gateway via WebSocket se aperto (entrambi convergono nel GatewayCommandHub)
      const wsSent = sendJson({
        type: "MOTION_CMD",
        data: {
          cmd: cmd.toUpperCase(),
          param,
          reason: loraSent ? "DASHBOARD_LORA_DUAL" : "DASHBOARD_MANUAL",
          state: "MANUAL"
        }
      });

      return loraSent || wsSent;
    },
    [sendJson, lora.isConnected, lora.sendFrame]
  );

  const sendEstop = useCallback(() => {
    let loraSent = false;
    if (lora.isConnected) {
      lora.sendFrame("ESTOP");
      loraSent = true;
    }
    const wsSent = sendJson({ type: "ESTOP" });
    return loraSent || wsSent;
  }, [sendJson, lora.isConnected, lora.sendFrame]);

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
    link: lora.isConnected ? ("lora" as LiveLinkState) : link,
    transportMode: lora.isConnected ? ("LORA" as const) : ("IP" as const),
    isLoraActive: lora.isConnected,
    lora,
    telemetry,
    thought,
    visionFps,
    lidarPointsCloud,
    slamPose,
    slamMap,
    fusion,
    hardware,
    lastTopicAt,
    sendMotion,
    sendEstop,
    wsUrl: typeof window !== "undefined" ? resolveGatewayWsUrl(configuredWsUrl) : ""
  };
}
