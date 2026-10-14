import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getRoverVideoStreams } from "@/lib/roverData";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ message: "Non autenticato" }, { status: 401 });
    }

    const streams = await getRoverVideoStreams();
    return NextResponse.json(streams);
  } catch (error) {
    console.error("Video streams error:", error);
    return NextResponse.json({ message: "Errore interno del server" }, { status: 500 });
  }
}
