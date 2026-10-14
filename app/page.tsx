"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { CameraView } from "@/components/CameraView";
import { LineOfThoughtPanel } from "@/components/LineOfThoughtPanel";
import { MovementPanel } from "@/components/MovementPanel";
import { SensorsTelemetryPanel } from "@/components/SensorsTelemetryPanel";
import { AuthScreen } from "@/components/AuthScreen";

export default function DashboardPage() {
  const { token, user, loading: authLoading, error: authError, login, logout } = useAuth();

  const [telemetry, setTelemetry] = useState<any>(null);
  const [thought, setThought] = useState<any>(null);
  const [streams, setStreams] = useState<any[]>([]);
  const [lock, setLock] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);

  // Fetch telemetry and lock
  const fetchData = useCallback(async () => {
    if (!token) return;
    try {
      const [statusRes, thoughtRes, videoRes] = await Promise.all([
        api.getRoverStatus(token).catch(() => null),
        api.getRoverThought(token).catch(() => null),
        api.getRoverVideo(token).catch(() => [])
      ]);

      if (statusRes) {
        setTelemetry(statusRes.telemetry);
        setLock(statusRes.lock);
      }
      if (thoughtRes) {
        setThought(thoughtRes);
      }
      if (videoRes) {
        setStreams(videoRes);
      }
    } catch (err) {
      console.warn("Poll fetch error:", err);
    }
  }, [token]);

  // Initial load and periodic poll
  useEffect(() => {
    if (!token) return;
    fetchData();

    const interval = setInterval(fetchData, 2500);
    return () => clearInterval(interval);
  }, [token, fetchData]);

  // Heartbeat when caller holds the lock
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

  // Acquire control lock
  const handleAcquireLock = async () => {
    if (!token) return;
    try {
      const res = await api.acquireControlLock(token, Boolean(user?.isAdmin));
      if (res.state) {
        setLock(res.state);
      }
      await fetchData();
    } catch (err: any) {
      alert(err.message || "Impossibile acquisire il controllo");
    }
  };

  // Release control lock
  const handleReleaseLock = async () => {
    if (!token) return;
    try {
      await api.releaseControlLock(token);
      await fetchData();
    } catch (err: any) {
      alert(err.message || "Errore nel rilascio del controllo");
    }
  };

  // Dispatch movement command
  const handleSendCommand = async (command: string, speed?: number) => {
    if (!token) return;
    try {
      await api.sendCommand(token, command, speed);
      fetchData();
    } catch (err: any) {
      if (err.status === 403) {
        alert(err.message || "Non hai i permessi per inviare comandi: controllo occupato da un altro utente.");
        fetchData();
      } else {
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

  return (
    <div className="container">
      {/* Top Header & Lock Pill */}
      <Navbar
        username={user?.username}
        isAdmin={user?.isAdmin}
        lock={lock}
        onAcquireLock={handleAcquireLock}
        onReleaseLock={handleReleaseLock}
        onLogout={logout}
      />

      {/* Main Ergonomic Grid */}
      <main className="grid-main">
        {/* Left Column: Vision & Model Line of Thought */}
        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 1. Stereo Video Cameras */}
          <CameraView streams={streams} />

          {/* 2. Classification Model Line of Thought */}
          <LineOfThoughtPanel data={thought} />
        </section>

        {/* Right Column: Motion Controls & Subsystem Sensors */}
        <section style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 3. Directional Movement & Gait Controls */}
          <MovementPanel
            canControl={Boolean(lock?.isHeldByCaller)}
            holderUsername={lock?.holderUsername}
            onSendCommand={handleSendCommand}
            onAcquireLock={handleAcquireLock}
          />

          {/* 4. Sensor Readings & Hardware Telemetry */}
          <SensorsTelemetryPanel telemetry={telemetry} />
        </section>
      </main>
    </div>
  );
}
