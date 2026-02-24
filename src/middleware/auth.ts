import type { NextFunction, Request, Response } from "express";
import { resolveSupabaseIdentity } from "../auth/supabase.js";
import { findOrCreateUserByEmail, findUserByEmail, findUserById } from "../data/repository.js";
import type { Role, User } from "../types/domain.js";
import { HttpError } from "./errors.js";

declare global {
  namespace Express {
    interface Request {
      authUser?: User;
    }
  }
}

const getUserFromHeaders = async (request: Request): Promise<User | undefined> => {
  const userId = request.header("x-user-id");
  const email = request.header("x-user-email");

  if (userId) {
    return findUserById(userId);
  }

  if (email) {
    return findUserByEmail(email);
  }

  return undefined;
};

const getBearerToken = (request: Request): string | null => {
  const authHeader = request.header("authorization");
  if (!authHeader) {
    return null;
  }

  const [scheme, token] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
};

const getUserFromSupabaseToken = async (request: Request): Promise<User | undefined> => {
  const token = getBearerToken(request);
  if (!token) {
    return undefined;
  }

  const identity = await resolveSupabaseIdentity(token);
  if (!identity) {
    throw new HttpError(401, "UNAUTHENTICATED", "Invalid Supabase token");
  }

  return findOrCreateUserByEmail(identity.email, {
    playaName: identity.playaName,
  });
};

export const requireAuth = async (request: Request, _response: Response, next: NextFunction): Promise<void> => {
  const supabaseUser = await getUserFromSupabaseToken(request);
  const user = supabaseUser ?? (await getUserFromHeaders(request));

  if (!user || user.isDisabled) {
    throw new HttpError(401, "UNAUTHENTICATED", "Authentication required");
  }

  request.authUser = user;
  next();
};

export const requireRole = (allowedRoles: Role[]) => {
  return (request: Request, _response: Response, next: NextFunction): void => {
    const user = request.authUser;

    if (!user) {
      throw new HttpError(401, "UNAUTHENTICATED", "Authentication required");
    }

    if (!allowedRoles.includes(user.role)) {
      throw new HttpError(403, "FORBIDDEN", "Insufficient permissions");
    }

    next();
  };
};
