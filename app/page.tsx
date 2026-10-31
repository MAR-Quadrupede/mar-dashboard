"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGatewayLive } from "@/hooks/useGatewayLive";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { CameraView } from "@/components/CameraView";
import { LineOfThoughtPanel } from "@/components/LineOfThoughtPanel";
import { MovementPanel } from "@/components/MovementPanel";
import { SensorsTelemetryPanel } from "@/components/SensorsTelemetryPanel";
import { LidarRadar } from "@/components/LidarRadar";
import { AuthScreen } from "@/components/AuthScreen";

export default function DashboardPage() {
  const { token, user, loading: authLoading, error: authError, login, logout } = useAuth();

  const [streams, setStreams] = useState<any[]>([]);
  const [lock, setLock] = useState<any>(null);
  const [gatewayWsUrl, setGatewayWsUrl] = useState<string | null>(null);

  const live = useGatewayLive(Boolean(token), gatewayWsUrl);

  const refreshLock = useCallback(async () => {
    if (!token) return;
    try {
      const statusRes = await api.getRoverStatus(token);
      if (statusRes?.lock) setLock(statusRes.lock);
      // Prefer live WS telemetry; API mock is ignored when link is live
    } catch {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const [videoRes, settingsRes] = await Promise.all([
          api.getRoverVideo(token).catch(() => []),
          api.getSettings(token).catch(() => null)
        ]);
        if (Array.isArray(videoRes)) setStreams(videoRes);
        if (settingsRes?.gatewayWsUrl) setGatewayWsUrl(settingsRes.gatewayWsUrl);
      } catch {
        // ignore
      }
      await refreshLock();
    })();

    const interval = setInterval(refreshLock, 5000);
    return () => clearInterval(interval);
  }, [token, refreshLock]);

  useEffect(() => {
    if (!token || !lock?.isHeldByCaller) return;

    const heartbeatInterval = setInterval(async () => {
      try {
        await api.heartbeatControlLock(token);
      } catch {
        // ignore
      }
    }, 10000);

    return () => clearInterval(heartbeatInterval);
  }, [token, lock?.isHeldByCaller]);

  const handleAcquireLock = async () => {
    if (!token) return;
    try {
      const res = await api.acquireControlLock(token, Boolean(user?.isAdmin));
      if (res.state) setLock(res.state);
      await refreshLock();
    } catch (err: any) {
      alert(err.message || "Impossibile acquisire il controllo");
    }
  };

  const handleReleaseLock = async () => {
    if (!token) return;
    try {
      await api.releaseControlLock(token);
      await refreshLock();
    } catch (err: any) {
      alert(err.message || "Errore nel rilascio del controllo");
    }
  };

  const handleSendCommand = async (command: string, speed?: number) => {
    if (!token) return;

    // E-CUT / STOP always go to MQTT immediately via gateway WS
    const upper = command.toUpperCase();
    if (upper.includes("ESTOP") || upper === "E-CUT" || upper === "CMD:ESTOP") {
      live.sendEstop();
      return;
    }

    const pushed = live.sendMotion(command, speed);
    try {
      await api.sendCommand(token, command, speed);
    } catch (err: any) {
      if (err.status === 403) {
        alert(err.message || "Non hai i permessi per inviare comandi: controllo occupato da un altro utente.");
        refreshLock();
      } else if (!pushed) {
        console.error("Command error:", err);
      }
    }
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
        Caricamento console...
      </div>
    );
  }

  if (!token) {
    return <AuthScreen onLogin={login} loading={authLoading} error={authError} />;
  }

  const linkLabel =
    live.link === "live"
      ? "LIVE MQTT"
      : live.link === "connecting" || live.link === "reconnecting"
        ? "SYNC…"
        : "OFFLINE";

  return (
    <div className="container">
      <Navbar
        username={user?.username}
        isAdmin={user?.isAdmin}
        lock={lock}
        onAcquireLock={handleAcquireLock}
        onReleaseLock={handleReleaseLock}
        onLogout={logout}
        liveLinkLabel={linkLabel}
        liveLinkOk={live.link === "live"}
      />

      <main className="grid-main">
        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <CameraView streams={streams} visionFps={live.visionFps} />
          <LineOfThoughtPanel data={live.thought} />
        </section>

        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <MovementPanel
            canControl={Boolean(lock?.isHeldByCaller)}
            holderUsername={lock?.holderUsername}
            onSendCommand={handleSendCommand}
            onAcquireLock={handleAcquireLock}
            onEstop={() => live.sendEstop()}
          />
          <SensorsTelemetryPanel telemetry={live.telemetry} />
          <LidarRadar
            points={live.lidarPointsCloud}
            frontDistanceM={live.telemetry.frontDistanceMeters}
          />
        </section>
      </main>
    </div>
  );
}
