import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getLineOfThought } from "@/lib/roverData";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ message: "Non autenticato" }, { status: 401 });
    }

    const thought = getLineOfThought();
    return NextResponse.json(thought);
  } catch (error) {
    console.error("Rover thought error:", error);
    return NextResponse.json({ message: "Errore interno del server" }, { status: 500 });
  }
}
