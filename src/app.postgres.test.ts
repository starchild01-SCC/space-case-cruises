import request from "supertest";
import type { Express } from "express";
import { beforeAll, describe, expect, it } from "vitest";
import { isDatabaseEnabled, pool } from "./data/db.js";
import { seedDatabase } from "./scripts/seed-lib.js";

let app: Express;

const describePostgres = isDatabaseEnabled ? describe : describe.skip;

describePostgres("Space Case Cruises API postgres", () => {
  beforeAll(async () => {
    process.env.ALLOW_HEADER_AUTH = "true";
    ({ app } = await import("./app.js"));

    if (!pool) {
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(
        `truncate table
          cadet_badges,
          badges,
          commitments,
          cruise_subgroups,
          subgroups,
          cruises,
          users
        restart identity cascade`,
      );
      await seedDatabase(client);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  });

  it("reports postgres runtime mode", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.mode).toBe("postgres");
  });

  it("persists commitment lifecycle transitions", async () => {
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

  it("applies map batch updates", async () => {
    const cruisesResponse = await request(app)
      .get("/api/v1/cruises")
      .set("x-user-email", "admin@spacecase.local");
    const cruiseId = cruisesResponse.body.items[0]?.id as string;

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
            visibility_state: "inactive",
            dock_visible: true,
            map_x: null,
            map_y: null,
            map_scale: 1.1,
          },
        ],
      });

    expect(batchResponse.status).toBe(200);
    expect(batchResponse.body.updated_count).toBe(1);
    expect(batchResponse.body.items[0]?.map_scale).toBe(1.1);
  });

  it("creates, assigns, and revokes a badge", async () => {
    const createBadgeResponse = await request(app)
      .post("/api/v1/admin/badges")
      .set("x-user-email", "admin@spacecase.local")
      .send({
        name: "Comms Star",
        description: "Exceptional comms support",
        icon_url: null,
        cruise_id: null,
      });

    expect(createBadgeResponse.status).toBe(201);
    const badgeId = createBadgeResponse.body.id as string;

    const cadreResponse = await request(app)
      .get("/api/v1/cadre")
      .set("x-user-email", "admin@spacecase.local");
    const cadetId = (cadreResponse.body.items as Array<{ id: string; role: string }>).find(
      (item) => item.role === "user",
    )?.id;

    expect(cadetId).toBeTruthy();

    const assignResponse = await request(app)
      .post("/api/v1/admin/badge-assignments")
      .set("x-user-email", "admin@spacecase.local")
      .send({ user_id: cadetId, badge_id: badgeId, reason: "DB integration test" });

    expect(assignResponse.status).toBe(201);

    const revokeResponse = await request(app)
      .patch(`/api/v1/admin/badge-assignments/${assignResponse.body.id}/revoke`)
      .set("x-user-email", "admin@spacecase.local");

    expect(revokeResponse.status).toBe(200);
    expect(revokeResponse.body.revoked_at).toBeTruthy();
  });
});
