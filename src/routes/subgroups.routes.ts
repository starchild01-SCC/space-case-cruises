import { Router } from "express";
import { z } from "zod";
import {
  createSubgroup,
  findSubgroupById,
  listSubgroups,
  subgroupCodeExists,
  subgroupExtensionExists,
  subgroupSlugExists,
  updateSubgroup,
} from "../data/repository.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";
import type { Subgroup } from "../types/domain.js";
import { findClosestUploadFileUrl } from "./uploads.routes.js";

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
    default_description: z.string().trim().nullable().optional(),
    default_tile_image_url: z.string().url().nullable().optional(),
    extension: z.string().trim().min(1).max(20).nullable().optional(),
    default_cost_level: z.number().int().min(0).max(8),
  })
  .strict();

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
    default_description: z.string().trim().nullable().optional(),
    default_tile_image_url: z.string().url().nullable().optional(),
    extension: z.string().trim().min(1).max(20).nullable().optional(),
    default_cost_level: z.number().int().min(0).max(8).optional(),
  })
  .strict();

const idParamSchema = z.object({ id: z.string().uuid() });

const serializeSubgroup = (subgroup: Subgroup) => ({
  id: subgroup.id,
  name: subgroup.name,
  slug: subgroup.slug,
  code: subgroup.code,
  default_description: subgroup.defaultDescription,
  default_tile_image_url:
    subgroup.defaultTileImageUrl ?? findClosestUploadFileUrl("subgroup-tile", subgroup.name),
  extension: subgroup.extension,
  default_cost_level: subgroup.defaultCostLevel,
  created_at: subgroup.createdAt,
  updated_at: subgroup.updatedAt,
});

export const subgroupsRouter = Router();

subgroupsRouter.get("/subgroups", requireAuth, async (_request, response) => {
  response.json({ items: (await listSubgroups()).map(serializeSubgroup) });
});

subgroupsRouter.post("/admin/subgroups", requireAuth, requireRole(["admin"]), async (request, response) => {
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

  if (payload.extension && (await subgroupExtensionExists(payload.extension))) {
    throw new HttpError(409, "CONFLICT", "Subgroup extension already exists", [
      { field: "extension", issue: "must be unique among subgroups" },
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

  response.status(201).json(serializeSubgroup(created));
});

subgroupsRouter.patch(
  "/admin/subgroups/:id",
  requireAuth,
  requireRole(["admin"]),
  async (request, response) => {
    const { id } = idParamSchema.parse(request.params);
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

    if (payload.extension && (await subgroupExtensionExists(payload.extension, id))) {
      throw new HttpError(409, "CONFLICT", "Subgroup extension already exists", [
        { field: "extension", issue: "must be unique among subgroups" },
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

    response.json(serializeSubgroup(updated!));
  },
);
