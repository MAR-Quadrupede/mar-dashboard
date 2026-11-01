"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { parseLoraTelemetryFrame, ParsedLoraTelemetry } from "@/lib/loraParser";

export interface LoraPortInfo {
  usbVendorId?: number;
  usbProductId?: number;
}

export interface UseLoraSerialOptions {
  baudRate?: number;
  onTelemetry?: (data: ParsedLoraTelemetry) => void;
  onRawLine?: (line: string) => void;
}

export function useLoraSerial(options?: UseLoraSerialOptions) {
  const { baudRate: defaultBaud = 9600, onTelemetry, onRawLine } = options || {};

  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [portInfo, setPortInfo] = useState<LoraPortInfo | null>(null);
  const [baudRate, setBaudRate] = useState<number>(defaultBaud);
  const [rxCount, setRxCount] = useState<number>(0);
  const [txCount, setTxCount] = useState<number>(0);
  const [lastRxFrame, setLastRxFrame] = useState<string | null>(null);
  const [lastTxFrame, setLastTxFrame] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const keepReadingRef = useRef<boolean>(false);
  const onTelemetryRef = useRef(onTelemetry);
  onTelemetryRef.current = onTelemetry;
  const onRawLineRef = useRef(onRawLine);
  onRawLineRef.current = onRawLine;

  useEffect(() => {
    const supported = typeof navigator !== "undefined" && "serial" in navigator;
    setIsSupported(supported);

    if (supported) {
      const handleDisconnect = (event: any) => {
        if (event.target === portRef.current) {
          console.warn("[LoRa Serial] Dispositivo USB disconnesso!");
          disconnect();
          setLastError("Dispositivo USB LoRa disconnesso.");
        }
      };
      (navigator as any).serial?.addEventListener("disconnect", handleDisconnect);
      return () => {
        (navigator as any).serial?.removeEventListener("disconnect", handleDisconnect);
      };
    }
  }, []);

  const disconnect = useCallback(async () => {
    keepReadingRef.current = false;

    if (readerRef.current) {
      try {
        await readerRef.current.cancel();
      } catch {
        // ignore
      }
      readerRef.current = null;
    }

    if (portRef.current) {
      try {
        await portRef.current.close();
      } catch {
        // ignore
      }
      portRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
    setPortInfo(null);
  }, []);

  const readLoop = async (port: any) => {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    readerRef.current = reader;
    keepReadingRef.current = true;

    let buffer = "";

    try {
      while (keepReadingRef.current) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split(/\r?\n/);
          // Keep uncompleted line fragment in buffer
          buffer = lines.pop() || "";

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;

            setRxCount((c) => c + 1);
            setLastRxFrame(line);

            if (onRawLineRef.current) {
              onRawLineRef.current(line);
            }

            const parsed = parseLoraTelemetryFrame(line);
            if (parsed && onTelemetryRef.current) {
              onTelemetryRef.current(parsed);
            }
          }
        }
      }
    } catch (err: any) {
      if (keepReadingRef.current) {
        console.error("[LoRa Serial] Errore lettura stream:", err);
        setLastError(err.message || "Errore lettura stream seriale");
      }
    } finally {
      try {
        reader.releaseLock();
      } catch {
        // ignore
      }
      try {
        await readableStreamClosed.catch(() => {});
      } catch {
        // ignore
      }
    }
  };

  const connect = useCallback(
    async (customBaud?: number): Promise<boolean> => {
      if (typeof navigator === "undefined" || !("serial" in navigator)) {
        setLastError("Web Serial API non supportata in questo browser o contesto (richiede HTTPS o localhost).");
        return false;
      }

      const activeBaud = customBaud || baudRate;
      setIsConnecting(true);
      setLastError(null);

      try {
        const port = await (navigator as any).serial.requestPort();
        await port.open({ baudRate: activeBaud });

        portRef.current = port;
        const info = port.getInfo ? port.getInfo() : null;
        setPortInfo(info);
        setIsConnected(true);
        setIsConnecting(false);

        // Start non-blocking background read loop
        readLoop(port).catch((err) => {
          console.error("[LoRa Serial] Read loop terminated:", err);
        });

        return true;
      } catch (err: any) {
        setIsConnecting(false);
        setIsConnected(false);
        if (err.name !== "NotFoundError") {
          setLastError(err.message || "Impossibile aprire la porta seriale LoRa");
        }
        return false;
      }
    },
    [baudRate]
  );

  const sendFrame = useCallback(async (line: string): Promise<boolean> => {
    const port = portRef.current;
    if (!port || !port.writable) {
      return false;
    }

    try {
      const encoder = new TextEncoder();
      const clean = line.endsWith("\n") ? line : line + "\n";
      const writer = port.writable.getWriter();
      await writer.write(encoder.encode(clean));
      writer.releaseLock();

      setTxCount((c) => c + 1);
      setLastTxFrame(clean.trim());
      return true;
    } catch (err: any) {
      console.error("[LoRa Serial] Errore trasmissione frame:", err);
      setLastError(err.message || "Errore invio comando LoRa");
      return false;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      keepReadingRef.current = false;
      if (readerRef.current) {
        try {
          readerRef.current.cancel();
        } catch {
          // ignore
        }
      }
      if (portRef.current) {
        try {
          portRef.current.close();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  return {
    isSupported,
    isConnected,
    isConnecting,
    portInfo,
    baudRate,
    setBaudRate,
    rxCount,
    txCount,
    lastRxFrame,
    lastTxFrame,
    lastError,
    connect,
    disconnect,
    sendFrame
  };
}
