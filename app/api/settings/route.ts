import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getSystemSettings, updateSystemSetting, SystemSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ message: "Non autenticato" }, { status: 401 });
    }

    const settings = await getSystemSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Get settings error:", error);
    return NextResponse.json({ message: "Errore interno del server" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ message: "Non autenticato" }, { status: 401 });
    }

    if (!auth.isAdmin) {
      return NextResponse.json({ message: "Privilegi di amministratore richiesti" }, { status: 403 });
    }

    const body = (await req.json()) as Partial<SystemSettings>;

    for (const [key, value] of Object.entries(body)) {
      if (value !== undefined) {
        await updateSystemSetting(key as keyof SystemSettings, value);
      }
    }

    const updated = await getSystemSettings();
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Save settings error:", error);
    return NextResponse.json({ message: "Errore interno del server" }, { status: 500 });
  }
}
