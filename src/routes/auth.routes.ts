import { Router } from "express";
import { getAuthMode as getSupabaseAuthMode } from "../auth/supabase.js";
import { getAuthMode as getFirebaseAuthMode } from "../auth/firebase.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.get("/mode", (_request, response) => {
  // Prioritize Firebase, then Supabase, then header-sim
  const mode = getFirebaseAuthMode();
  response.json({
    mode,
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
