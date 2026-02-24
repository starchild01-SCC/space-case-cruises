import { Router } from "express";
import { z } from "zod";
import {
  createBadge,
  createBadgeAssignment,
  findActiveBadgeAssignment,
  findBadgeAssignmentById,
  findBadgeById,
  findCruiseById,
  findUserById,
  listBadgeAssignments,
  listBadges,
  revokeBadgeAssignment,
  updateBadge,
} from "../data/repository.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import type { Badge } from "../types/domain.js";

const badgeCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().nullable().optional(),
    icon_url: z.string().url().nullable().optional(),
    cruise_id: z.string().uuid().nullable().optional(),
  })
  .strict();

const badgePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().nullable().optional(),
    icon_url: z.string().url().nullable().optional(),
    cruise_id: z.string().uuid().nullable().optional(),
  })
  .strict();

const assignmentCreateSchema = z
  .object({
    user_id: z.string().uuid(),
    badge_id: z.string().uuid(),
    reason: z.string().trim().max(400).nullable().optional(),
  })
  .strict();

const idParamSchema = z.object({ id: z.string().uuid() });

const serializeBadge = (badge: Badge) => ({
  id: badge.id,
  name: badge.name,
  description: badge.description,
  icon_url: badge.iconUrl,
  cruise_id: badge.cruiseId,
  created_by: badge.createdBy,
  created_at: badge.createdAt,
  updated_at: badge.updatedAt,
});

export const badgesRouter = Router();

badgesRouter.get("/badges", requireAuth, async (_request, response) => {
  response.json({ items: (await listBadges()).map(serializeBadge) });
});

badgesRouter.post("/admin/badges", requireAuth, requireRole(["admin"]), async (request, response) => {
  const payload = badgeCreateSchema.parse(request.body);

  if (payload.cruise_id) {
    const cruise = await findCruiseById(payload.cruise_id);
    if (!cruise) {
      throw new HttpError(404, "NOT_FOUND", "Cruise not found");
    }
  }

  const created = await createBadge({
    name: payload.name,
    description: payload.description ?? null,
    iconUrl: payload.icon_url ?? null,
    cruiseId: payload.cruise_id ?? null,
    createdBy: request.authUser!.id,
  });

  response.status(201).json(serializeBadge(created));
});

badgesRouter.patch("/admin/badges/:id", requireAuth, requireRole(["admin"]), async (request, response) => {
  const { id } = idParamSchema.parse(request.params);
  const payload = badgePatchSchema.parse(request.body);

  const existing = await findBadgeById(id);
  if (!existing) {
    throw new HttpError(404, "NOT_FOUND", "Badge not found");
  }

  if (payload.cruise_id) {
    const cruise = await findCruiseById(payload.cruise_id);
    if (!cruise) {
      throw new HttpError(404, "NOT_FOUND", "Cruise not found");
    }
  }

  const updated = await updateBadge(id, (current) => ({
    ...current,
    name: payload.name ?? current.name,
    description: payload.description !== undefined ? payload.description : current.description,
    iconUrl: payload.icon_url !== undefined ? payload.icon_url : current.iconUrl,
    cruiseId: payload.cruise_id !== undefined ? payload.cruise_id : current.cruiseId,
  }));

  response.json(serializeBadge(updated!));
});

badgesRouter.post(
  "/admin/badge-assignments",
  requireAuth,
  requireRole(["admin"]),
  async (request, response) => {
    const payload = assignmentCreateSchema.parse(request.body);

    const user = await findUserById(payload.user_id);
    if (!user) {
      throw new HttpError(404, "NOT_FOUND", "Cadet not found");
    }

    const badge = await findBadgeById(payload.badge_id);
    if (!badge) {
      throw new HttpError(404, "NOT_FOUND", "Badge not found");
    }

    if (await findActiveBadgeAssignment(payload.user_id, payload.badge_id)) {
      throw new HttpError(409, "CONFLICT", "Badge already actively assigned to cadet", [
        { field: "badge_id", issue: "already assigned with no revocation" },
      ]);
    }

    const created = await createBadgeAssignment({
      userId: payload.user_id,
      badgeId: payload.badge_id,
      assignedBy: request.authUser!.id,
      reason: payload.reason ?? null,
    });

    response.status(201).json({
      id: created.id,
      user_id: created.userId,
      badge_id: created.badgeId,
      assigned_by: created.assignedBy,
      reason: created.reason,
      assigned_at: created.assignedAt,
      revoked_at: created.revokedAt,
    });
  },
);

badgesRouter.patch(
  "/admin/badge-assignments/:id/revoke",
  requireAuth,
  requireRole(["admin"]),
  async (request, response) => {
    const { id } = idParamSchema.parse(request.params);

    const existing = await findBadgeAssignmentById(id);
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Badge assignment not found");
    }

    const revoked = await revokeBadgeAssignment(id);

    response.json({
      id: revoked!.id,
      user_id: revoked!.userId,
      badge_id: revoked!.badgeId,
      assigned_by: revoked!.assignedBy,
      reason: revoked!.reason,
      assigned_at: revoked!.assignedAt,
      revoked_at: revoked!.revokedAt,
    });
  },
);

badgesRouter.get("/admin/badge-assignments", requireAuth, requireRole(["admin"]), async (_request, response) => {
  response.json({
    items: (await listBadgeAssignments()).map((assignment) => ({
      id: assignment.id,
      user_id: assignment.userId,
      badge_id: assignment.badgeId,
      assigned_by: assignment.assignedBy,
      reason: assignment.reason,
      assigned_at: assignment.assignedAt,
      revoked_at: assignment.revokedAt,
    })),
  });
});
