import { Router } from "express";
import { z } from "zod";
import { applyCruiseMapBatchUpdates, findCruiseById, findCruiseSubgroupById } from "../data/repository.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";

const cruiseIdParamSchema = z.object({ cruiseId: z.string().uuid() });

const mapBatchSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            cruise_subgroup_id: z.string().uuid(),
            visibility_state: z.enum(["invisible", "inactive", "active"]).optional(),
            dock_visible: z.boolean().optional(),
            map_x: z.number().min(0).max(100).nullable().optional(),
            map_y: z.number().min(0).max(100).nullable().optional(),
            map_scale: z.number().positive().optional(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

interface PlannedMapUpdate {
  cruiseSubgroupId: string;
  visibilityState: "invisible" | "inactive" | "active";
  dockVisible: boolean;
  mapX: number | null;
  mapY: number | null;
  mapScale: number;
}

const assertCoordinatePair = (
  mapX: number | null | undefined,
  mapY: number | null | undefined,
  index: number,
): void => {
  const hasMapX = mapX !== undefined;
  const hasMapY = mapY !== undefined;

  if (hasMapX !== hasMapY) {
    throw new HttpError(422, "VALIDATION_ERROR", "Map coordinates must be provided as a pair", [
      {
        field: `items.${index}`,
        issue: "map_x and map_y must both be provided when updating coordinates",
      },
    ]);
  }
};

export const mapRouter = Router();

mapRouter.patch(
  "/admin/cruises/:cruiseId/map/batch",
  requireAuth,
  requireRole(["admin"]),
  async (request, response) => {
    const { cruiseId } = cruiseIdParamSchema.parse(request.params);
    const payload = mapBatchSchema.parse(request.body);

    const cruise = await findCruiseById(cruiseId);
    if (!cruise) {
      throw new HttpError(404, "NOT_FOUND", "Cruise not found");
    }

    const planned: PlannedMapUpdate[] = [];
    for (const [index, item] of payload.items.entries()) {
      assertCoordinatePair(item.map_x, item.map_y, index);

      const existing = await findCruiseSubgroupById(item.cruise_subgroup_id);
      if (!existing || existing.cruiseId !== cruiseId) {
        throw new HttpError(404, "NOT_FOUND", "Cruise subgroup not found for this cruise", [
          { field: `items.${index}.cruise_subgroup_id`, issue: "invalid cruise subgroup for cruise" },
        ]);
      }

      let visibilityState = item.visibility_state ?? existing.visibilityState;
      let dockVisible = item.dock_visible ?? existing.dockVisible;
      let mapX = item.map_x !== undefined ? item.map_x : existing.mapX;
      let mapY = item.map_y !== undefined ? item.map_y : existing.mapY;
      const mapScale = item.map_scale ?? existing.mapScale;

      if (visibilityState === "active") {
        dockVisible = false;
      }

      if (visibilityState === "inactive") {
        dockVisible = item.dock_visible ?? true;
        mapX = null;
        mapY = null;
      }

      if (visibilityState === "invisible") {
        dockVisible = false;
        mapX = null;
        mapY = null;
      }

      if (cruise.forceAllSubgroupsToDock && (visibilityState === "active" || mapX !== null || mapY !== null)) {
        throw new HttpError(
          409,
          "CONFLICT",
          "Cruise is configured to force all subgroups to dock",
          [
            {
              field: `items.${index}`,
              issue: "active placement and map coordinates are not allowed for this cruise",
            },
          ],
        );
      }

      planned.push({
        cruiseSubgroupId: existing.id,
        visibilityState,
        dockVisible,
        mapX,
        mapY,
        mapScale,
      });
    }

    let updated;
    try {
      updated = await applyCruiseMapBatchUpdates(cruiseId, planned);
    } catch (error) {
      throw new HttpError(404, "NOT_FOUND", (error as Error).message);
    }

    const updatedItems = updated.map((entry) => ({
        id: entry.id,
        cruise_id: entry.cruiseId,
        subgroup_id: entry.subgroupId,
        visibility_state: entry.visibilityState,
        dock_visible: entry.dockVisible,
        map_x: entry.mapX,
        map_y: entry.mapY,
        map_scale: entry.mapScale,
        updated_at: entry.updatedAt,
      }));

    response.json({
      cruise_id: cruiseId,
      updated_count: updatedItems.length,
      items: updatedItems,
    });
  },
);
