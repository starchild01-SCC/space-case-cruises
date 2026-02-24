import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "./app.js";

interface CadreItem {
  id: string;
  role: "user" | "admin";
}

describe("Space Case Cruises API smoke", () => {
  it("returns 401 when unauthenticated", async () => {
    const response = await request(app).get("/api/v1/profile");
    expect(response.status).toBe(401);
  });

  it("supports admin cadre update flow", async () => {
    const cadreResponse = await request(app)
      .get("/api/v1/cadre")
      .set("x-user-email", "admin@spacecase.local");

    expect(cadreResponse.status).toBe(200);
    const items = cadreResponse.body.items as CadreItem[];
    const target = items.find((item) => item.role === "user");

    expect(target).toBeDefined();
    if (!target) {
      throw new Error("Missing user cadet in seed data");
    }

    const updateResponse = await request(app)
      .patch(`/api/v1/admin/cadets/${target.id}`)
      .set("x-user-email", "admin@spacecase.local")
      .send({ role: "user", is_disabled: false });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.role).toBe("user");
  });

  it("supports commitment withdraw and recommit", async () => {
    const cruisesResponse = await request(app)
      .get("/api/v1/cruises")
      .set("x-user-email", "cadet@spacecase.local");

    expect(cruisesResponse.status).toBe(200);
    const cruiseId = cruisesResponse.body.items[0]?.id as string;

    const assignmentsResponse = await request(app)
      .get(`/api/v1/cruises/${cruiseId}/subgroups`)
      .set("x-user-email", "cadet@spacecase.local");

    expect(assignmentsResponse.status).toBe(200);
    const cruiseSubgroupId = assignmentsResponse.body.items[0]?.id as string;

    const withdrawResponse = await request(app)
      .post("/api/v1/commitments/toggle")
      .set("x-user-email", "cadet@spacecase.local")
      .send({ cruise_subgroup_id: cruiseSubgroupId, action: "withdraw" });

    expect(withdrawResponse.status).toBe(200);
    expect(withdrawResponse.body.commitment.status).toBe("withdrawn");

    const recommitResponse = await request(app)
      .post("/api/v1/commitments/toggle")
      .set("x-user-email", "cadet@spacecase.local")
      .send({ cruise_subgroup_id: cruiseSubgroupId, action: "recommit" });

    expect(recommitResponse.status).toBe(200);
    expect(recommitResponse.body.commitment.status).toBe("committed");
  });

  it("enforces force_all_subgroups_to_dock in map batch", async () => {
    const cruisesResponse = await request(app)
      .get("/api/v1/cruises")
      .set("x-user-email", "admin@spacecase.local");

    const cruiseId = cruisesResponse.body.items[0]?.id as string;

    const patchCruiseResponse = await request(app)
      .patch(`/api/v1/admin/cruises/${cruiseId}`)
      .set("x-user-email", "admin@spacecase.local")
      .send({ force_all_subgroups_to_dock: true });

    expect(patchCruiseResponse.status).toBe(200);

    const assignmentsResponse = await request(app)
      .get(`/api/v1/cruises/${cruiseId}/subgroups`)
      .set("x-user-email", "admin@spacecase.local");

    const cruiseSubgroupId = assignmentsResponse.body.items[0]?.id as string;

    const batchResponse = await request(app)
      .patch(`/api/v1/admin/cruises/${cruiseId}/map/batch`)
      .set("x-user-email", "admin@spacecase.local")
      .send({
        items: [
          {
            cruise_subgroup_id: cruiseSubgroupId,
            visibility_state: "active",
            map_x: 50,
            map_y: 50,
            map_scale: 1.2,
          },
        ],
      });

    expect(batchResponse.status).toBe(409);
  });

  it("supports badge create, assign, and revoke", async () => {
    const createBadgeResponse = await request(app)
      .post("/api/v1/admin/badges")
      .set("x-user-email", "admin@spacecase.local")
      .send({
        name: "Deck Lead",
        description: "Leadership on deck",
        icon_url: null,
        cruise_id: null,
      });

    expect(createBadgeResponse.status).toBe(201);
    const badgeId = createBadgeResponse.body.id as string;

    const cadreResponse = await request(app)
      .get("/api/v1/cadre")
      .set("x-user-email", "admin@spacecase.local");

    const items = cadreResponse.body.items as CadreItem[];
    const userId = items.find((item) => item.role === "user")?.id;
    if (!userId) {
      throw new Error("Missing user cadet in seed data");
    }

    const assignResponse = await request(app)
      .post("/api/v1/admin/badge-assignments")
      .set("x-user-email", "admin@spacecase.local")
      .send({ user_id: userId, badge_id: badgeId, reason: "Excellent coordination" });

    expect(assignResponse.status).toBe(201);
    const assignmentId = assignResponse.body.id as string;

    const revokeResponse = await request(app)
      .patch(`/api/v1/admin/badge-assignments/${assignmentId}/revoke`)
      .set("x-user-email", "admin@spacecase.local");

    expect(revokeResponse.status).toBe(200);
    expect(revokeResponse.body.revoked_at).toBeTruthy();
  });
});
