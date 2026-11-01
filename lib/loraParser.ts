/**
 * M.A.R. — LoRa Telemetry Frame Parser
 *
 * Supports:
 * 1. Standard telemetry frame:
 *    `[IMU] R:  1.2° P: -0.5° | [LiDAR] Fr: 138cm | [US]  14cm | [BATT] 16.2V || PATROL_FORWARD [MARCIA REGOLARE]`
 * 2. Key-Value telemetry frame:
 *    `TLM:R=1.2;P=-0.5;LIDAR=138;US=14;BATT=16.2;FSM=PATROL_FORWARD`
 * 3. JSON telemetry frame:
 *    `{"roll": 1.2, "pitch": -0.5, "front_cm": 138, "us_cm": 14, "batt_v": 16.2, "state": "PATROL_FORWARD"}`
 */

export interface ParsedLoraTelemetry {
  rollDegrees?: number;
  pitchDegrees?: number;
  frontDistanceMeters?: number;
  ultrasonicMeters?: number;
  batteryVoltage?: number;
  batteryPercent?: number;
  fsmState?: string;
  fsmReason?: string;
  riskLevel?: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  raw: string;
  timestamp: number;
}

function deriveRiskLevel(fsmState?: string, frontMeters?: number, usMeters?: number): "LOW" | "MODERATE" | "HIGH" | "CRITICAL" {
  const s = (fsmState || "").toUpperCase();
  if (s.includes("EMERGENCY") || s.includes("CRITICAL") || s.includes("ESTOP")) {
    return "CRITICAL";
  }
  if (s.includes("AVOIDANCE") || s.includes("TERRAIN") || s.includes("HAZARD")) {
    return "HIGH";
  }
  if (frontMeters !== undefined && frontMeters > 0) {
    if (frontMeters < 0.4) return "CRITICAL";
    if (frontMeters < 0.7) return "HIGH";
    if (frontMeters < 1.2) return "MODERATE";
  }
  if (usMeters !== undefined && usMeters > 0 && usMeters < 0.3) {
    return "CRITICAL";
  }
  if (s.includes("TURN") || s.includes("SLOW") || s.includes("INSPECT")) {
    return "MODERATE";
  }
  return "LOW";
}

