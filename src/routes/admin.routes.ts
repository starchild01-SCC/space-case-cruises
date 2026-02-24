import { Router } from "express";
import { z } from "zod";
import { findUserById, updateUser, userHasCadetExtension } from "../data/repository.js";
import { writeBackupSnapshot } from "../data/backup.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";

const adminCadetPatchSchema = z
  .object({
    avatar_url: z.string().url().nullable().optional(),
    phone_number: z.string().trim().min(3).max(40).nullable().optional(),
    preferred_contact: z.enum(["discord", "text", "phone", "email"]).nullable().optional(),
    pronouns: z.enum(["they_them", "he_him", "she_her", "any_all"]).nullable().optional(),
    playa_name: z.string().trim().min(1).max(80).optional(),
    cadet_extension: z.string().trim().min(1).max(20).optional(),
    role: z.enum(["user", "admin"]).optional(),
    is_disabled: z.boolean().optional(),
  })
  .strict();

const idParamSchema = z.object({ id: z.string().uuid() });

export const adminRouter = Router();

adminRouter.post("/admin/backups/snapshot", requireAuth, requireRole(["admin"]), async (_request, response) => {
  await writeBackupSnapshot("admin:manual");
  response.status(202).json({ ok: true });
});

adminRouter.patch("/admin/cadets/:id", requireAuth, requireRole(["admin"]), async (request, response) => {
  const { id } = idParamSchema.parse(request.params);
  const patch = adminCadetPatchSchema.parse(request.body);

  const existing = await findUserById(id);
  if (!existing) {
    throw new HttpError(404, "NOT_FOUND", "Cadet not found");
  }

  if (patch.cadet_extension && (await userHasCadetExtension(patch.cadet_extension, id))) {
    throw new HttpError(409, "CONFLICT", "Cadet extension already assigned", [
      { field: "cadet_extension", issue: "must be unique among users" },
    ]);
  }

  const updated = await updateUser(id, (current) => ({
    ...current,
    avatarUrl: patch.avatar_url !== undefined ? patch.avatar_url : current.avatarUrl,
    phoneNumber: patch.phone_number !== undefined ? patch.phone_number : current.phoneNumber,
    preferredContact:
      patch.preferred_contact !== undefined ? patch.preferred_contact : current.preferredContact,
    pronouns: patch.pronouns !== undefined ? patch.pronouns : current.pronouns,
    playaName: patch.playa_name !== undefined ? patch.playa_name : current.playaName,
    cadetExtension:
      patch.cadet_extension !== undefined ? patch.cadet_extension : current.cadetExtension,
    role: patch.role !== undefined ? patch.role : current.role,
    isDisabled: patch.is_disabled !== undefined ? patch.is_disabled : current.isDisabled,
  }));

  response.json({
    id: updated!.id,
    email: updated!.email,
    avatar_url: updated!.avatarUrl,
    phone_number: updated!.phoneNumber,
    preferred_contact: updated!.preferredContact,
    pronouns: updated!.pronouns,
    playa_name: updated!.playaName,
    cadet_extension: updated!.cadetExtension,
    role: updated!.role,
    is_disabled: updated!.isDisabled,
  });
});
