import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { canUserControl, getControlLockStatus } from "@/lib/controlLock";
import { recordRoverCommand } from "@/lib/roverData";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/rover/command - List recent commands
export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ message: "Non autenticato" }, { status: 401 });
    }

    try {
      const recent = await prisma.command.findMany({
        take: 10,
        orderBy: { createdAt: "desc" }
      });
      return NextResponse.json(recent);
    } catch {
      return NextResponse.json([]);
    }
  } catch (error) {
    console.error("Get commands error:", error);
    return NextResponse.json({ message: "Errore interno del server" }, { status: 500 });
  }
}

// POST /api/rover/command - Dispatch motion/posture command
export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ message: "Non autenticato" }, { status: 401 });
    }

    // ENFORCE CONTROL LOCK: only active lock holder can issue commands!
    const hasLock = canUserControl(auth);
    if (!hasLock) {
      const lockState = getControlLockStatus(auth.id);
      return NextResponse.json(
        {
          error: "CONTROL_LOCK_DENIED",
          message: lockState.isHeld 
            ? `Controllo negato: il rover è attualmente pilotato da '${lockState.holderUsername}'`
            : "Controllo negato: devi prima acquisire il controllo attivo",
          lock: lockState
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { command, speed } = body as { command: string; speed?: number };

    if (!command) {
      return NextResponse.json({ message: "Comando non specificato" }, { status: 400 });
    }

    // Persist command to DB
    const saved = await recordRoverCommand(command, speed, auth.id);

    return NextResponse.json({
      success: true,
      id: saved?.id || `cmd-${Date.now()}`,
      command: command.toUpperCase().trim(),
      speed: speed ?? null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Post command error:", error);
    return NextResponse.json({ message: "Errore interno del server" }, { status: 500 });
  }
}
