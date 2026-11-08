/**
 * Tipi per la telemetria di sensor fusion pubblicata dal Decision Engine
 * su `mar/fsm/state` (campo `fusion`) e dai servizi hardware.
 */

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";

export const SECTOR_ORDER = [
  "Fronte",
  "Front-DX",
  "Destra",
  "Retro-DX",
  "Retro",
  "Retro-SX",
  "Sinistra",
  "Front-SX"
] as const;

export type SectorName = (typeof SECTOR_ORDER)[number];

/** Angolo centrale del settore (gradi, 0 = fronte, positivo = destra/orario). */
export const SECTOR_ANGLE_DEG: Record<SectorName, number> = {
  Fronte: 0,
  "Front-DX": 45,
  Destra: 90,
  "Retro-DX": 135,
  Retro: 180,
  "Retro-SX": -135,
  Sinistra: -90,
  "Front-SX": -45
};

export type FusionObject = {
  class: string;
  conf: number;
  dist_cm: number | null;
  dist_src?: string;
  bearing_deg: number;
  sector?: string;
  w?: number;
  contrib?: number;
};

export type SectorFusion = {
  risk: number;
  level: RiskLevel;
  proximity_risk?: number;
  object_risk?: number;
  fused_dist_cm: number | null;
  min_reliable_cm?: number | null;
  inputs: Partial<Record<"lidar" | "ultrasonic" | "stereo", number>>;
  objects?: FusionObject[];
  stereo_only_near?: boolean;
  note?: string;
};

export type FusionState = {
  updatedAt: number;
  frontRisk: number;
  frontLevel: RiskLevel;
  frontDistCm: number | null;
  gateDistCm: number | null;
  degraded: boolean;
  sectors: Partial<Record<SectorName, SectorFusion>>;
  sensors: { lidar: boolean; ultrasonic: boolean; stereo: boolean; imu: boolean; slam: boolean };
  inputs: { ultrasonic_cm: number | null; lidar_front_cm: number | null; stereo_front_cm: number | null };
  weights: { ultrasonic: number; lidar: number; stereo: number };
  objects: Array<{
    class: string;
    confidence: number;
    dist_cm: number | null;
    bearing_deg: number;
    sector: string;
    depth_quality?: number;
  }>;
  groundHazard: boolean;
  fovBlocked: boolean;
  visionRisk: string;
  // dal livello FSM
  autonomous: boolean;
  manualOverride: boolean;
  riskValue: number;
  riskLevel: RiskLevel;
  state: string;
  navigation: { choice: string | null; scores: Record<string, number>; front_cm?: number; front_risk?: number };
};

export type HardwareHealth = {
  lidar?: {
    connected: boolean;
    driver?: string;
    port?: string;
    scan_hz?: number;
    slam_points?: number;
    imu_prior?: boolean;
    at: number;
  };
  serial?: {
    motion_connected: boolean;
    motion_port?: string | null;
    ultrasonic_connected: boolean;
    ultrasonic_simulated: boolean;
    ultrasonic_port?: string | null;
    port_roles?: Record<string, string>;
    unknown_ports?: string[];
    at: number;
  };
  imu?: { available: boolean; reason?: string; at: number };
  vision?: { fps_camera?: number; fps_depth?: number; fps_yolo?: number; objects_count?: number; at: number };
  decision?: { at: number; [k: string]: unknown };
};

export function riskColor(level: RiskLevel | string | undefined): string {
  switch ((level || "").toUpperCase()) {
    case "CRITICAL":
      return "#ef4444";
    case "HIGH":
      return "#f97316";
    case "MODERATE":
      return "#eab308";
    default:
      return "#22c55e";
  }
}

export function riskLevelFromValue(r: number): RiskLevel {
  if (r >= 0.85) return "CRITICAL";
  if (r >= 0.6) return "HIGH";
  if (r >= 0.3) return "MODERATE";
  return "LOW";
}

export function sectorLabelIt(name: string): string {
  return name.replace("Front-", "Fr-").replace("Retro-", "Re-");
}
