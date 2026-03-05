import { randomUUID } from "node:crypto";
import type { PoolClient, QueryResultRow } from "pg";
import { pool, isDatabaseEnabled } from "./db.js";
import * as memory from "./store.js";
import { writeBackupSnapshot } from "./backup.js";
import type {
  Badge,
  BadgeAssignment,
  Commitment,
  CommitmentStatus,
  Cruise,
  CruiseSubgroup,
  Subgroup,
  User,
} from "../types/domain.js";

const nowIso = () => new Date().toISOString();

const mapUser = (row: QueryResultRow): User => ({
  id: String(row.id),
  email: String(row.email),
  playaName: String(row.playa_name),
  phoneNumber: row.phone_number ? String(row.phone_number) : null,
  preferredContact: row.preferred_contact ?? null,
  pronouns: row.pronouns ?? null,
  avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
  cadetExtension: row.cadet_extension ? String(row.cadet_extension) : null,
  role: row.role,
  isDisabled: Boolean(row.is_disabled),
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

const mapCruise = (row: QueryResultRow): Cruise => ({
  id: String(row.id),
  name: String(row.name),
  year: Number(row.year),
  location: row.location ? String(row.location) : null,
  startsOn: row.starts_on ? String(row.starts_on) : null,
  endsOn: row.ends_on ? String(row.ends_on) : null,
  mapImageUrl: row.map_image_url ? String(row.map_image_url) : null,
  specialPageImageUrl: row.special_page_image_url ? String(row.special_page_image_url) : null,
  castingCost: row.casting_cost !== null && row.casting_cost !== undefined ? Number(row.casting_cost) : null,
  castingCostUrl: row.casting_cost_url ? String(row.casting_cost_url) : null,
  status: row.status,
  isFeatured: Boolean(row.is_featured),
  sortOrder: Number(row.sort_order),
  forceAllSubgroupsToDock: Boolean(row.force_all_subgroups_to_dock),
  createdBy: row.created_by ? String(row.created_by) : null,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

const mapSubgroup = (row: QueryResultRow): Subgroup => ({
  id: String(row.id),
  name: String(row.name),
  slug: String(row.slug),
  code: String(row.code),
  defaultDescription: row.default_description ? String(row.default_description) : null,
  defaultTileImageUrl: row.default_tile_image_url ? String(row.default_tile_image_url) : null,
  extension: row.extension ? String(row.extension) : null,
  defaultCostLevel: Number(row.default_cost_level),
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

const mapCruiseSubgroup = (row: QueryResultRow): CruiseSubgroup => ({
  id: String(row.id),
  cruiseId: String(row.cruise_id),
  subgroupId: String(row.subgroup_id),
  overrideName: row.override_name ? String(row.override_name) : null,
  overrideDescription: row.override_description ? String(row.override_description) : null,
  detailImageUrl: row.detail_image_url ? String(row.detail_image_url) : null,
  costLevelOverride: row.cost_level_override === null ? null : Number(row.cost_level_override),
  visibilityState: row.visibility_state,
  dockVisible: Boolean(row.dock_visible),
  mapX: row.map_x === null ? null : Number(row.map_x),
  mapY: row.map_y === null ? null : Number(row.map_y),
  mapScale: Number(row.map_scale),
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

const mapBadge = (row: QueryResultRow): Badge => ({
  id: String(row.id),
  name: String(row.name),
  description: row.description ? String(row.description) : null,
  iconUrl: row.icon_url ? String(row.icon_url) : null,
  cruiseId: row.cruise_id ? String(row.cruise_id) : null,
  createdBy: row.created_by ? String(row.created_by) : null,
  createdAt: new Date(row.created_at).toISOString(),
  updatedAt: new Date(row.updated_at).toISOString(),
});

const mapBadgeAssignment = (row: QueryResultRow): BadgeAssignment => ({
  id: String(row.id),
  userId: String(row.user_id),
  badgeId: String(row.badge_id),
  assignedBy: row.assigned_by ? String(row.assigned_by) : null,
  reason: row.reason ? String(row.reason) : null,
  assignedAt: new Date(row.assigned_at).toISOString(),
  revokedAt: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
});

const mapCommitment = (row: QueryResultRow): Commitment => ({
  id: String(row.id),
  userId: String(row.user_id),
  cruiseSubgroupId: String(row.cruise_subgroup_id),
  cruiseId: String(row.cruise_id),
  cruiseName: String(row.cruise_name),
  cruiseYear: Number(row.cruise_year),
  subgroupId: String(row.subgroup_id),
  subgroupName: String(row.subgroup_name),
  subgroupExtension: row.subgroup_extension ? String(row.subgroup_extension) : null,
  status: row.status,
  committedAt: new Date(row.committed_at).toISOString(),
  withdrawnAt: row.withdrawn_at ? new Date(row.withdrawn_at).toISOString() : null,
  completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  updatedAt: new Date(row.updated_at).toISOString(),
});

export interface MapBatchUpdateInput {
  cruiseSubgroupId: string;
  visibilityState: "invisible" | "inactive" | "active";
  dockVisible: boolean;
  mapX: number | null;
  mapY: number | null;
  mapScale: number;
}

const commitmentSelectSql = `
select c.id, c.user_id, c.cruise_subgroup_id, c.status, c.committed_at, c.withdrawn_at, c.completed_at, c.updated_at,
       cr.id as cruise_id, cr.name as cruise_name, cr.year as cruise_year,
       s.id as subgroup_id,
       coalesce(cs.override_name, s.name) as subgroup_name,
       s.extension as subgroup_extension
from commitments c
join cruise_subgroups cs on cs.id = c.cruise_subgroup_id
join cruises cr on cr.id = cs.cruise_id
join subgroups s on s.id = cs.subgroup_id
`;

export const listUsers = async (): Promise<User[]> => {
  if (!isDatabaseEnabled || !pool) {
    return memory.users;
  }

  const result = await pool.query("select * from users order by created_at asc");
  return result.rows.map(mapUser);
};

export const findUserById = async (id: string): Promise<User | undefined> => {
  if (!isDatabaseEnabled || !pool) {
    return memory.findUserById(id);
  }

  const result = await pool.query("select * from users where id = $1", [id]);
  return result.rows[0] ? mapUser(result.rows[0]) : undefined;
};

export const findUserByEmail = async (email: string): Promise<User | undefined> => {
  if (!isDatabaseEnabled || !pool) {
    return memory.findUserByEmail(email);
  }

  const result = await pool.query("select * from users where lower(email) = lower($1)", [email]);
  return result.rows[0] ? mapUser(result.rows[0]) : undefined;
};

export const findOrCreateUserByEmail = async (
  email: string,
  options?: { playaName?: string; role?: User["role"] },
): Promise<User> => {
  const existing = await findUserByEmail(email);
  if (existing) {
    if (options?.role && existing.role !== options.role) {
      const updated = await updateUser(existing.id, (current) => ({ ...current, role: options.role! }));
      return updated ?? existing;
    }
    return existing;
  }

  const derivedPlayaName = options?.playaName?.trim() || email.split("@")[0] || "Cadet";
  const derivedRole = options?.role ?? "user";

  if (!isDatabaseEnabled || !pool) {
    const created: User = {
      id: randomUUID(),
      email,
      playaName: derivedPlayaName,
      phoneNumber: null,
      preferredContact: null,
      pronouns: null,
      avatarUrl: null,
      cadetExtension: null,
      role: derivedRole,
      isDisabled: false,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    memory.users.push(created);
    void writeBackupSnapshot("findOrCreateUserByEmail:memory");
    return created;
  }

  const result = await pool.query(
    `insert into users (email, playa_name, role, is_disabled)
     values ($1, $2, $3, false)
     on conflict (email)
     do update set playa_name = excluded.playa_name, role = excluded.role, updated_at = now()
     returning *`,
    [email, derivedPlayaName, derivedRole],
  );

  const created = mapUser(result.rows[0]);
  void writeBackupSnapshot("findOrCreateUserByEmail:postgres");
  return created;
};

export const userHasCadetExtension = async (
  cadetExtension: string,
  exceptUserId?: string,
): Promise<boolean> => {
  if (!isDatabaseEnabled || !pool) {
    return memory.userHasCadetExtension(cadetExtension, exceptUserId);
  }

  const result = await pool.query(
    "select 1 from users where cadet_extension = $1 and ($2::uuid is null or id <> $2::uuid) limit 1",
    [cadetExtension, exceptUserId ?? null],
  );
  return (result.rowCount ?? 0) > 0;
};

export const updateUser = async (
  userId: string,
  updater: (existing: User) => User,
): Promise<User | undefined> => {
  if (!isDatabaseEnabled || !pool) {
    const updated = memory.updateUser(userId, updater);
    if (updated) {
      void writeBackupSnapshot("updateUser:memory");
    }
    return updated;
  }

  const existing = await findUserById(userId);
  if (!existing) {
    return undefined;
  }

  const updated = updater(existing);
  const result = await pool.query(
    `update users
     set email = $2, playa_name = $3, phone_number = $4, preferred_contact = $5, pronouns = $6,
         avatar_url = $7, cadet_extension = $8, role = $9, is_disabled = $10, updated_at = now()
     where id = $1
     returning *`,
    [
      userId,
      updated.email,
      updated.playaName,
      updated.phoneNumber,
      updated.preferredContact,
      updated.pronouns,
      updated.avatarUrl,
      updated.cadetExtension,
      updated.role,
      updated.isDisabled,
    ],
  );

  const updatedUser = result.rows[0] ? mapUser(result.rows[0]) : undefined;
  if (updatedUser) {
    void writeBackupSnapshot("updateUser:postgres");
  }
  return updatedUser;
};

export const deleteUser = async (userId: string): Promise<boolean> => {
  if (!isDatabaseEnabled || !pool) {
    const deleted = memory.deleteUser(userId);
    if (deleted) {
      void writeBackupSnapshot("deleteUser:memory");
    }
    return deleted;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    // Clean up dependent rows first to avoid foreign key issues.
    await client.query("delete from cadet_badges where user_id = $1", [userId]);
    await client.query("delete from commitments where user_id = $1", [userId]);

    const result = await client.query("delete from users where id = $1", [userId]);

    await client.query("commit");

    const deleted = (result.rowCount ?? 0) > 0;
    if (deleted) {
      void writeBackupSnapshot("deleteUser:postgres");
    }
    return deleted;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const getUserBadges = async (userId: string): Promise<Badge[]> => {
  if (!isDatabaseEnabled || !pool) {
    return memory.getUserBadges(userId);
  }

  const result = await pool.query(
    `select b.*
     from badges b
     join cadet_badges cb on cb.badge_id = b.id
     where cb.user_id = $1 and cb.revoked_at is null
     order by cb.assigned_at desc`,
    [userId],
  );
  return result.rows.map(mapBadge);
};

export const getUserCommitments = async (userId: string): Promise<Commitment[]> => {
  if (!isDatabaseEnabled || !pool) {
    return memory.getUserCommitments(userId);
  }

  const result = await pool.query(`${commitmentSelectSql} where c.user_id = $1 order by c.updated_at desc`, [
    userId,
  ]);
  return result.rows.map(mapCommitment);
};

export const listCruises = async (includeArchived: boolean): Promise<Cruise[]> => {
  if (!isDatabaseEnabled || !pool) {
    return memory.listCruises(includeArchived);
  }

  const result = await pool.query(
    `select * from cruises where ($1::boolean = true or status <> 'archived') order by sort_order asc, year asc`,
    [includeArchived],
  );
  return result.rows.map(mapCruise);
};

export const findCruiseById = async (id: string): Promise<Cruise | undefined> => {
  if (!isDatabaseEnabled || !pool) {
    return memory.findCruiseById(id);
  }

  const result = await pool.query("select * from cruises where id = $1", [id]);
  return result.rows[0] ? mapCruise(result.rows[0]) : undefined;
};

export const createCruise = async (
  input: Omit<Cruise, "id" | "createdAt" | "updatedAt">,
): Promise<Cruise> => {
  if (!isDatabaseEnabled || !pool) {
    const created = memory.createCruise(input);
    void writeBackupSnapshot("createCruise:memory");
    return created;
  }

  const result = await pool.query(
    `insert into cruises (name, year, location, starts_on, ends_on, map_image_url, special_page_image_url, status, is_featured, sort_order, force_all_subgroups_to_dock, created_by)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     returning *`,
    [
      input.name,
      input.year,
      input.location,
      input.startsOn,
      input.endsOn,
      input.mapImageUrl,
      input.specialPageImageUrl,
      input.status,
      input.isFeatured,
      input.sortOrder,
      input.forceAllSubgroupsToDock,
      input.createdBy,
    ],
  );

  const created = mapCruise(result.rows[0]);
  void writeBackupSnapshot("createCruise:postgres");
  return created;
};

export const updateCruise = async (
  cruiseIdValue: string,
  updater: (existing: Cruise) => Cruise,
): Promise<Cruise | undefined> => {
  if (!isDatabaseEnabled || !pool) {
    const updated = memory.updateCruise(cruiseIdValue, updater);
    if (updated) {
      void writeBackupSnapshot("updateCruise:memory");
    }
    return updated;
  }

  const existing = await findCruiseById(cruiseIdValue);
  if (!existing) {
    return undefined;
  }

  const updated = updater(existing);
  const result = await pool.query(
    `update cruises
     set name=$2, year=$3, location=$4, starts_on=$5, ends_on=$6, map_image_url=$7, special_page_image_url=$8, status=$9,
         is_featured=$10, sort_order=$11, force_all_subgroups_to_dock=$12, updated_at=now()
     where id = $1 returning *`,
    [
      cruiseIdValue,
      updated.name,
      updated.year,
      updated.location,
      updated.startsOn,
      updated.endsOn,
      updated.mapImageUrl,
      updated.specialPageImageUrl,
      updated.status,
      updated.isFeatured,
      updated.sortOrder,
      updated.forceAllSubgroupsToDock,
    ],
  );

  const updatedResult = result.rows[0] ? mapCruise(result.rows[0]) : undefined;
  if (updatedResult) {
    void writeBackupSnapshot("updateCruise:postgres");
  }
  return updatedResult;
};

export const listSubgroups = async (): Promise<Subgroup[]> => {
  if (!isDatabaseEnabled || !pool) {
    return memory.listSubgroups();
  }

  const result = await pool.query("select * from subgroups order by name asc");
  return result.rows.map(mapSubgroup);
};

export const findSubgroupById = async (id: string): Promise<Subgroup | undefined> => {
  if (!isDatabaseEnabled || !pool) {
    return memory.findSubgroupById(id);
  }

  const result = await pool.query("select * from subgroups where id = $1", [id]);
  return result.rows[0] ? mapSubgroup(result.rows[0]) : undefined;
};

export const subgroupSlugExists = async (slug: string, exceptSubgroupId?: string): Promise<boolean> => {
  if (!isDatabaseEnabled || !pool) {
    return memory.subgroupSlugExists(slug, exceptSubgroupId);
  }

  const result = await pool.query(
    "select 1 from subgroups where slug = $1 and ($2::uuid is null or id <> $2::uuid) limit 1",
    [slug, exceptSubgroupId ?? null],
  );
  return (result.rowCount ?? 0) > 0;
};

export const subgroupCodeExists = async (code: string, exceptSubgroupId?: string): Promise<boolean> => {
  if (!isDatabaseEnabled || !pool) {
    return memory.subgroupCodeExists(code, exceptSubgroupId);
  }

  const result = await pool.query(
    "select 1 from subgroups where code = $1 and ($2::uuid is null or id <> $2::uuid) limit 1",
    [code, exceptSubgroupId ?? null],
  );
  return (result.rowCount ?? 0) > 0;
};

export const subgroupExtensionExists = async (
  extension: string,
  exceptSubgroupId?: string,
): Promise<boolean> => {
  if (!isDatabaseEnabled || !pool) {
    return memory.subgroupExtensionExists(extension, exceptSubgroupId);
  }

  const result = await pool.query(
    "select 1 from subgroups where extension = $1 and ($2::uuid is null or id <> $2::uuid) limit 1",
    [extension, exceptSubgroupId ?? null],
  );
  return (result.rowCount ?? 0) > 0;
};

export const createSubgroup = async (
  input: Omit<Subgroup, "id" | "createdAt" | "updatedAt">,
): Promise<Subgroup> => {
  if (!isDatabaseEnabled || !pool) {
    const created = memory.createSubgroup(input);
    void writeBackupSnapshot("createSubgroup:memory");
    return created;
  }

  const result = await pool.query(
    `insert into subgroups (name, slug, code, default_description, default_tile_image_url, extension, default_cost_level)
     values ($1,$2,$3,$4,$5,$6,$7)
     returning *`,
    [
      input.name,
      input.slug,
      input.code,
      input.defaultDescription,
      input.defaultTileImageUrl,
      input.extension,
      input.defaultCostLevel,
    ],
  );

  const created = mapSubgroup(result.rows[0]);
  void writeBackupSnapshot("createSubgroup:postgres");
  return created;
};

export const updateSubgroup = async (
  subgroupIdValue: string,
  updater: (existing: Subgroup) => Subgroup,
): Promise<Subgroup | undefined> => {
  if (!isDatabaseEnabled || !pool) {
    const updated = memory.updateSubgroup(subgroupIdValue, updater);
    if (updated) {
      void writeBackupSnapshot("updateSubgroup:memory");
    }
    return updated;
  }

  const existing = await findSubgroupById(subgroupIdValue);
  if (!existing) {
    return undefined;
  }

  const updated = updater(existing);
  const result = await pool.query(
    `update subgroups
     set name=$2, slug=$3, code=$4, default_description=$5, default_tile_image_url=$6,
         extension=$7, default_cost_level=$8, updated_at=now()
     where id = $1 returning *`,
    [
      subgroupIdValue,
      updated.name,
      updated.slug,
      updated.code,
      updated.defaultDescription,
      updated.defaultTileImageUrl,
      updated.extension,
      updated.defaultCostLevel,
    ],
  );

  const updatedResult = result.rows[0] ? mapSubgroup(result.rows[0]) : undefined;
  if (updatedResult) {
    void writeBackupSnapshot("updateSubgroup:postgres");
  }
  return updatedResult;
};

export const listCruiseSubgroups = async (cruiseIdValue: string): Promise<CruiseSubgroup[]> => {
  if (!isDatabaseEnabled || !pool) {
    return memory.listCruiseSubgroups(cruiseIdValue);
  }

  const result = await pool.query("select * from cruise_subgroups where cruise_id = $1 order by created_at asc", [
    cruiseIdValue,
  ]);
  return result.rows.map(mapCruiseSubgroup);
};

export const findCruiseSubgroupById = async (id: string): Promise<CruiseSubgroup | undefined> => {
  if (!isDatabaseEnabled || !pool) {
    return memory.findCruiseSubgroupById(id);
  }

  const result = await pool.query("select * from cruise_subgroups where id = $1", [id]);
  return result.rows[0] ? mapCruiseSubgroup(result.rows[0]) : undefined;
};

export const cruiseSubgroupPairExists = async (
  cruiseIdValue: string,
  subgroupIdValue: string,
): Promise<boolean> => {
  if (!isDatabaseEnabled || !pool) {
    return memory.cruiseSubgroupPairExists(cruiseIdValue, subgroupIdValue);
  }

  const result = await pool.query(
    "select 1 from cruise_subgroups where cruise_id = $1 and subgroup_id = $2 limit 1",
    [cruiseIdValue, subgroupIdValue],
  );
  return (result.rowCount ?? 0) > 0;
};

export const createCruiseSubgroup = async (
  input: Omit<CruiseSubgroup, "id" | "createdAt" | "updatedAt">,
): Promise<CruiseSubgroup> => {
  if (!isDatabaseEnabled || !pool) {
    const created = memory.createCruiseSubgroup(input);
    void writeBackupSnapshot("createCruiseSubgroup:memory");
    return created;
  }

  const result = await pool.query(
    `insert into cruise_subgroups
      (cruise_id, subgroup_id, override_name, override_description, detail_image_url, cost_level_override,
       visibility_state, dock_visible, map_x, map_y, map_scale)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     returning *`,
    [
      input.cruiseId,
      input.subgroupId,
      input.overrideName,
      input.overrideDescription,
      input.detailImageUrl,
      input.costLevelOverride,
      input.visibilityState,
      input.dockVisible,
      input.mapX,
      input.mapY,
      input.mapScale,
    ],
  );

  const created = mapCruiseSubgroup(result.rows[0]);
  void writeBackupSnapshot("createCruiseSubgroup:postgres");
  return created;
};

export const updateCruiseSubgroup = async (
  cruiseSubgroupId: string,
  updater: (existing: CruiseSubgroup) => CruiseSubgroup,
): Promise<CruiseSubgroup | undefined> => {
  if (!isDatabaseEnabled || !pool) {
    const updated = memory.updateCruiseSubgroup(cruiseSubgroupId, updater);
    if (updated) {
      void writeBackupSnapshot("updateCruiseSubgroup:memory");
    }
    return updated;
  }

  const existing = await findCruiseSubgroupById(cruiseSubgroupId);
  if (!existing) {
    return undefined;
  }

  const updated = updater(existing);
  const result = await pool.query(
    `update cruise_subgroups
     set override_name=$2, override_description=$3, detail_image_url=$4, cost_level_override=$5,
         visibility_state=$6, dock_visible=$7, map_x=$8, map_y=$9, map_scale=$10, updated_at=now()
     where id = $1 returning *`,
    [
      cruiseSubgroupId,
      updated.overrideName,
      updated.overrideDescription,
      updated.detailImageUrl,
      updated.costLevelOverride,
      updated.visibilityState,
      updated.dockVisible,
      updated.mapX,
      updated.mapY,
      updated.mapScale,
    ],
  );

  const updatedResult = result.rows[0] ? mapCruiseSubgroup(result.rows[0]) : undefined;
  if (updatedResult) {
    void writeBackupSnapshot("updateCruiseSubgroup:postgres");
  }
  return updatedResult;
};

export const listCommitmentsForCruiseSubgroup = async (
  cruiseSubgroupId: string,
  statusFilter?: Array<CommitmentStatus>,
): Promise<Commitment[]> => {
  if (!isDatabaseEnabled || !pool) {
    return memory.listCommitmentsForCruiseSubgroup(cruiseSubgroupId, statusFilter);
  }

  if (!statusFilter || statusFilter.length === 0) {
    const result = await pool.query(`${commitmentSelectSql} where c.cruise_subgroup_id = $1`, [
      cruiseSubgroupId,
    ]);
    return result.rows.map(mapCommitment);
  }

  const result = await pool.query(
    `${commitmentSelectSql} where c.cruise_subgroup_id = $1 and c.status = any($2::commitment_status[])`,
    [cruiseSubgroupId, statusFilter],
  );
  return result.rows.map(mapCommitment);
};

const findCommitmentDetailWithClient = async (
  client: PoolClient,
  userId: string,
  cruiseSubgroupIdValue: string,
): Promise<Commitment | undefined> => {
  const result = await client.query(
    `${commitmentSelectSql} where c.user_id = $1 and c.cruise_subgroup_id = $2`,
    [userId, cruiseSubgroupIdValue],
  );
  return result.rows[0] ? mapCommitment(result.rows[0]) : undefined;
};

const findCommitmentDetail = async (
  userId: string,
  cruiseSubgroupIdValue: string,
): Promise<Commitment | undefined> => {
  if (!pool) {
    return undefined;
  }

  const result = await pool.query(
    `${commitmentSelectSql} where c.user_id = $1 and c.cruise_subgroup_id = $2`,
    [userId, cruiseSubgroupIdValue],
  );
  return result.rows[0] ? mapCommitment(result.rows[0]) : undefined;
};

export const transitionCommitment = async (
  userId: string,
  cruiseSubgroupIdValue: string,
  action: "commit" | "withdraw" | "recommit",
): Promise<{ commitment?: Commitment; errorCode?: "NOT_FOUND" | "INVALID_TRANSITION" | "CONFLICT" }> => {
  if (!isDatabaseEnabled || !pool) {
    const result = memory.transitionCommitment(userId, cruiseSubgroupIdValue, action);
    if (result.commitment) {
      void writeBackupSnapshot("transitionCommitment:memory");
    }
    return result;
  }

  const client = await pool.connect();

  try {
    await client.query("begin");

    const assignmentCheck = await client.query(
      "select id from cruise_subgroups where id = $1",
      [cruiseSubgroupIdValue],
    );

    if ((assignmentCheck.rowCount ?? 0) === 0) {
      await client.query("rollback");
      return { errorCode: "NOT_FOUND" };
    }

    const commitmentState = await client.query(
      "select id, status from commitments where user_id = $1 and cruise_subgroup_id = $2 for update",
      [userId, cruiseSubgroupIdValue],
    );

    if ((commitmentState.rowCount ?? 0) === 0) {
      if (action !== "commit") {
        await client.query("rollback");
        return { errorCode: "INVALID_TRANSITION" };
      }

      await client.query(
        "insert into commitments (user_id, cruise_subgroup_id, status, committed_at, withdrawn_at, completed_at, updated_at) values ($1,$2,'committed',now(),null,null,now())",
        [userId, cruiseSubgroupIdValue],
      );

      const created = await findCommitmentDetailWithClient(client, userId, cruiseSubgroupIdValue);
      await client.query("commit");
      void writeBackupSnapshot("transitionCommitment:postgres");
      return { commitment: created };
    }

    const existing = commitmentState.rows[0] as { id: string; status: CommitmentStatus };

    if (existing.status === "completed") {
      await client.query("rollback");
      return { errorCode: "CONFLICT" };
    }

    if (existing.status === "committed" && action === "withdraw") {
      await client.query(
        "update commitments set status = 'withdrawn', withdrawn_at = now(), completed_at = null, updated_at = now() where id = $1",
        [existing.id],
      );

      const updated = await findCommitmentDetailWithClient(client, userId, cruiseSubgroupIdValue);
      await client.query("commit");
      void writeBackupSnapshot("transitionCommitment:postgres");
      return { commitment: updated };
    }

    if (existing.status === "withdrawn" && action === "recommit") {
      await client.query(
        "update commitments set status = 'committed', withdrawn_at = null, completed_at = null, updated_at = now() where id = $1",
        [existing.id],
      );

      const updated = await findCommitmentDetailWithClient(client, userId, cruiseSubgroupIdValue);
      await client.query("commit");
      void writeBackupSnapshot("transitionCommitment:postgres");
      return { commitment: updated };
    }

    await client.query("rollback");
    return { errorCode: "INVALID_TRANSITION" };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const applyCruiseMapBatchUpdates = async (
  cruiseId: string,
  updates: MapBatchUpdateInput[],
): Promise<CruiseSubgroup[]> => {
  if (!isDatabaseEnabled || !pool) {
    const applied: CruiseSubgroup[] = [];

    for (const update of updates) {
      const updated = memory.updateCruiseSubgroup(update.cruiseSubgroupId, (current) => ({
        ...current,
        visibilityState: update.visibilityState,
        dockVisible: update.dockVisible,
        mapX: update.mapX,
        mapY: update.mapY,
        mapScale: update.mapScale,
      }));

      if (!updated || updated.cruiseId !== cruiseId) {
        throw new Error("Cruise subgroup not found during map batch update");
      }

      applied.push(updated);
    }

    void writeBackupSnapshot("applyCruiseMapBatchUpdates:memory");
    return applied;
  }

  const client = await pool.connect();

  try {
    await client.query("begin");
    const applied: CruiseSubgroup[] = [];

    for (const update of updates) {
      const result = await client.query(
        `update cruise_subgroups
         set visibility_state = $2,
             dock_visible = $3,
             map_x = $4,
             map_y = $5,
             map_scale = $6,
             updated_at = now()
         where id = $1 and cruise_id = $7
         returning *`,
        [
          update.cruiseSubgroupId,
          update.visibilityState,
          update.dockVisible,
          update.mapX,
          update.mapY,
          update.mapScale,
          cruiseId,
        ],
      );

      if ((result.rowCount ?? 0) === 0 || !result.rows[0]) {
        throw new Error("Cruise subgroup not found during map batch update");
      }

      applied.push(mapCruiseSubgroup(result.rows[0]));
    }

    await client.query("commit");
    void writeBackupSnapshot("applyCruiseMapBatchUpdates:postgres");
    return applied;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

export const listBadges = async (): Promise<Badge[]> => {
  if (!isDatabaseEnabled || !pool) {
    return memory.listBadges();
  }

  const result = await pool.query("select * from badges order by created_at desc");
  return result.rows.map(mapBadge);
};

export const findBadgeById = async (id: string): Promise<Badge | undefined> => {
  if (!isDatabaseEnabled || !pool) {
    return memory.findBadgeById(id);
  }

  const result = await pool.query("select * from badges where id = $1", [id]);
  return result.rows[0] ? mapBadge(result.rows[0]) : undefined;
};

export const createBadge = async (input: Omit<Badge, "id" | "createdAt" | "updatedAt">): Promise<Badge> => {
  if (!isDatabaseEnabled || !pool) {
    const created = memory.createBadge(input);
    void writeBackupSnapshot("createBadge:memory");
    return created;
  }

  const result = await pool.query(
    "insert into badges (name, description, icon_url, cruise_id, created_by) values ($1,$2,$3,$4,$5) returning *",
    [input.name, input.description, input.iconUrl, input.cruiseId, input.createdBy],
  );
  const created = mapBadge(result.rows[0]);
  void writeBackupSnapshot("createBadge:postgres");
  return created;
};

export const updateBadge = async (
  badgeIdValue: string,
  updater: (existing: Badge) => Badge,
): Promise<Badge | undefined> => {
  if (!isDatabaseEnabled || !pool) {
    const updated = memory.updateBadge(badgeIdValue, updater);
    if (updated) {
      void writeBackupSnapshot("updateBadge:memory");
    }
    return updated;
  }

  const existing = await findBadgeById(badgeIdValue);
  if (!existing) {
    return undefined;
  }

  const updated = updater(existing);
  const result = await pool.query(
    "update badges set name=$2, description=$3, icon_url=$4, cruise_id=$5, updated_at=now() where id=$1 returning *",
    [badgeIdValue, updated.name, updated.description, updated.iconUrl, updated.cruiseId],
  );
  const updatedResult = result.rows[0] ? mapBadge(result.rows[0]) : undefined;
  if (updatedResult) {
    void writeBackupSnapshot("updateBadge:postgres");
  }
  return updatedResult;
};

export const listBadgeAssignments = async (): Promise<BadgeAssignment[]> => {
  if (!isDatabaseEnabled || !pool) {
    return memory.listBadgeAssignments();
  }

  const result = await pool.query("select * from cadet_badges order by assigned_at desc");
  return result.rows.map(mapBadgeAssignment);
};

export const findBadgeAssignmentById = async (id: string): Promise<BadgeAssignment | undefined> => {
  if (!isDatabaseEnabled || !pool) {
    return memory.findBadgeAssignmentById(id);
  }

  const result = await pool.query("select * from cadet_badges where id = $1", [id]);
  return result.rows[0] ? mapBadgeAssignment(result.rows[0]) : undefined;
};

export const findActiveBadgeAssignment = async (
  userId: string,
  badgeId: string,
): Promise<BadgeAssignment | undefined> => {
  if (!isDatabaseEnabled || !pool) {
    return memory.findActiveBadgeAssignment(userId, badgeId);
  }

  const result = await pool.query(
    "select * from cadet_badges where user_id = $1 and badge_id = $2 and revoked_at is null limit 1",
    [userId, badgeId],
  );
  return result.rows[0] ? mapBadgeAssignment(result.rows[0]) : undefined;
};

export const createBadgeAssignment = async (
  input: Omit<BadgeAssignment, "id" | "assignedAt" | "revokedAt">,
): Promise<BadgeAssignment> => {
  if (!isDatabaseEnabled || !pool) {
    const created = memory.createBadgeAssignment(input);
    void writeBackupSnapshot("createBadgeAssignment:memory");
    return created;
  }

  const result = await pool.query(
    "insert into cadet_badges (user_id, badge_id, assigned_by, reason) values ($1,$2,$3,$4) returning *",
    [input.userId, input.badgeId, input.assignedBy, input.reason],
  );
  const created = mapBadgeAssignment(result.rows[0]);
  void writeBackupSnapshot("createBadgeAssignment:postgres");
  return created;
};

export const revokeBadgeAssignment = async (
  assignmentId: string,
): Promise<BadgeAssignment | undefined> => {
  if (!isDatabaseEnabled || !pool) {
    const revoked = memory.revokeBadgeAssignment(assignmentId);
    if (revoked) {
      void writeBackupSnapshot("revokeBadgeAssignment:memory");
    }
    return revoked;
  }

  const result = await pool.query(
    "update cadet_badges set revoked_at = coalesce(revoked_at, now()) where id = $1 returning *",
    [assignmentId],
  );
  const revoked = result.rows[0] ? mapBadgeAssignment(result.rows[0]) : undefined;
  if (revoked) {
    void writeBackupSnapshot("revokeBadgeAssignment:postgres");
  }
  return revoked;
};

export const getRuntimeMode = (): "postgres" | "memory" =>
  isDatabaseEnabled ? "postgres" : "memory";

export const seedMemoryTimestamps = (): string => nowIso();
