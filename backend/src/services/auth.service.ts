import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";

import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import type { AuthIdentity, SafeUser } from "../types/auth.js";

function toSafeUser(user: { id: string; name: string; email: string; role: SafeUser["role"] }): SafeUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

export async function authenticate(email: string, password: string): Promise<{ token: string; user: SafeUser } | null> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return null;
  }

  const payload: AuthIdentity = { userId: user.id, role: user.role };
  const token = jwt.sign(payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as SignOptions["expiresIn"],
  });

  return { token, user: toSafeUser(user) };
}

export async function findSafeUserById(id: string): Promise<SafeUser | null> {
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true },
  });

  return user ? toSafeUser(user) : null;
}

export async function listReviewers(): Promise<SafeUser[]> {
  return prisma.user.findMany({ where: { role: "REVIEWER" }, select: { id: true, name: true, email: true, role: true }, orderBy: [{ name: "asc" }, { email: "asc" }] });
}
