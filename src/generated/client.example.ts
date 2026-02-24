import { createApiClient } from "./client.js";

interface CruisesResponse {
  items?: Array<{ id?: string }>;
}

interface AssignmentsResponse {
  items?: Array<{ id?: string }>;
}

interface CommitmentToggleResponse {
  commitment?: { status?: string };
}

interface MapBatchResponse {
  updated_count?: number;
}

const baseUrl = process.env.API_BASE_URL ?? "http://localhost:4000";

const adminClient = createApiClient({
  baseUrl,
  headers: {
    "x-user-email": "admin@spacecase.local",
  },
});

const cadetClient = createApiClient({
  baseUrl,
  headers: {
    "x-user-email": "cadet@spacecase.local",
  },
});

const run = async (): Promise<void> => {
  const health = await fetch(`${baseUrl}/health`).then((response) => response.json());
  console.log("Health:", health);

  const session = await adminClient.getSession();
  console.log("Admin session:", session);

  const cruises = (await adminClient.getCruises()) as CruisesResponse;
  const firstCruiseId = cruises.items?.[0]?.id;
  if (!firstCruiseId) {
    throw new Error("No cruises found. Seed data and retry.");
  }

  const assignments = (await adminClient.request({
    path: "/api/v1/cruises/{cruiseId}/subgroups",
    method: "get",
    pathParams: { cruiseId: firstCruiseId },
  })) as AssignmentsResponse;

  const firstCruiseSubgroupId = assignments.items?.[0]?.id;
  if (!firstCruiseSubgroupId) {
    throw new Error("No cruise subgroups found. Seed data and retry.");
  }

  const toggleResult = (await cadetClient.toggleCommitment({
    cruise_subgroup_id: firstCruiseSubgroupId,
    action: "withdraw",
  })) as CommitmentToggleResponse;
  console.log("Commitment status:", toggleResult.commitment?.status);

  const mapBatchResult = (await adminClient.patchCruiseMapBatch(firstCruiseId, {
    items: [
      {
        cruise_subgroup_id: firstCruiseSubgroupId,
        visibility_state: "inactive",
        dock_visible: true,
        map_x: null,
        map_y: null,
        map_scale: 1,
      },
    ],
  })) as MapBatchResponse;
  console.log("Map batch updated:", mapBatchResult.updated_count);
};

void run();
