import { Router } from "express";
import { getAuthMode } from "../auth/supabase.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.get("/mode", (_request, response) => {
  response.json({
    mode: getAuthMode(),
  });
});

authRouter.get("/session", requireAuth, (request, response) => {
  const user = request.authUser!;

  response.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  });
});
