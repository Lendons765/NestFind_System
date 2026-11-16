import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";

export type Role = "tenant" | "owner" | "admin";

export interface AuthUser {
  id: string;
  role: Role;
}

// Adds req.user after requireAuth runs.
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set in .env (at least 32 characters).");
  }
  return secret;
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, role: user.role }, getSecret(), { expiresIn: "7d" });
}

// Rejects requests without a valid "Authorization: Bearer <token>" header.
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: "Please log in." });
    return;
  }

  try {
    const payload = jwt.verify(token, getSecret()) as jwt.JwtPayload;
    req.user = { id: String(payload.sub), role: payload.role as Role };
    next();
  } catch {
    res.status(401).json({ error: "Your session has expired. Please log in again." });
  }
}

// Use after requireAuth to limit a route to certain roles.
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "You don't have permission to do this." });
      return;
    }
    next();
  };
}