export function parseLoraTelemetryFrame(line: string): ParsedLoraTelemetry | null {
  if (!line) return null;
  const raw = line.trim();
  if (!raw || raw.startsWith("#")) return null;

  const now = Date.now();

  // 1. JSON Frame
  if (raw.startsWith("{") && raw.endsWith("}")) {
    try {
      const data = JSON.parse(raw);
      const roll = data.roll !== undefined ? Number(data.roll) : undefined;
      const pitch = data.pitch !== undefined ? Number(data.pitch) : undefined;
      const frontCm = data.front_cm !== undefined ? Number(data.front_cm) : undefined;
      const usCm = data.us_cm !== undefined ? Number(data.us_cm) : undefined;
      const battV = data.batt_v !== undefined ? Number(data.batt_v) : Number(data.batt);
      const state = String(data.state || data.fsm || "").trim();

      const frontMeters = frontCm !== undefined && frontCm > 0 ? frontCm / 100 : undefined;
      const usMeters = usCm !== undefined && usCm > 0 ? usCm / 100 : undefined;
      const batteryVoltage = !Number.isNaN(battV) && battV > 0 ? battV : undefined;
      const batteryPercent =
        batteryVoltage !== undefined
          ? Math.max(0, Math.min(100, Math.round(((batteryVoltage - 12.8) / 4.0) * 100)))
          : undefined;

      return {
        rollDegrees: Number.isNaN(roll) ? undefined : roll,
        pitchDegrees: Number.isNaN(pitch) ? undefined : pitch,
        frontDistanceMeters: frontMeters,
        ultrasonicMeters: usMeters,
        batteryVoltage,
        batteryPercent,
        fsmState: state || undefined,
        riskLevel: deriveRiskLevel(state, frontMeters, usMeters),
        raw,
        timestamp: now
      };
    } catch {
      // Fall through to regex parser
    }
  }

  // 2. Key-Value Frame (e.g. TLM:R=...;P=...)
  if (raw.startsWith("TLM:")) {
    const body = raw.slice(4);
    const pairs = body.split(";");
    const kv: Record<string, string> = {};
    for (const p of pairs) {
      const [k, v] = p.split("=");
      if (k && v !== undefined) kv[k.trim().toUpperCase()] = v.trim();
    }

    const roll = kv.R !== undefined ? parseFloat(kv.R) : undefined;
    const pitch = kv.P !== undefined ? parseFloat(kv.P) : undefined;
    const frontCm = kv.LIDAR !== undefined ? parseFloat(kv.LIDAR) : undefined;
    const usCm = kv.US !== undefined ? parseFloat(kv.US) : undefined;
    const battV = kv.BATT !== undefined ? parseFloat(kv.BATT) : undefined;
    const state = kv.FSM || "";

    const frontMeters = frontCm !== undefined && !Number.isNaN(frontCm) && frontCm > 0 ? frontCm / 100 : undefined;
    const usMeters = usCm !== undefined && !Number.isNaN(usCm) && usCm > 0 ? usCm / 100 : undefined;
    const batteryVoltage = battV !== undefined && !Number.isNaN(battV) && battV > 0 ? battV : undefined;
    const batteryPercent =
      batteryVoltage !== undefined
        ? Math.max(0, Math.min(100, Math.round(((batteryVoltage - 12.8) / 4.0) * 100)))
        : undefined;

    return {
      rollDegrees: Number.isNaN(roll) ? undefined : roll,
      pitchDegrees: Number.isNaN(pitch) ? undefined : pitch,
      frontDistanceMeters: frontMeters,
      ultrasonicMeters: usMeters,
      batteryVoltage,
      batteryPercent,
      fsmState: state || undefined,
      riskLevel: deriveRiskLevel(state, frontMeters, usMeters),
      raw,
      timestamp: now
    };
  }

  // 3. Standard ASCII Frame
  // Pattern: [IMU] R: 0.0° P: 0.0° | [LiDAR] Fr: 138cm | [US] 14cm | [BATT] 16.2V || STATE REASON
  let roll: number | undefined;
  let pitch: number | undefined;
  let frontMeters: number | undefined;
  let usMeters: number | undefined;
  let batteryVoltage: number | undefined;
  let batteryPercent: number | undefined;
  let fsmState: string | undefined;
  let fsmReason: string | undefined;

  // IMU
  const imuMatch = raw.match(/R:\s*([+-]?\d+(?:\.\d+)?)\s*°?\s+P:\s*([+-]?\d+(?:\.\d+)?)\s*°?/i);
  if (imuMatch) {
    const r = parseFloat(imuMatch[1]);
    const p = parseFloat(imuMatch[2]);
    if (!Number.isNaN(r)) roll = r;
    if (!Number.isNaN(p)) pitch = p;
  }

  // LiDAR
  const lidarMatch = raw.match(/(?:\[LiDAR\]|Fr:)\s*(?:Fr:)?\s*([+-]?\d+(?:\.\d+)?)\s*cm/i);
  if (lidarMatch) {
    const cm = parseFloat(lidarMatch[1]);
    if (!Number.isNaN(cm) && cm > 0) frontMeters = cm / 100;
  }

  // Ultrasonic
  const usMatch = raw.match(/\[US\]\s*([+-]?\d+(?:\.\d+)?)\s*cm/i);
  if (usMatch) {
    const cm = parseFloat(usMatch[1]);
    if (!Number.isNaN(cm) && cm > 0) usMeters = cm / 100;
  }

  // Battery
  const battMatch = raw.match(/\[BATT\]\s*([+-]?\d+(?:\.\d+)?)\s*V/i);
  if (battMatch) {
    const v = parseFloat(battMatch[1]);
    if (!Number.isNaN(v) && v > 0) {
      batteryVoltage = v;
      batteryPercent = Math.max(0, Math.min(100, Math.round(((v - 12.8) / 4.0) * 100)));
    }
  }

  // FSM State and reason
  const fsmSplit = raw.split("||");
  if (fsmSplit.length > 1) {
    const tail = fsmSplit[1].trim();
    const parts = tail.split(/\s+(.+)/);
    fsmState = parts[0] || tail;
    fsmReason = parts[1] || "";
  }

  // If we extracted at least one valid telemetry parameter
  if (
    roll !== undefined ||
    pitch !== undefined ||
    frontMeters !== undefined ||
    usMeters !== undefined ||
    batteryVoltage !== undefined ||
    fsmState !== undefined
  ) {
    return {
      rollDegrees: roll,
      pitchDegrees: pitch,
      frontDistanceMeters: frontMeters,
      ultrasonicMeters: usMeters,
      batteryVoltage,
      batteryPercent,
      fsmState,
      fsmReason,
      riskLevel: deriveRiskLevel(fsmState, frontMeters, usMeters),
      raw,
      timestamp: now
    };
  }

  return null;
}
