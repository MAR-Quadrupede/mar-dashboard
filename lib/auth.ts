import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET || "m-a-r-secret-jwt-key-2026";

export type AuthUser = {
  id: string;
  username: string;
  isAdmin: boolean;
};

export function signToken(user: AuthUser, expiresIn = "12h"): string {
  return jwt.sign(
    {
      userId: user.id,
      username: user.username,
      isAdmin: user.isAdmin
    },
    JWT_SECRET,
    { expiresIn: expiresIn as any }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      username: string;
      isAdmin: boolean;
    };
    return {
      id: decoded.userId,
      username: decoded.username,
      isAdmin: Boolean(decoded.isAdmin)
    };
  } catch {
    return null;
  }
}

export function getAuthUser(req: NextRequest | Request): AuthUser | null {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return null;

  return verifyToken(parts[1]);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
