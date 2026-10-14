import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword, signToken } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  username: z.string().min(1, "Username richiesto"),
  password: z.string().min(1, "Password richiesta")
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parse = loginSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json({ message: "Dati non validi" }, { status: 400 });
    }

    const { username, password } = parse.data;

    // Check if any users exist in DB; if not, create initial admin
    let userCount = 0;
    try {
      userCount = await prisma.user.count();
    } catch (dbErr) {
      console.warn("DB count check:", dbErr);
    }

    if (userCount === 0) {
      try {
        const initialHash = await hashPassword("admin123");
        await prisma.user.create({
          data: {
            username: "admin",
            passwordHash: initialHash,
            isAdmin: true
          }
        });
      } catch (createErr) {
        console.warn("Initial admin creation error:", createErr);
      }
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { username: username.trim() }
    });

    if (!user) {
      return NextResponse.json({ message: "Credenziali non valide" }, { status: 401 });
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ message: "Credenziali non valide" }, { status: 401 });
    }

    const token = signToken({
      id: user.id,
      username: user.username,
      isAdmin: user.isAdmin
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        isAdmin: user.isAdmin
      }
    });
  } catch (error) {
    console.error("Login route error:", error);
    return NextResponse.json({ message: "Errore interno del server" }, { status: 500 });
  }
}
