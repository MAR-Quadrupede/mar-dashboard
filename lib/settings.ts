import { prisma } from "./prisma";

export type SystemSettings = {
  leftStreamUrl: string;
  rightStreamUrl: string;
  gatewayWsUrl: string;
  lockTimeoutSeconds: number;
  criticalDistanceMeters: number;
};

const defaultSettings: SystemSettings = {
  leftStreamUrl: "http://100.77.16.116:8443/stream_left.mjpg",
  rightStreamUrl: "http://100.77.16.116:8443/stream_right.mjpg",
  gatewayWsUrl: "ws://localhost:8765",
  lockTimeoutSeconds: 35,
  criticalDistanceMeters: 0.35
};

export async function getSystemSettings(): Promise<SystemSettings> {
  try {
    const records = await prisma.systemSetting.findMany();
    const map: Record<string, string> = {};
    records.forEach((r) => {
      map[r.key] = r.value;
    });

    return {
      leftStreamUrl: map.leftStreamUrl || defaultSettings.leftStreamUrl,
      rightStreamUrl: map.rightStreamUrl || defaultSettings.rightStreamUrl,
      gatewayWsUrl: map.gatewayWsUrl || defaultSettings.gatewayWsUrl,
      lockTimeoutSeconds: map.lockTimeoutSeconds ? Number(map.lockTimeoutSeconds) : defaultSettings.lockTimeoutSeconds,
      criticalDistanceMeters: map.criticalDistanceMeters ? Number(map.criticalDistanceMeters) : defaultSettings.criticalDistanceMeters
    };
  } catch {
    return defaultSettings;
  }
}

export async function updateSystemSetting(key: keyof SystemSettings, value: string | number): Promise<void> {
  try {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) }
    });
  } catch (err) {
    console.warn(`Failed to update setting ${key}:`, err);
  }
}
