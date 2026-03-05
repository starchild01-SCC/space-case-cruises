create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('user', 'admin');
  end if;

  if not exists (select 1 from pg_type where typname = 'preferred_contact_type') then
    create type preferred_contact_type as enum ('discord', 'text', 'phone', 'email');
  end if;

  if not exists (select 1 from pg_type where typname = 'pronouns_type') then
    create type pronouns_type as enum ('they_them', 'he_him', 'she_her', 'any_all');
  end if;

  if not exists (select 1 from pg_type where typname = 'cruise_status') then
    create type cruise_status as enum ('active', 'archived');
  end if;

  if not exists (select 1 from pg_type where typname = 'tile_visibility_state') then
    create type tile_visibility_state as enum ('invisible', 'inactive', 'active');
  end if;

  if not exists (select 1 from pg_type where typname = 'commitment_status') then
    create type commitment_status as enum ('committed', 'withdrawn', 'completed');
  end if;
end $$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  playa_name text not null,
  phone_number text,
  preferred_contact preferred_contact_type,
  pronouns pronouns_type,
  avatar_url text,
  cadet_extension text,
  role user_role not null default 'user',
  is_disabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cruises (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  year integer not null check (year between 2000 and 2100),
  location text,
  starts_on date,
  ends_on date,
  map_image_url text,
  special_page_image_url text,
  casting_cost integer,
  casting_cost_url text,
  status cruise_status not null default 'active',
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  force_all_subgroups_to_dock boolean not null default false,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cruises_date_window check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table if not exists subgroups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  code text not null unique,
  default_description text,
  default_tile_image_url text,
  extension text,
  default_cost_level integer not null default 0 check (default_cost_level between 0 and 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cruise_subgroups (
  id uuid primary key default gen_random_uuid(),
  cruise_id uuid not null references cruises(id) on delete cascade,
  subgroup_id uuid not null references subgroups(id) on delete cascade,
  override_name text,
  override_description text,
  detail_image_url text,
  cost_level_override integer check (cost_level_override is null or cost_level_override between 0 and 8),
  visibility_state tile_visibility_state not null default 'inactive',
  dock_visible boolean not null default true,
  map_x double precision,
  map_y double precision,
  map_scale double precision not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cruise_subgroups_unique_pair unique (cruise_id, subgroup_id),
  constraint cruise_subgroups_map_x_range check (map_x is null or (map_x >= 0 and map_x <= 100)),
  constraint cruise_subgroups_map_y_range check (map_y is null or (map_y >= 0 and map_y <= 100)),
  constraint cruise_subgroups_map_scale_positive check (map_scale > 0)
);

create table if not exists commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  cruise_subgroup_id uuid not null references cruise_subgroups(id) on delete cascade,
  status commitment_status not null,
  committed_at timestamptz not null,
  withdrawn_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint commitments_unique_pair unique (user_id, cruise_subgroup_id)
);

create table if not exists badges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  icon_url text,
  cruise_id uuid references cruises(id) on delete set null,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists cadet_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  badge_id uuid not null references badges(id) on delete cascade,
  assigned_by uuid references users(id) on delete set null,
  reason text,
  assigned_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index if not exists cadet_badges_user_badge_active_uniq
  on cadet_badges (user_id, badge_id)
  where revoked_at is null;

create index if not exists users_email_lower_idx on users (lower(email));
create index if not exists users_cadet_extension_idx on users (cadet_extension);
create index if not exists cruises_sort_idx on cruises (sort_order, year);
create index if not exists commitments_user_idx on commitments (user_id, updated_at desc);
create index if not exists commitments_cruise_subgroup_idx on commitments (cruise_subgroup_id);
create index if not exists cruise_subgroups_cruise_idx on cruise_subgroups (cruise_id, created_at);