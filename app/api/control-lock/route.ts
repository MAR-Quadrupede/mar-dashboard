import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import {
  getControlLockStatus,
  acquireControlLock,
  heartbeatControlLock,
  releaseControlLock
} from "@/lib/controlLock";

export const dynamic = "force-dynamic";

// GET /api/control-lock: Check lock status
export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    const status = getControlLockStatus(auth?.id);
    return NextResponse.json(status);
  } catch (error) {
    console.error("Control lock GET error:", error);
    return NextResponse.json({ message: "Errore interno del server" }, { status: 500 });
  }
}

// POST /api/control-lock: Acquire or heartbeat lock
export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ message: "Non autenticato" }, { status: 401 });
    }

    let body: { action?: string; force?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is acceptable
    }

    // Heartbeat action
    if (body.action === "heartbeat") {
      const refreshed = heartbeatControlLock(auth.id);
      return NextResponse.json({
        success: refreshed,
        state: getControlLockStatus(auth.id)
      });
    }

    // Release action
    if (body.action === "release") {
      const force = Boolean(body.force && auth.isAdmin);
      const released = releaseControlLock(auth.id, force);
      return NextResponse.json({
        success: released,
        state: getControlLockStatus(auth.id),
        message: released ? "Control lock rilasciato" : "Nessun lock attivo o non autorizzato"
      });
    }

    // Acquire action
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
    const force = Boolean(body.force && auth.isAdmin);

    const result = acquireControlLock(auth, clientIp, force);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          state: result.state
        },
        { status: 409 } // Conflict: held by another user
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Control lock POST error:", error);
    return NextResponse.json({ message: "Errore interno del server" }, { status: 500 });
  }
}

// DELETE /api/control-lock: Release control lock
export async function DELETE(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ message: "Non autenticato" }, { status: 401 });
    }

    let force = false;
    try {
      const body = await req.json();
      force = Boolean(body.force && auth.isAdmin);
    } catch {
      // Empty body
    }

    const released = releaseControlLock(auth.id, force);

    return NextResponse.json({
      success: released,
      state: getControlLockStatus(auth.id)
    });
  } catch (error) {
    console.error("Control lock DELETE error:", error);
    return NextResponse.json({ message: "Errore interno del server" }, { status: 500 });
  }
}
