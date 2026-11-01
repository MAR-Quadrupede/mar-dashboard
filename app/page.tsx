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
    const upper = command.toUpperCase();
    if (upper.includes("ESTOP") || upper === "E-CUT" || upper === "CMD:ESTOP") {
      live.sendEstop();
      return;
    }

    const pushed = live.sendMotion(command, speed);
    if (token) {
      try {
        await api.sendCommand(token, command, speed);
      } catch (err: any) {
        if (err.status === 403) {
          alert(err.message || "Permesso negato: il controllo è detenuto da un altro operatore.");
          refreshLock();
        } else if (!pushed) {
          console.error("Command error:", err);
        }
      }
    }
  };

  if (authLoading) {
    return (
      <div
        className="mono"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-muted)",
          fontSize: 12
        }}
      >
        INIZIALIZZAZIONE CONSOLE M.A.R....
      </div>
    );
  }

  if (!token) {
    return <AuthScreen onLogin={login} loading={authLoading} error={authError} />;
  }

  const linkLabel =
    live.transportMode === "LORA"
      ? "LORA (USB) 868MHz"
      : live.link === "live"
        ? "MQTT LIVE"
        : live.link === "connecting" || live.link === "reconnecting"
          ? "SYNC..."
          : "OFFLINE";
  const linkOk = live.transportMode === "LORA" || live.link === "live";

  return (
    <div className="workstation">
      <Navbar
        username={user?.username}
        isAdmin={user?.isAdmin}
        lock={lock}
        onAcquireLock={handleAcquireLock}
        onReleaseLock={handleReleaseLock}
        onLogout={logout}
        liveLinkLabel={linkLabel}
        liveLinkOk={linkOk}
        lora={live.lora}
        quickTelemetry={{
          batteryVoltage: live.telemetry.batteryVoltage,
          batteryPercent: live.telemetry.batteryPercent,
          currentAmps: live.telemetry.currentAmps,
          temperatureCelsius: live.telemetry.temperatureCelsius,
          pitchDegrees: live.telemetry.pitchDegrees,
          rollDegrees: live.telemetry.rollDegrees
        }}
      />

      <main className="workstation-content">
        <div className="cockpit-grid">
          {/* Left Column: Visual awareness & Perception inspector */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <CameraView streams={streams} visionFps={live.visionFps} loraMode={live.isLoraActive} />
            <LineOfThoughtPanel data={live.thought} />
          </div>

          {/* Right Column: Actuators, telemetry & Radar */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <MovementPanel
              canControl={Boolean(lock?.isHeldByCaller) || live.isLoraActive}
              holderUsername={lock?.holderUsername}
              onSendCommand={handleSendCommand}
              onAcquireLock={handleAcquireLock}
              onEstop={() => live.sendEstop()}
              transportMode={live.transportMode}
            />
            <SensorsTelemetryPanel telemetry={live.telemetry} />
            <LidarRadar
              points={live.lidarPointsCloud}
              frontDistanceM={live.telemetry.frontDistanceMeters}
              slamPose={live.slamPose}
              slamMap={live.slamMap}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
