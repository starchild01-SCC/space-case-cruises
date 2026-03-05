import { Router } from "express";
import { z } from "zod";
import { updateUser } from "../data/repository.js";
import { requireAuth } from "../middleware/auth.js";
import { normalizeMediaUrl } from "./media-url.js";

const profilePatchSchema = z
  .object({
    avatar_url: z.string().url().nullable().optional(),
    phone_number: z.string().trim().min(3).max(40).nullable().optional(),
    preferred_contact: z.enum(["discord", "text", "phone", "email"]).nullable().optional(),
    pronouns: z.enum(["they_them", "he_him", "she_her", "any_all"]).nullable().optional(),
    playa_name: z.string().trim().min(1).max(80).optional(),
  })
  .strict();

export const profileRouter = Router();

profileRouter.get("/profile", requireAuth, (request, response) => {
  const user = request.authUser!;

  response.json({
    id: user.id,
    email: user.email,
    avatar_url: normalizeMediaUrl(request, user.avatarUrl),
    phone_number: user.phoneNumber,
    preferred_contact: user.preferredContact,
    pronouns: user.pronouns,
    playa_name: user.playaName,
    role: user.role,
    cadet_extension: user.cadetExtension,
  });
});

profileRouter.patch("/profile", requireAuth, async (request, response) => {
  const patch = profilePatchSchema.parse(request.body);
  const userId = request.authUser!.id;

  const updated = await updateUser(userId, (existing) => ({
    ...existing,
    avatarUrl: patch.avatar_url !== undefined ? patch.avatar_url : existing.avatarUrl,
    phoneNumber: patch.phone_number !== undefined ? patch.phone_number : existing.phoneNumber,
    preferredContact:
      patch.preferred_contact !== undefined ? patch.preferred_contact : existing.preferredContact,
    pronouns: patch.pronouns !== undefined ? patch.pronouns : existing.pronouns,
    playaName: patch.playa_name !== undefined ? patch.playa_name : existing.playaName,
  }));

  response.json({
    id: updated!.id,
    email: updated!.email,
    avatar_url: normalizeMediaUrl(request, updated!.avatarUrl),
    phone_number: updated!.phoneNumber,
    preferred_contact: updated!.preferredContact,
    pronouns: updated!.pronouns,
    playa_name: updated!.playaName,
    role: updated!.role,
    cadet_extension: updated!.cadetExtension,
  });
});
