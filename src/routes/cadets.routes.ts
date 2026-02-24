import { Router } from "express";
import { z } from "zod";
import { findCruiseById, findUserById, getUserBadges, getUserCommitments } from "../data/repository.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";

const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const cadetsRouter = Router();

cadetsRouter.get("/cadets/:id", requireAuth, async (request, response) => {
  const { id } = idParamSchema.parse(request.params);
  const cadet = await findUserById(id);

  if (!cadet) {
    throw new HttpError(404, "NOT_FOUND", "Cadet not found");
  }

  const badges = await getUserBadges(cadet.id);
  const grouped = new Map<string, { cruise: { id: string; name: string; year: number; status: "active" | "archived" }; items: Array<Record<string, unknown>> }>();

  const commitments = await getUserCommitments(cadet.id);
  for (const commitment of commitments) {
    if (commitment.status === "withdrawn") {
      continue;
    }

    const key = commitment.cruiseId;
    if (!grouped.has(key)) {
      const cruise = await findCruiseById(commitment.cruiseId);
      grouped.set(key, {
        cruise: {
          id: commitment.cruiseId,
          name: commitment.cruiseName,
          year: commitment.cruiseYear,
          status: cruise?.status ?? "active",
        },
        items: [],
      });
    }

    grouped.get(key)!.items.push({
      cruise_subgroup_id: commitment.cruiseSubgroupId,
      subgroup: {
        id: commitment.subgroupId,
        name: commitment.subgroupName,
        extension: commitment.subgroupExtension,
      },
      status: commitment.status,
    });
  }

  response.json({
    cadet: {
      id: cadet.id,
      avatar_url: cadet.avatarUrl,
      playa_name: cadet.playaName,
      pronouns: cadet.pronouns,
      cadet_extension: cadet.cadetExtension,
      preferred_contact: cadet.preferredContact,
      phone_number: cadet.phoneNumber,
    },
    badges: badges.map((badge) => ({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      icon_url: badge.iconUrl,
      cruise_id: badge.cruiseId,
    })),
    commitments_by_cruise: Array.from(grouped.values()),
  });
});
