import { Router } from "express";
import { z } from "zod";
import { createCruise, findCruiseById, listCruises, updateCruise } from "../data/repository.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import type { Cruise } from "../types/domain.js";
import { findClosestUploadFileUrl } from "./uploads.routes.js";

const cruisesQuerySchema = z.object({
  include_archived: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

const cruiseCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    year: z.number().int().min(2000).max(2100),
    location: z.string().trim().max(160).nullable().optional(),
    starts_on: z.string().date().nullable().optional(),
    ends_on: z.string().date().nullable().optional(),
    map_image_url: z.string().url().nullable().optional(),
    special_page_image_url: z.string().url().nullable().optional(),
    is_featured: z.boolean().optional(),
    sort_order: z.number().int().optional(),
    force_all_subgroups_to_dock: z.boolean().optional(),
  })
  .strict();

const cruisePatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    year: z.number().int().min(2000).max(2100).optional(),
    location: z.string().trim().max(160).nullable().optional(),
    starts_on: z.string().date().nullable().optional(),
    ends_on: z.string().date().nullable().optional(),
    map_image_url: z.string().url().nullable().optional(),
    special_page_image_url: z.string().url().nullable().optional(),
    status: z.enum(["active", "archived"]).optional(),
    is_featured: z.boolean().optional(),
    sort_order: z.number().int().optional(),
    force_all_subgroups_to_dock: z.boolean().optional(),
  })
  .strict();

const idParamSchema = z.object({ id: z.string().uuid() });

const assertDateWindowValid = (startsOn: string | null, endsOn: string | null): void => {
  if (!startsOn || !endsOn) {
    return;
  }

  if (new Date(endsOn).getTime() < new Date(startsOn).getTime()) {
    throw new HttpError(422, "VALIDATION_ERROR", "Invalid cruise date range", [
      { field: "ends_on", issue: "must be greater than or equal to starts_on" },
    ]);
  }
};

const serializeCruise = (cruise: Cruise) => {
  const specialFallbackUrl = findClosestUploadFileUrl("cruise-special", cruise.name);

  return {
    id: cruise.id,
    name: cruise.name,
    year: cruise.year,
    location: cruise.location,
    starts_on: cruise.startsOn,
    ends_on: cruise.endsOn,
    map_image_url: cruise.mapImageUrl ?? findClosestUploadFileUrl("cruise-map", cruise.name),
    special_page_image_url: cruise.specialPageImageUrl ?? specialFallbackUrl,
    special_page_image_source: cruise.specialPageImageUrl
      ? "saved"
      : specialFallbackUrl
        ? "fallback"
        : "none",
    status: cruise.status,
    is_featured: cruise.isFeatured,
    sort_order: cruise.sortOrder,
    force_all_subgroups_to_dock: cruise.forceAllSubgroupsToDock,
    created_by: cruise.createdBy,
    created_at: cruise.createdAt,
    updated_at: cruise.updatedAt,
  };
};

export const cruisesRouter = Router();

cruisesRouter.get("/cruises", requireAuth, async (request, response) => {
  const { include_archived } = cruisesQuerySchema.parse(request.query);
  const items = (await listCruises(include_archived ?? false))
    .slice()
    .sort((first, second) => first.sortOrder - second.sortOrder || first.year - second.year)
    .map(serializeCruise);

  response.json({ items });
});

cruisesRouter.post("/admin/cruises", requireAuth, requireRole(["admin"]), async (request, response) => {
  const payload = cruiseCreateSchema.parse(request.body);
  const startsOn = payload.starts_on ?? null;
  const endsOn = payload.ends_on ?? null;
  assertDateWindowValid(startsOn, endsOn);

  const created = await createCruise({
    name: payload.name,
    year: payload.year,
    location: payload.location ?? null,
    startsOn,
    endsOn,
    mapImageUrl: payload.map_image_url ?? null,
    specialPageImageUrl: payload.special_page_image_url ?? null,
    status: "active",
    isFeatured: payload.is_featured ?? false,
    sortOrder: payload.sort_order ?? 0,
    forceAllSubgroupsToDock: payload.force_all_subgroups_to_dock ?? false,
    createdBy: request.authUser!.id,
  });

  response.status(201).json(serializeCruise(created));
});

cruisesRouter.patch("/admin/cruises/:id", requireAuth, requireRole(["admin"]), async (request, response) => {
  const { id } = idParamSchema.parse(request.params);
  const payload = cruisePatchSchema.parse(request.body);

  const existing = await findCruiseById(id);
  if (!existing) {
    throw new HttpError(404, "NOT_FOUND", "Cruise not found");
  }

  const startsOn = payload.starts_on !== undefined ? payload.starts_on : existing.startsOn;
  const endsOn = payload.ends_on !== undefined ? payload.ends_on : existing.endsOn;
  assertDateWindowValid(startsOn, endsOn);

  const updated = await updateCruise(id, (current) => ({
    ...current,
    name: payload.name ?? current.name,
    year: payload.year ?? current.year,
    location: payload.location !== undefined ? payload.location : current.location,
    startsOn,
    endsOn,
    mapImageUrl: payload.map_image_url !== undefined ? payload.map_image_url : current.mapImageUrl,
    specialPageImageUrl:
      payload.special_page_image_url !== undefined
        ? payload.special_page_image_url
        : current.specialPageImageUrl,
    status: payload.status ?? current.status,
    isFeatured: payload.is_featured ?? current.isFeatured,
    sortOrder: payload.sort_order ?? current.sortOrder,
    forceAllSubgroupsToDock:
      payload.force_all_subgroups_to_dock ?? current.forceAllSubgroupsToDock,
  }));

  response.json(serializeCruise(updated!));
});
