import { Router } from "express";
import { z } from "zod";
import {
  createSubgroup,
  findSubgroupById,
  listSubgroups,
  subgroupCodeExists,
  subgroupSlugExists,
  updateSubgroup,
} from "../data/repository.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import type { Subgroup } from "../types/domain.js";
import { findClosestUploadFileUrl } from "./uploads.routes.js";
import { normalizeMediaUrl } from "./media-url.js";
import type { Request } from "express";

const subgroupCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]+$/),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_]+$/),
    default_description: z.string().trim().optional().nullable(),
    default_tile_image_url: z.string().optional().nullable(),
    extension: z.string().trim().min(1).max(20).optional().nullable(),
    default_cost_level: z.number().int().min(0).max(8),
  })
  .passthrough();

const subgroupPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]+$/)
      .optional(),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_]+$/)
      .optional(),
    default_description: z.string().trim().optional().nullable(),
    default_tile_image_url: z.string().optional().nullable(),
    extension: z.string().trim().min(1).max(20).optional().nullable(),
    default_cost_level: z.number().int().min(0).max(8).optional(),
  })
  .passthrough();

const idParamSchema = z.object({ id: z.string().uuid() });

const serializeSubgroup = (request: Request, subgroup: Subgroup) => ({
  id: subgroup.id,
  name: subgroup.name,
  slug: subgroup.slug,
  code: subgroup.code,
  default_description: subgroup.defaultDescription,
  default_tile_image_url: normalizeMediaUrl(
    request,
    subgroup.defaultTileImageUrl ?? findClosestUploadFileUrl("subgroup-tile", subgroup.name),
  ),
  extension: subgroup.extension,
  default_cost_level: subgroup.defaultCostLevel,
  created_at: subgroup.createdAt,
  updated_at: subgroup.updatedAt,
});

export const subgroupsRouter = Router();

// Public browse endpoint (unregistered users can view subgroups).
subgroupsRouter.get("/subgroups", async (request, response) => {
  response.json({ items: (await listSubgroups()).map((subgroup) => serializeSubgroup(request, subgroup)) });
});

subgroupsRouter.post("/admin/subgroups", requireAuth, requireRole(["admin"]), async (request, response) => {
  console.log("[DEBUG] POST /admin/subgroups - Request body:", JSON.stringify(request.body, null, 2));
  const payload = subgroupCreateSchema.parse(request.body);

  if (await subgroupSlugExists(payload.slug)) {
    throw new HttpError(409, "CONFLICT", "Subgroup slug already exists", [
      { field: "slug", issue: "must be unique" },
    ]);
  }

  if (await subgroupCodeExists(payload.code)) {
    throw new HttpError(409, "CONFLICT", "Subgroup code already exists", [
      { field: "code", issue: "must be unique" },
    ]);
  }

  const created = await createSubgroup({
    name: payload.name,
    slug: payload.slug,
    code: payload.code,
    defaultDescription: payload.default_description ?? null,
    defaultTileImageUrl: payload.default_tile_image_url ?? null,
    extension: payload.extension ?? null,
    defaultCostLevel: payload.default_cost_level,
  });

  response.status(201).json(serializeSubgroup(request, created));
});

subgroupsRouter.patch(
  "/admin/subgroups/:id",
  requireAuth,
  requireRole(["admin"]),
  async (request, response) => {
    const { id } = idParamSchema.parse(request.params);
    console.log("[DEBUG] PATCH /admin/subgroups/:id - Request body:", JSON.stringify(request.body, null, 2));
    const payload = subgroupPatchSchema.parse(request.body);

    const existing = await findSubgroupById(id);
    if (!existing) {
      throw new HttpError(404, "NOT_FOUND", "Subgroup not found");
    }

    if (payload.slug && (await subgroupSlugExists(payload.slug, id))) {
      throw new HttpError(409, "CONFLICT", "Subgroup slug already exists", [
        { field: "slug", issue: "must be unique" },
      ]);
    }

    if (payload.code && (await subgroupCodeExists(payload.code, id))) {
      throw new HttpError(409, "CONFLICT", "Subgroup code already exists", [
        { field: "code", issue: "must be unique" },
      ]);
    }

    const updated = await updateSubgroup(id, (current) => ({
      ...current,
      name: payload.name ?? current.name,
      slug: payload.slug ?? current.slug,
      code: payload.code ?? current.code,
      defaultDescription:
        payload.default_description !== undefined ? payload.default_description : current.defaultDescription,
      defaultTileImageUrl:
        payload.default_tile_image_url !== undefined
          ? payload.default_tile_image_url
          : current.defaultTileImageUrl,
      extension: payload.extension !== undefined ? payload.extension : current.extension,
      defaultCostLevel: payload.default_cost_level ?? current.defaultCostLevel,
    }));

    response.json(serializeSubgroup(request, updated!));
  },
);
