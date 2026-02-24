import { Router } from "express";
import { z } from "zod";
import {
  findCruiseSubgroupById,
  findSubgroupById,
  findUserById,
  listCommitmentsForCruiseSubgroup,
  transitionCommitment,
} from "../data/repository.js";
import { requireAuth } from "../middleware/auth.js";
import { HttpError } from "../middleware/errors.js";

const cruiseSubgroupIdParamSchema = z.object({
  id: z.string().uuid(),
});

const subgroupDetailQuerySchema = z.object({
  include_committed_cadets: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

const commitmentToggleSchema = z
  .object({
    cruise_subgroup_id: z.string().uuid(),
    action: z.enum(["commit", "withdraw", "recommit"]),
  })
  .strict();

export const commitmentsRouter = Router();

commitmentsRouter.get("/cruise-subgroups/:id", requireAuth, async (request, response) => {
  const { id } = cruiseSubgroupIdParamSchema.parse(request.params);
  const { include_committed_cadets } = subgroupDetailQuerySchema.parse(request.query);

  const assignment = await findCruiseSubgroupById(id);
  if (!assignment) {
    throw new HttpError(404, "NOT_FOUND", "Cruise subgroup not found");
  }

  const subgroup = await findSubgroupById(assignment.subgroupId);
  if (!subgroup) {
    throw new HttpError(404, "NOT_FOUND", "Subgroup not found");
  }

  const committed = await listCommitmentsForCruiseSubgroup(id, ["committed"]);
  const committedCadets = include_committed_cadets
    ? await Promise.all(
        committed.map(async (entry) => {
          const user = await findUserById(entry.userId);
          if (!user) {
            return null;
          }

          return {
            id: user.id,
            playa_name: user.playaName,
            pronouns: user.pronouns,
            cadet_extension: user.cadetExtension,
            preferred_contact: user.preferredContact,
            phone_number: user.phoneNumber,
          };
        }),
      )
    : undefined;

  response.json({
    id: assignment.id,
    cruise_id: assignment.cruiseId,
    subgroup_id: assignment.subgroupId,
    name: assignment.overrideName ?? subgroup.name,
    description: assignment.overrideDescription ?? subgroup.defaultDescription,
    detail_image_url: assignment.detailImageUrl,
    extension: subgroup.extension,
    cost_level: assignment.costLevelOverride ?? subgroup.defaultCostLevel,
    commitment_count: committed.length,
    committed_cadets: committedCadets?.filter((entry) => entry !== null),
  });
});

commitmentsRouter.post("/commitments/toggle", requireAuth, async (request, response) => {
  const payload = commitmentToggleSchema.parse(request.body);

  const result = await transitionCommitment(
    request.authUser!.id,
    payload.cruise_subgroup_id,
    payload.action,
  );

  if (result.errorCode === "NOT_FOUND") {
    throw new HttpError(404, "NOT_FOUND", "Cruise subgroup not found");
  }

  if (result.errorCode === "CONFLICT") {
    throw new HttpError(409, "CONFLICT", "Completed commitments are read-only");
  }

  if (result.errorCode === "INVALID_TRANSITION") {
    throw new HttpError(409, "CONFLICT", "Invalid commitment transition", [
      { field: "action", issue: "action is not allowed for current commitment state" },
    ]);
  }

  const commitment = result.commitment!;

  response.json({
    commitment: {
      id: commitment.id,
      user_id: commitment.userId,
      cruise_subgroup_id: commitment.cruiseSubgroupId,
      status: commitment.status,
      committed_at: commitment.committedAt,
      withdrawn_at: commitment.withdrawnAt,
      completed_at: commitment.completedAt,
      updated_at: commitment.updatedAt,
    },
  });
});
