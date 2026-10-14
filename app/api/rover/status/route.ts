import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getRoverTelemetry } from "@/lib/roverData";
import { getControlLockStatus } from "@/lib/controlLock";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ message: "Non autenticato" }, { status: 401 });
    }

    const telemetry = await getRoverTelemetry();
    const lock = getControlLockStatus(auth.id);

    return NextResponse.json({
      telemetry,
      lock
    });
  } catch (error) {
    console.error("Rover status error:", error);
    return NextResponse.json({ message: "Errore interno del server" }, { status: 500 });
  }
}
