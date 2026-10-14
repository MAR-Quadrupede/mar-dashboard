import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const dynamic = "force-dynamic";

const updateUserSchema = z.object({
  username: z.string().min(3).optional(),
  password: z.string().min(6).optional(),
  isAdmin: z.boolean().optional()
});

// PATCH /api/users/:id - Update user (admin only)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ message: "Non autenticato" }, { status: 401 });
    }

    if (!auth.isAdmin) {
      return NextResponse.json({ message: "Privilegi di amministratore richiesti" }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const parse = updateUserSchema.safeParse(body);

    if (!parse.success) {
      return NextResponse.json({ message: "Dati non validi" }, { status: 400 });
    }

    const updateData: { username?: string; passwordHash?: string; isAdmin?: boolean } = {};

    if (parse.data.username) {
      const existing = await prisma.user.findUnique({ where: { username: parse.data.username.trim() } });
      if (existing && existing.id !== id) {
        return NextResponse.json({ message: "Username già occupato" }, { status: 409 });
      }
      updateData.username = parse.data.username.trim();
    }

    if (parse.data.password) {
      updateData.passwordHash = await hashPassword(parse.data.password);
    }

    if (parse.data.isAdmin !== undefined) {
      updateData.isAdmin = parse.data.isAdmin;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, username: true, isAdmin: true, createdAt: true }
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Update user error:", error);
    return NextResponse.json({ message: "Errore interno del server" }, { status: 500 });
  }
}

// DELETE /api/users/:id - Delete user (admin only)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = getAuthUser(req);
    if (!auth) {
      return NextResponse.json({ message: "Non autenticato" }, { status: 401 });
    }

    if (!auth.isAdmin) {
      return NextResponse.json({ message: "Privilegi di amministratore richiesti" }, { status: 403 });
    }

    const { id } = params;

    if (id === auth.id) {
      return NextResponse.json({ message: "Non puoi eliminare il tuo stesso account" }, { status: 400 });
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete user error:", error);
    return NextResponse.json({ message: "Errore interno del server" }, { status: 500 });
  }
}
