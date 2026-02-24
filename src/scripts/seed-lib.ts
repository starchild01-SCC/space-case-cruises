import type { PoolClient } from "pg";

export const FIXTURES = {
  adminEmail: "admin@spacecase.local",
  cadetEmail: "cadet@spacecase.local",
  cruiseId: "11111111-1111-4111-8111-111111111111",
  commsSubgroupId: "22222222-2222-4222-8222-222222222222",
  buildSubgroupId: "33333333-3333-4333-8333-333333333333",
  commsAssignmentId: "44444444-4444-4444-8444-444444444444",
  builderBadgeId: "55555555-5555-4555-8555-555555555555",
} as const;

export const seedDatabase = async (client: PoolClient): Promise<void> => {
  const adminUser = await client.query(
    `insert into users (email, playa_name, phone_number, preferred_contact, pronouns, cadet_extension, role, is_disabled)
     values ($1, 'Captain', '+15550000001', 'phone', 'they_them', '100', 'admin', false)
     on conflict (email)
     do update set
       playa_name = excluded.playa_name,
       phone_number = excluded.phone_number,
       preferred_contact = excluded.preferred_contact,
       pronouns = excluded.pronouns,
       cadet_extension = excluded.cadet_extension,
       role = excluded.role,
       is_disabled = excluded.is_disabled,
       updated_at = now()
     returning id`,
    [FIXTURES.adminEmail],
  );

  const cadetUser = await client.query(
    `insert into users (email, playa_name, phone_number, preferred_contact, pronouns, cadet_extension, role, is_disabled)
     values ($1, 'Nova', '+15550000002', 'discord', 'she_her', '101', 'user', false)
     on conflict (email)
     do update set
       playa_name = excluded.playa_name,
       phone_number = excluded.phone_number,
       preferred_contact = excluded.preferred_contact,
       pronouns = excluded.pronouns,
       cadet_extension = excluded.cadet_extension,
       role = excluded.role,
       is_disabled = excluded.is_disabled,
       updated_at = now()
     returning id`,
    [FIXTURES.cadetEmail],
  );

  const adminId = String(adminUser.rows[0]?.id);
  const cadetId = String(cadetUser.rows[0]?.id);

  if (!adminId || !cadetId) {
    throw new Error("Failed to resolve seeded users");
  }

  await client.query(
    `insert into cruises (
      id, name, year, location, starts_on, ends_on, map_image_url, status,
      is_featured, sort_order, force_all_subgroups_to_dock, created_by
    )
    values ($1, 'Space Case Cruise', 2026, 'Black Rock City', '2026-08-24', '2026-09-01', null, 'active', true, 1, false, $2)
    on conflict (id)
    do update set
      name = excluded.name,
      year = excluded.year,
      location = excluded.location,
      starts_on = excluded.starts_on,
      ends_on = excluded.ends_on,
      map_image_url = excluded.map_image_url,
      status = excluded.status,
      is_featured = excluded.is_featured,
      sort_order = excluded.sort_order,
      force_all_subgroups_to_dock = excluded.force_all_subgroups_to_dock,
      created_by = excluded.created_by,
      updated_at = now()`,
    [FIXTURES.cruiseId, adminId],
  );

  await client.query(
    `insert into subgroups (
      id, name, slug, code, default_description, default_tile_image_url, extension, default_cost_level
    )
    values
      ($1, 'Comms', 'comms', 'COMMS', 'Communications systems', null, '800', 3),
      ($2, 'Build', 'build', 'BUILD', 'Build and fabrication', null, '801', 2)
    on conflict (slug)
    do update set
      name = excluded.name,
      code = excluded.code,
      default_description = excluded.default_description,
      default_tile_image_url = excluded.default_tile_image_url,
      extension = excluded.extension,
      default_cost_level = excluded.default_cost_level,
      updated_at = now()`,
    [FIXTURES.commsSubgroupId, FIXTURES.buildSubgroupId],
  );

  await client.query(
    `insert into cruise_subgroups (
      id, cruise_id, subgroup_id, override_name, override_description, detail_image_url,
      cost_level_override, visibility_state, dock_visible, map_x, map_y, map_scale
    )
    values ($1, $2, $3, null, null, null, null, 'inactive', true, null, null, 1.0)
    on conflict (cruise_id, subgroup_id)
    do update set
      override_name = excluded.override_name,
      override_description = excluded.override_description,
      detail_image_url = excluded.detail_image_url,
      cost_level_override = excluded.cost_level_override,
      visibility_state = excluded.visibility_state,
      dock_visible = excluded.dock_visible,
      map_x = excluded.map_x,
      map_y = excluded.map_y,
      map_scale = excluded.map_scale,
      updated_at = now()
    returning id`,
    [FIXTURES.commsAssignmentId, FIXTURES.cruiseId, FIXTURES.commsSubgroupId],
  );

  await client.query(
    `insert into commitments (
      user_id, cruise_subgroup_id, status, committed_at, withdrawn_at, completed_at, updated_at
    )
    values ($1, $2, 'committed', now(), null, null, now())
    on conflict (user_id, cruise_subgroup_id)
    do update set
      status = 'committed',
      withdrawn_at = null,
      completed_at = null,
      updated_at = now()`,
    [cadetId, FIXTURES.commsAssignmentId],
  );

  await client.query(
    `insert into badges (id, name, description, icon_url, cruise_id, created_by)
     values ($1, 'Builder', 'Helped build infrastructure', null, null, $2)
     on conflict (id)
     do update set
       name = excluded.name,
       description = excluded.description,
       icon_url = excluded.icon_url,
       cruise_id = excluded.cruise_id,
       created_by = excluded.created_by,
       updated_at = now()`,
    [FIXTURES.builderBadgeId, adminId],
  );

  await client.query(
    `insert into cadet_badges (user_id, badge_id, assigned_by, reason, assigned_at, revoked_at)
     values ($1, $2, $3, 'Seed recognition', now(), null)
     on conflict (user_id, badge_id) where revoked_at is null
     do update set
       assigned_by = excluded.assigned_by,
       reason = excluded.reason,
       revoked_at = null`,
    [cadetId, FIXTURES.builderBadgeId, adminId],
  );
}
