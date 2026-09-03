import type { UserRole } from "@prisma/client";

export interface AuthIdentity {
  userId: string;
  role: UserRole;
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthIdentity;
    }
  }
}
