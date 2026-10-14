import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createUserSchema = z.object({
  username: z.string().min(3, "Username di almeno 3 caratteri"),
  password: z.string().min(6, "Password di almeno 6 caratteri"),
  isAdmin: z.boolean().optional().default(false)
});

// GET /api/users - List users
export async function GET(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ message: "Non autenticato" }, { status: 401 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        isAdmin: true,
        createdAt: true
      },
      orderBy: { createdAt: "desc" }
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Get users error:", error);
    return NextResponse.json({ message: "Errore interno del server" }, { status: 500 });
  }
}

// POST /api/users - Create new user (admin only)
export async function POST(req: NextRequest) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ message: "Non autenticato" }, { status: 401 });
    }

    if (!auth.isAdmin) {
      return NextResponse.json({ message: "Privilegi di amministratore richiesti" }, { status: 403 });
    }

    const body = await req.json();
    const parse = createUserSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json({ message: parse.error.errors[0]?.message || "Dati non validi" }, { status: 400 });
    }

    const { username, password, isAdmin } = parse.data;

    const existing = await prisma.user.findUnique({
      where: { username: username.trim() }
    });

    if (existing) {
      return NextResponse.json({ message: "Username già esistente" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const newUser = await prisma.user.create({
      data: {
        username: username.trim(),
        passwordHash,
        isAdmin
      },
      select: {
        id: true,
        username: true,
        isAdmin: true,
        createdAt: true
      }
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error("Create user error:", error);
    return NextResponse.json({ message: "Errore interno del server" }, { status: 500 });
  }
}
