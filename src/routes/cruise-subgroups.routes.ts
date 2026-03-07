import { Router } from "express";
import { z } from "zod";
import {
  createCruiseSubgroup,
  cruiseSubgroupPairExists,
  deleteCruiseSubgroup,
  findCruiseById,
  findCruiseSubgroupById,
  findCruiseSubgroupBySubgroupId,
  findSubgroupById,
  listCruiseSubgroups,
  updateCruiseSubgroup,
} from "../data/repository.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import { findClosestUploadFileUrl } from "./uploads.routes.js";
import { normalizeMediaUrl } from "./media-url.js";
import type { Request } from "express";

const cruiseIdParamSchema = z.object({ cruiseId: z.string().uuid() });
const assignmentIdParamSchema = z.object({ id: z.string().uuid() });

const assignmentCreateSchema = z
  .object({
    subgroup_id: z.string().uuid(),
    override_name: z.string().trim().min(1).max(120).optional().nullable(),
    override_description: z.string().trim().optional().nullable(),
    detail_image_url: z.string().optional().nullable(),
    cost_level_override: z.number().int().min(0).max(8).optional().nullable(),
    visibility_state: z.enum(["invisible", "inactive", "active"]).optional(),
    dock_visible: z.boolean().optional(),
    map_x: z.number().min(0).max(100).optional().nullable(),
    map_y: z.number().min(0).max(100).optional().nullable(),
    map_scale: z.number().positive().optional().nullable(),
  })
  .passthrough();

const assignmentPatchSchema = z
  .object({
    cruise_id: z.string().uuid().optional(),
    override_name: z.string().trim().min(1).max(120).optional().nullable(),
    override_description: z.string().trim().optional().nullable(),
    detail_image_url: z.string().optional().nullable(),
    cost_level_override: z.number().int().min(0).max(8).optional().nullable(),
    visibility_state: z.enum(["invisible", "inactive", "active"]).optional(),
    dock_visible: z.boolean().optional(),
    map_x: z.number().min(0).max(100).optional().nullable(),
    map_y: z.number().min(0).max(100).optional().nullable(),
    map_scale: z.number().positive().optional().nullable(),
  })
  .passthrough();

const resolveDescription = (overrideDescription: string | null, defaultDescription: string | null): string | null => {
  const override = overrideDescription?.trim();
  return override || defaultDescription?.trim() || null;
};

const resolveName = (overrideName: string | null, defaultName: string | null): string | null => {
  const override = overrideName?.trim();
  return override || defaultName?.trim() || null;
};

const serializeAssignment = async (request: Request, assignment: Awaited<ReturnType<typeof listCruiseSubgroups>>[number]) => {
  const subgroup = await findSubgroupById(assignment.subgroupId);
  const resolvedName = resolveName(assignment.overrideName, subgroup?.name ?? null);
  const fallbackPoster = findClosestUploadFileUrl("subgroup-poster", resolvedName);
  const fallbackTile = subgroup ? findClosestUploadFileUrl("subgroup-tile", subgroup.name) : null;

  return {
    id: assignment.id,
    cruise_id: assignment.cruiseId,
    subgroup_id: assignment.subgroupId,
    subgroup: subgroup ? {
          id: subgroup.id,
          name: subgroup.name,
          slug: subgroup.slug,
          code: subgroup.code,
          default_description: subgroup.defaultDescription,
          default_tile_image_url: normalizeMediaUrl(request, subgroup.defaultTileImageUrl ?? fallbackTile),
          extension: subgroup.extension,
          default_cost_level: subgroup.defaultCostLevel,
        } : null,
    override_name: assignment.overrideName,
    override_description: assignment.overrideDescription,
    detail_image_url: normalizeMediaUrl(request, assignment.detailImageUrl ?? fallbackPoster),
    cost_level_override: assignment.costLevelOverride,
    visibility_state: assignment.visibilityState,
    dock_visible: assignment.dockVisible,
    map_x: assignment.mapX,
    map_y: assignment.mapY,
    map_scale: assignment.mapScale,
    effective_name: resolveName(assignment.overrideName, subgroup?.name ?? null),
    effective_description: resolveDescription(assignment.overrideDescription, subgroup?.defaultDescription ?? null),
    effective_cost_level: assignment.costLevelOverride ?? subgroup?.defaultCostLevel ?? null,
    created_at: assignment.createdAt,
    updated_at: assignment.updatedAt,
  };
};

const assertCruisePlacementAllowed = (forceAllSubgroupsToDock: boolean, visibilityState: "invisible" | "inactive" | "active", mapX: number | null, mapY: number | null): void => {
  if (forceAllSubgroupsToDock && (visibilityState === "active" || mapX !== null || mapY !== null)) {
    throw new HttpError(409, "CONFLICT", "Cruise is configured to force all subgroups to dock", [
      { field: "visibility_state", issue: "active placement is not allowed for this cruise" },
    ]);
  }
};

export const cruiseSubgroupsRouter = Router();

cruiseSubgroupsRouter.get("/cruises/:cruiseId/subgroups", async (request, response) => {
  const { cruiseId } = cruiseIdParamSchema.parse(request.params);
  if (!(await findCruiseById(cruiseId))) throw new HttpError(404, "NOT_FOUND", "Cruise not found");

  response.json({
    items: await Promise.all(
      (await listCruiseSubgroups(cruiseId)).map((assignment) => serializeAssignment(request, assignment)),
    ),
  });
});

