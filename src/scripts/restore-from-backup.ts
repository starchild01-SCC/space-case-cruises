import "dotenv/config";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pool, isDatabaseEnabled } from "../data/db.js";

interface BackupUser {
  id: string;
  email: string;
  playaName: string;
  phoneNumber?: string;
  preferredContact?: string;
  pronouns?: string;
  avatarUrl?: string;
  cadetExtension?: string;
  role: string;
  isDisabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface BackupCruise {
  id: string;
  name: string;
  year: number;
  location?: string;
  startsOn?: string;
  endsOn?: string;
  mapImageUrl?: string;
  specialPageImageUrl?: string;
  castingCost?: number;
  castingCostUrl?: string;
  status: string;
  isFeatured: boolean;
  sortOrder: number;
  forceAllSubgroupsToDock: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface BackupSubgroup {
  id: string;
  name: string;
  slug: string;
  code: string;
  defaultDescription?: string;
  defaultTileImageUrl?: string;
  extension?: string;
  defaultCostLevel: number;
  createdAt: string;
  updatedAt: string;
}

interface BackupCruiseSubgroup {
  id: string;
  cruiseId: string;
  subgroupId: string;
  overrideName?: string;
  overrideDescription?: string;
  detailImageUrl?: string;
  costLevelOverride?: number;
  visibilityState: string;
  dockVisible: boolean;
  mapX?: number;
  mapY?: number;
  mapScale: number;
  createdAt: string;
  updatedAt: string;
}

interface BackupBadge {
  id: string;
  name: string;
  description?: string;
  iconUrl?: string;
  cruiseId?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

interface BackupBadgeAssignment {
  id: string;
  userId: string;
  badgeId: string;
  assignedBy?: string;
  reason?: string;
  assignedAt: string;
  revokedAt?: string;
}

interface BackupCommitment {
  id: string;
  userId: string;
  cruiseSubgroupId: string;
  status: string;
  committedAt: string;
  withdrawnAt?: string;
  completedAt?: string;
  updatedAt: string;
}

interface BackupData {
  mode: string;
  reason: string;
  timestamp: string;
  snapshot: {
    users: BackupUser[];
    cruises: BackupCruise[];
    subgroups: BackupSubgroup[];
    cruiseSubgroups: BackupCruiseSubgroup[];
    badges: BackupBadge[];
    badgeAssignments: BackupBadgeAssignment[];
    commitments: BackupCommitment[];
  };
}

/**
 * Convert camelCase field names to snake_case for PostgreSQL
 */
function normalizeImageUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  // If it's an absolute path with /uploads, mark it for bridging when served
  if (url.includes("/uploads/")) {
    return url; // The API will normalize this to /api/uploads on response
  }
  return url;
}

/**
 * Resolve backup file path: prioritize command-line argument, fallback to most recent file
 */
function resolveBackupPath(): string {
  // Check for command-line argument (e.g., node dist/scripts/restore-from-backup.js /path/to/backup.json)
  const argPath = process.argv[2];
  if (argPath) {
    // If argument is provided, use it as-is (absolute or relative to cwd)
    const fullPath = argPath.startsWith("/") ? argPath : resolve(process.cwd(), argPath);
    process.stdout.write(`Using backup file from argument: ${fullPath}\n`);
    return fullPath;
  }

  // No argument provided, find the most recent backup in snapshots folder
  const snapshotsDir = resolve(process.cwd(), "backups", "snapshots");
  const files = readdirSync(snapshotsDir).filter((file) => file.endsWith(".json"));

  if (files.length === 0) {
    throw new Error(`No backup files found in ${snapshotsDir}`);
  }

  // Sort by modification time (newest first)
  const fileStats = files.map((file) => {
    const fullPath = resolve(snapshotsDir, file);
    return {
      name: file,
      path: fullPath,
      time: statSync(fullPath).mtimeMs,
    };
  });

  fileStats.sort((a, b) => b.time - a.time);
  const mostRecent = fileStats[0]!;

  process.stdout.write(`No backup path provided. Using most recent: ${mostRecent.name}\n`);
  return mostRecent.path;
}

const run = async (): Promise<void> => {
  if (!isDatabaseEnabled || !pool) {
    throw new Error("DATABASE_URL is required for restore mode");
  }

  // Resolve backup file path: use command-line arg or find most recent
  const backupPath = resolveBackupPath();
  const backupContent = readFileSync(backupPath, "utf8");
  const backup = JSON.parse(backupContent) as BackupData;

  if (!backup.snapshot) {
    throw new Error("Backup file missing snapshot data");
  }

  const client = await pool.connect();

  try {
    await client.query("begin");

    // Insert users
    for (const user of backup.snapshot.users) {
      await client.query(
        `insert into users 
         (id, email, playa_name, phone_number, preferred_contact, pronouns, avatar_url, cadet_extension, role, is_disabled, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         on conflict (id) do nothing`,
        [
          user.id,
          user.email,
          user.playaName,
          user.phoneNumber || null,
          user.preferredContact || null,
          user.pronouns || null,
          normalizeImageUrl(user.avatarUrl),
          user.cadetExtension || null,
          user.role,
          user.isDisabled,
          user.createdAt,
          user.updatedAt,
        ],
      );
    }

    process.stdout.write(`✓ Inserted ${backup.snapshot.users.length} users\n`);

    // Insert cruises
    for (const cruise of backup.snapshot.cruises) {
      await client.query(
        `insert into cruises 
         (id, name, year, location, starts_on, ends_on, map_image_url, special_page_image_url, casting_cost, casting_cost_url, status, is_featured, sort_order, force_all_subgroups_to_dock, created_by, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         on conflict (id) do nothing`,
        [
          cruise.id,
          cruise.name,
          cruise.year,
          cruise.location || null,
          cruise.startsOn || null,
          cruise.endsOn || null,
          normalizeImageUrl(cruise.mapImageUrl),
          normalizeImageUrl(cruise.specialPageImageUrl),
          cruise.castingCost || null,
          cruise.castingCostUrl || null,
          cruise.status,
          cruise.isFeatured,
          cruise.sortOrder,
          cruise.forceAllSubgroupsToDock,
          cruise.createdBy || null,
          cruise.createdAt,
          cruise.updatedAt,
        ],
      );
    }

    process.stdout.write(`✓ Inserted ${backup.snapshot.cruises.length} cruises\n`);

    // Insert subgroups
    for (const subgroup of backup.snapshot.subgroups) {
      await client.query(
        `insert into subgroups 
         (id, name, slug, code, default_description, default_tile_image_url, extension, default_cost_level, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         on conflict (id) do nothing`,
        [
          subgroup.id,
          subgroup.name,
          subgroup.slug,
          subgroup.code,
          subgroup.defaultDescription || null,
          normalizeImageUrl(subgroup.defaultTileImageUrl),
          subgroup.extension || null,
          subgroup.defaultCostLevel,
          subgroup.createdAt,
          subgroup.updatedAt,
        ],
      );
    }

    process.stdout.write(`✓ Inserted ${backup.snapshot.subgroups.length} subgroups\n`);

    // Insert cruise_subgroups
    for (const cs of backup.snapshot.cruiseSubgroups) {
      await client.query(
        `insert into cruise_subgroups 
         (id, cruise_id, subgroup_id, override_name, override_description, detail_image_url, cost_level_override, visibility_state, dock_visible, map_x, map_y, map_scale, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         on conflict (id) do nothing`,
        [
          cs.id,
          cs.cruiseId,
          cs.subgroupId,
          cs.overrideName || null,
          cs.overrideDescription || null,
          normalizeImageUrl(cs.detailImageUrl),
          cs.costLevelOverride || null,
          cs.visibilityState,
          cs.dockVisible,
          cs.mapX || null,
          cs.mapY || null,
          cs.mapScale,
          cs.createdAt,
          cs.updatedAt,
        ],
      );
    }

    process.stdout.write(`✓ Inserted ${backup.snapshot.cruiseSubgroups.length} cruise_subgroups\n`);

    // Insert badges
    for (const badge of backup.snapshot.badges) {
      await client.query(
        `insert into badges 
         (id, name, description, icon_url, cruise_id, created_by, created_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (id) do nothing`,
        [
          badge.id,
          badge.name,
          badge.description || null,
          normalizeImageUrl(badge.iconUrl),
          badge.cruiseId || null,
          badge.createdBy || null,
          badge.createdAt,
          badge.updatedAt,
        ],
      );
    }

    process.stdout.write(`✓ Inserted ${backup.snapshot.badges.length} badges\n`);

    // Insert cadet_badges (from badgeAssignments)
    for (const assignment of backup.snapshot.badgeAssignments) {
      await client.query(
        `insert into cadet_badges 
         (id, user_id, badge_id, assigned_by, reason, assigned_at, revoked_at)
         values ($1, $2, $3, $4, $5, $6, $7)
         on conflict (id) do nothing`,
        [
          assignment.id,
          assignment.userId,
          assignment.badgeId,
          assignment.assignedBy || null,
          assignment.reason || null,
          assignment.assignedAt,
          assignment.revokedAt || null,
        ],
      );
    }

    process.stdout.write(`✓ Inserted ${backup.snapshot.badgeAssignments.length} cadet_badges\n`);

    // Insert commitments
    for (const commitment of backup.snapshot.commitments) {
      await client.query(
        `insert into commitments 
         (id, user_id, cruise_subgroup_id, status, committed_at, withdrawn_at, completed_at, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, $8)
         on conflict (id) do nothing`,
        [
          commitment.id,
          commitment.userId,
          commitment.cruiseSubgroupId,
          commitment.status,
          commitment.committedAt,
          commitment.withdrawnAt || null,
          commitment.completedAt || null,
          commitment.updatedAt,
        ],
      );
    }

    process.stdout.write(`✓ Inserted ${backup.snapshot.commitments.length} commitments\n`);

    await client.query("commit");

    process.stdout.write(`\n✅ Restore complete! Data loaded from backup at ${backup.timestamp}\n`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

run()
  .catch((error) => {
    process.stderr.write(`Restore failed: ${(error as Error).message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool?.end();
  });
