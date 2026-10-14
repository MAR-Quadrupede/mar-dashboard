export type ApiFetchOptions = {
  token?: string | null;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const method = options.method || (options.body ? "POST" : "GET");

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  });

  if (!res.ok) {
    let message = `Richiesta fallita (${res.status})`;
    let json: any = null;
    try {
      json = await res.json();
      message = json.message || json.error || message;
    } catch {
      // not json
    }
    const err = new Error(message) as Error & { status?: number; data?: any };
    err.status = res.status;
    err.data = json;
    throw err;
  }

  return res.json();
}

export const api = {
  // Auth
  login: (username: string, password: string) =>
    apiFetch<{ token: string; user: { id: string; username: string; isAdmin: boolean } }>("/auth/login", {
      method: "POST",
      body: { username, password }
    }),

  getMe: (token: string) =>
    apiFetch<{ id: string; username: string; isAdmin: boolean; createdAt: string }>("/auth/me", { token }),

  // Control Lock
  getControlLock: (token: string) =>
    apiFetch<{
      isHeld: boolean;
      holderUserId: string | null;
      holderUsername: string | null;
      holderIp: string | null;
      expiresInSeconds: number;
      isHeldByCaller: boolean;
    }>("/control-lock", { token }),

  acquireControlLock: (token: string, force = false) =>
    apiFetch<{
      success: boolean;
      message?: string;
      state: {
        isHeld: boolean;
        holderUserId: string | null;
        holderUsername: string | null;
        expiresInSeconds: number;
        isHeldByCaller: boolean;
      };
    }>("/control-lock", {
      method: "POST",
      token,
      body: { force }
    }),

  heartbeatControlLock: (token: string) =>
    apiFetch<{ success: boolean }>("/control-lock", {
      method: "POST",
      token,
      body: { action: "heartbeat" }
    }),

  releaseControlLock: (token: string, force = false) =>
    apiFetch<{ success: boolean }>("/control-lock", {
      method: "DELETE",
      token,
      body: { force }
    }),

  // Rover status & Line of Thought
  getRoverStatus: (token: string) =>
    apiFetch<{
      telemetry: {
        batteryPercent: number;
        batteryVoltage: number;
        currentAmps: number;
        temperatureCelsius: number;
        frontDistanceMeters: number;
        lidarPoints: number;
        rollDegrees: number;
        pitchDegrees: number;
        latitude: number;
        longitude: number;
        connectivity: "online" | "degraded" | "offline";
        fsmState: string;
        updatedAt: string;
      };
      lock: {
        isHeld: boolean;
        holderUsername: string | null;
        isHeldByCaller: boolean;
        expiresInSeconds: number;
      };
    }>("/rover/status", { token }),

  getRoverThought: (token: string) =>
    apiFetch<{
      currentStage: string;
      activeTarget: {
        label: string;
        confidence: number;
        distanceMeters: number;
        azimuthDeg: number;
      };
      currentDecision: {
        command: string;
        justification: string;
        riskLevel: "LOW" | "MODERATE" | "CRITICAL";
      };
      recentThoughts: Array<{
        id: string;
        timestamp: string;
        stage: string;
        targetObject: string;
        confidence: number;
        distanceMeters: number;
        azimuthDeg: number;
        reasoning: string;
        chosenAction: string;
      }>;
    }>("/rover/thought", { token }),

  getRoverVideo: (token: string) =>
    apiFetch<Array<{ id: string; name: string; url: string; role: string; active: boolean }>>("/rover/video", { token }),

  getCommands: (token: string) =>
    apiFetch<Array<{ id: string; command: string; speed: number | null; createdAt: string }>>("/rover/command", { token }),

  sendCommand: (token: string, command: string, speed?: number) =>
    apiFetch<{ success: boolean; id: string; command: string; speed: number | null; timestamp: string }>("/rover/command", {
      method: "POST",
      token,
      body: { command, speed }
    }),

  // Users
  getUsers: (token: string) =>
    apiFetch<Array<{ id: string; username: string; isAdmin: boolean; createdAt: string }>>("/users", { token }),

  createUser: (token: string, username: string, password: string, isAdmin = false) =>
    apiFetch<{ id: string; username: string; isAdmin: boolean }>("/users", {
      method: "POST",
      token,
      body: { username, password, isAdmin }
    }),

  updateUser: (token: string, id: string, data: { username?: string; password?: string; isAdmin?: boolean }) =>
    apiFetch<{ id: string; username: string; isAdmin: boolean }>(`/users/${id}`, {
      method: "PATCH",
      token,
      body: data
    }),

  deleteUser: (token: string, id: string) =>
    apiFetch<{ success: boolean }>(`/users/${id}`, {
      method: "DELETE",
      token
    }),

  // Settings
  getSettings: (token: string) =>
    apiFetch<{
      leftStreamUrl: string;
      rightStreamUrl: string;
      gatewayWsUrl: string;
      lockTimeoutSeconds: number;
      criticalDistanceMeters: number;
    }>("/settings", { token }),

  updateSettings: (token: string, data: Record<string, any>) =>
    apiFetch<Record<string, any>>("/settings", {
      method: "POST",
      token,
      body: data
    })
};