cruiseSubgroupsRouter.post("/admin/cruises/:cruiseId/subgroups", requireAuth, requireRole(["admin"]), async (request, response) => {
  const { cruiseId } = cruiseIdParamSchema.parse(request.params);
  const payload = assignmentCreateSchema.parse(request.body);

  const cruise = await findCruiseById(cruiseId);
  const subgroup = await findSubgroupById(payload.subgroup_id);
  if (!cruise || !subgroup) throw new HttpError(404, "NOT_FOUND", "Cruise or Subgroup not found");

  if (await cruiseSubgroupPairExists(cruiseId, payload.subgroup_id)) {
    throw new HttpError(409, "CONFLICT", "Subgroup already assigned to cruise", [{ field: "subgroup_id", issue: "must be unique per cruise" }]);
  }

  const visibilityState = payload.visibility_state ?? "inactive";
  assertCruisePlacementAllowed(cruise.forceAllSubgroupsToDock, visibilityState, payload.map_x ?? null, payload.map_y ?? null);

  const existingOnOtherCruise = await findCruiseSubgroupBySubgroupId(payload.subgroup_id);
  if (existingOnOtherCruise && existingOnOtherCruise.cruiseId !== cruiseId) {
    const updated = await updateCruiseSubgroup(existingOnOtherCruise.id, (current) => ({
      ...current,
      cruiseId,
      overrideName: payload.override_name ?? null,
      overrideDescription: payload.override_description ?? null,
      detailImageUrl: payload.detail_image_url ?? null,
      costLevelOverride: payload.cost_level_override ?? null,
      visibilityState,
      dockVisible: payload.dock_visible ?? visibilityState !== "active",
      mapX: payload.map_x ?? null,
      mapY: payload.map_y ?? null,
      mapScale: payload.map_scale ?? 1,
    }));
    if (!updated) throw new HttpError(500, "INTERNAL", "Failed to update record");
    return response.json(await serializeAssignment(request, updated));
  }

  const created = await createCruiseSubgroup({
    cruiseId,
    subgroupId: payload.subgroup_id,
    overrideName: payload.override_name ?? null,
    overrideDescription: payload.override_description ?? null,
    detailImageUrl: payload.detail_image_url ?? null,
    costLevelOverride: payload.cost_level_override ?? null,
    visibilityState,
    dockVisible: payload.dock_visible ?? visibilityState !== "active",
    mapX: payload.map_x ?? null,
    mapY: payload.map_y ?? null,
    mapScale: payload.map_scale ?? 1,
  });

  response.status(201).json(await serializeAssignment(request, created));
});

cruiseSubgroupsRouter.patch("/admin/cruise-subgroups/:id", requireAuth, requireRole(["admin"]), async (request, response) => {
  const { id } = assignmentIdParamSchema.parse(request.params);
  const payload = assignmentPatchSchema.parse(request.body);

  const existing = await findCruiseSubgroupById(id);
  if (!existing) throw new HttpError(404, "NOT_FOUND", "Cruise subgroup not found");

  let cruise = await findCruiseById(existing.cruiseId);
  if (!cruise) throw new HttpError(404, "NOT_FOUND", "Cruise not found");

  const nextCruiseId = payload.cruise_id ?? existing.cruiseId;
  if (nextCruiseId !== existing.cruiseId) {
    const newCruise = await findCruiseById(nextCruiseId);
    if (!newCruise) throw new HttpError(404, "NOT_FOUND", "Target cruise not found");
    if (await cruiseSubgroupPairExists(nextCruiseId, existing.subgroupId)) {
      throw new HttpError(409, "CONFLICT", "Subgroup already assigned to target cruise", [{ field: "cruise_id", issue: "subgroup is already on this cruise" }]);
    }
    cruise = newCruise;
  }

  const visibilityState = payload.visibility_state ?? existing.visibilityState;
  assertCruisePlacementAllowed(cruise.forceAllSubgroupsToDock, visibilityState, payload.map_x ?? existing.mapX, payload.map_y ?? existing.mapY);

  const updated = await updateCruiseSubgroup(id, (current) => ({
    ...current,
    cruiseId: nextCruiseId,
    overrideName: payload.override_name ?? current.overrideName,
    overrideDescription: payload.override_description ?? current.overrideDescription,
    detailImageUrl: payload.detail_image_url ?? current.detailImageUrl,
    costLevelOverride: payload.cost_level_override ?? current.costLevelOverride,
    visibilityState,
    dockVisible: payload.dock_visible ?? current.dockVisible,
    mapX: payload.map_x ?? current.mapX,
    mapY: payload.map_y ?? current.mapY,
    mapScale: payload.map_scale ?? current.mapScale,
  }));

  // Fix: Guard clause to satisfy TypeScript and handle potential DB failures
  if (!updated) {
    throw new HttpError(500, "INTERNAL", "Failed to update record");
  }

  response.json(await serializeAssignment(request, updated));
});

cruiseSubgroupsRouter.delete("/admin/cruise-subgroups/:id", requireAuth, requireRole(["admin"]), async (request, response) => {
  const { id } = assignmentIdParamSchema.parse(request.params);
  if (!(await deleteCruiseSubgroup(id))) throw new HttpError(404, "NOT_FOUND", "Cruise subgroup not found");
  response.status(204).send();
});