--
-- PostgreSQL database dump
--

\restrict 24s5NBC7NHuR1Ni0fQe0UiC90Ucpvw8bARK6ia11BRUANgWGIUPZO3FEafKH66Q

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: commitment_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.commitment_status AS ENUM (
    'committed',
    'withdrawn',
    'completed'
);


ALTER TYPE public.commitment_status OWNER TO postgres;

--
-- Name: cruise_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.cruise_status AS ENUM (
    'active',
    'archived'
);


ALTER TYPE public.cruise_status OWNER TO postgres;

--
-- Name: preferred_contact_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.preferred_contact_type AS ENUM (
    'discord',
    'text',
    'phone',
    'email'
);


ALTER TYPE public.preferred_contact_type OWNER TO postgres;

--
-- Name: pronouns_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.pronouns_type AS ENUM (
    'they_them',
    'he_him',
    'she_her',
    'any_all'
);


ALTER TYPE public.pronouns_type OWNER TO postgres;

--
-- Name: tile_visibility_state; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.tile_visibility_state AS ENUM (
    'invisible',
    'inactive',
    'active'
);


ALTER TYPE public.tile_visibility_state OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'user',
    'admin'
);


ALTER TYPE public.user_role OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: badges; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.badges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    icon_url text,
    cruise_id uuid,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.badges OWNER TO postgres;

--
-- Name: cadet_badges; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cadet_badges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    badge_id uuid NOT NULL,
    assigned_by uuid,
    reason text,
    assigned_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone
);


ALTER TABLE public.cadet_badges OWNER TO postgres;

--
-- Name: commitments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.commitments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    cruise_subgroup_id uuid NOT NULL,
    status public.commitment_status NOT NULL,
    committed_at timestamp with time zone NOT NULL,
    withdrawn_at timestamp with time zone,
    completed_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.commitments OWNER TO postgres;

--
-- Name: cruise_subgroups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cruise_subgroups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    cruise_id uuid NOT NULL,
    subgroup_id uuid NOT NULL,
    override_name text,
    override_description text,
    detail_image_url text,
    cost_level_override integer,
    visibility_state public.tile_visibility_state DEFAULT 'inactive'::public.tile_visibility_state NOT NULL,
    dock_visible boolean DEFAULT true NOT NULL,
    map_x double precision,
    map_y double precision,
    map_scale double precision DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cruise_subgroups_cost_level_override_check CHECK (((cost_level_override IS NULL) OR ((cost_level_override >= 0) AND (cost_level_override <= 8)))),
    CONSTRAINT cruise_subgroups_map_scale_positive CHECK ((map_scale > (0)::double precision)),
    CONSTRAINT cruise_subgroups_map_x_range CHECK (((map_x IS NULL) OR ((map_x >= (0)::double precision) AND (map_x <= (100)::double precision)))),
    CONSTRAINT cruise_subgroups_map_y_range CHECK (((map_y IS NULL) OR ((map_y >= (0)::double precision) AND (map_y <= (100)::double precision))))
);


ALTER TABLE public.cruise_subgroups OWNER TO postgres;

--
-- Name: cruises; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.cruises (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    year integer NOT NULL,
    location text,
    starts_on date,
    ends_on date,
    map_image_url text,
    special_page_image_url text,
    casting_cost integer,
    casting_cost_url text,
    status public.cruise_status DEFAULT 'active'::public.cruise_status NOT NULL,
    is_featured boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    force_all_subgroups_to_dock boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT cruises_date_window CHECK (((ends_on IS NULL) OR (starts_on IS NULL) OR (ends_on >= starts_on))),
    CONSTRAINT cruises_year_check CHECK (((year >= 2000) AND (year <= 2100)))
);


ALTER TABLE public.cruises OWNER TO postgres;

--
-- Name: subgroups; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.subgroups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    code text NOT NULL,
    default_description text,
    default_tile_image_url text,
    extension text,
    default_cost_level integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT subgroups_default_cost_level_check CHECK (((default_cost_level >= 0) AND (default_cost_level <= 8)))
);


ALTER TABLE public.subgroups OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    playa_name text NOT NULL,
    phone_number text,
    preferred_contact public.preferred_contact_type,
    pronouns public.pronouns_type,
    avatar_url text,
    cadet_extension text,
    role public.user_role DEFAULT 'user'::public.user_role NOT NULL,
    is_disabled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Data for Name: badges; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.badges (id, name, description, icon_url, cruise_id, created_by, created_at, updated_at) FROM stdin;
233d51fa-84c6-4f08-8964-789a936c8617	Builder	Helped build infrastructure	\N	\N	\N	2026-02-23 23:58:06.529+00	2026-02-23 23:58:06.529+00
\.


--
-- Data for Name: cadet_badges; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cadet_badges (id, user_id, badge_id, assigned_by, reason, assigned_at, revoked_at) FROM stdin;
\.


--
-- Data for Name: commitments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.commitments (id, user_id, cruise_subgroup_id, status, committed_at, withdrawn_at, completed_at, updated_at) FROM stdin;
0699765f-47a5-4a66-a4a4-2409f74f7f90	8a78b3c4-a41c-4367-a69b-c032a15ab362	de356663-a8bb-41ab-b169-bb0db564f2b0	committed	2026-02-25 02:05:00.241+00	\N	\N	2026-02-25 02:05:00.241+00
31ec0132-fec7-405a-8fdf-a52b57b3d52f	8a78b3c4-a41c-4367-a69b-c032a15ab362	6e17058f-060d-48b7-bfde-76eff4e07b44	committed	2026-02-25 03:14:22.948+00	\N	\N	2026-02-25 03:14:22.948+00
9c414673-ac73-4309-8383-3c50d1ac3523	8a78b3c4-a41c-4367-a69b-c032a15ab362	0ec5b014-f678-41aa-902c-be4c021bf5c4	committed	2026-02-26 05:11:26.173+00	\N	\N	2026-02-26 05:11:26.173+00
78a5a438-487e-4831-b797-8062b9683211	8a78b3c4-a41c-4367-a69b-c032a15ab362	e42df121-778b-4d6b-b368-fb3ee5c813ee	committed	2026-02-26 05:11:38.004+00	\N	\N	2026-02-26 05:11:38.004+00
f75bf0f6-7557-46ff-ad40-d4ca83394082	8a78b3c4-a41c-4367-a69b-c032a15ab362	7695c0fd-777f-4eae-b9aa-27497fac383a	committed	2026-02-27 20:26:54.887+00	\N	\N	2026-02-27 20:26:54.887+00
ca3a4d92-2210-4613-8a61-bbd64878a1cd	8a78b3c4-a41c-4367-a69b-c032a15ab362	46bbc9b4-c0ba-4037-8020-19519dedfbcc	committed	2026-03-01 19:59:00.206+00	\N	\N	2026-03-01 19:59:00.206+00
\.


--
-- Data for Name: cruise_subgroups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cruise_subgroups (id, cruise_id, subgroup_id, override_name, override_description, detail_image_url, cost_level_override, visibility_state, dock_visible, map_x, map_y, map_scale, created_at, updated_at) FROM stdin;
0ec5b014-f678-41aa-902c-be4c021bf5c4	12573979-29c2-4136-b2eb-0f4d65290130	81164308-d1f2-4611-852d-5066293c5b4c	\N	\N	http://localhost:4000/uploads/subgroups/posters/soot-cinder-burning-man--poster--81164308-d1f2-4611-852d---1771911181994.jpg	\N	inactive	t	79.62	41.26	1	2026-02-23 23:58:06.529+00	2026-02-26 04:59:11.749+00
aa4c0b95-312f-4e6b-ae9f-da6edfe14b40	12573979-29c2-4136-b2eb-0f4d65290130	01f6dd71-9894-422b-b536-65f5eb536af1	Star Cinq	Communications	http://localhost:4000/uploads/subgroups/posters/star-cinq-burning-man--poster--01f6dd71-9894-422b-b536---1771911036917.jpg	\N	inactive	t	\N	\N	1	2026-02-24 01:56:01.284+00	2026-02-26 04:58:40.207+00
0f29f7f9-2395-4134-a4f7-6be79b771307	50c6aa9d-d367-4176-a0ef-6c30a0efd4ad	758ced5a-818e-4de0-a7dc-4ba3d8f57ace	Sexy Call Centerr HOP	Ooh, la la la	http://localhost:4000/uploads/subgroups/posters/sexy-call-center--poster--1772081772176.jpg	\N	inactive	t	\N	\N	1	2026-02-26 05:01:00.985+00	2026-02-26 05:01:10.456+00
e5f81512-a07f-4de0-9f17-acc3b923e03c	50c6aa9d-d367-4176-a0ef-6c30a0efd4ad	3a73fd8c-15a8-41c5-bd13-6feaea198741	□ ○ ○	□ ○ ○□ ○ ○□ ○ ○□ ○ ○□ ○ ○□ ○ ○□ ○ ○	http://localhost:4000/uploads/subgroups/posters/image--poster--1772082197905.jpg	\N	inactive	t	\N	\N	1	2026-02-26 05:16:23.727+00	2026-02-26 05:20:15.811+00
0c30f2c4-500a-4eb9-9c3a-53db63345579	b25e7896-17a2-40dd-91dc-030c1351cf2b	4e9d5541-2650-4a6f-be26-a7a7e78064c2	Super Charge Crystal	Unhinged Power	http://192.168.1.225:4000/api/uploads/subgroups/posters/super-charge-crystal-that-thing-at-the-cabin--poster--4e9d5541-2650-4a6f-be26---1772685648502.jpg	\N	active	f	68.24	54.13	1	2026-02-24 05:34:24.619+00	2026-03-05 04:40:50.52822+00
ce1bb3c8-b702-4331-8041-e840348eb801	b25e7896-17a2-40dd-91dc-030c1351cf2b	b3d60d72-b996-4f0e-bde6-8e25adda25ef	\N	\N	http://localhost:4000/uploads/subgroups/posters/build-that-thing-at-the-cabin--poster--b3d60d72-b996-4f0e-bde6---1771892481237.jpg	\N	inactive	t	\N	\N	1	2026-02-24 00:21:28.219+00	2026-03-05 04:40:21.292078+00
912e5cc8-fc40-4dc5-87ad-dd166eb0ce7b	b25e7896-17a2-40dd-91dc-030c1351cf2b	87b23d3b-dbd7-4ac5-bc25-d76244d22311	Steeping Charm	Cafe	http://localhost:4000/uploads/subgroups/posters/steeping-charm-that-thing-at-the-cabin--poster--87b23d3b-dbd7-4ac5-bc25---1771912219913.jpg	\N	inactive	t	\N	\N	1	2026-02-24 00:24:13.427+00	2026-03-05 04:40:21.292078+00
7695c0fd-777f-4eae-b9aa-27497fac383a	b25e7896-17a2-40dd-91dc-030c1351cf2b	7502cc11-39f4-4221-8895-f4ce15b2faca	Sleep Cloud Caravansari	Caravansari for Pets and Travellers	http://localhost:4000/uploads/subgroups/posters/sleeping-cloud-that-thing-at-the-cabin--poster--7502cc11-39f4-4221-8895---1772223982912.jpg	\N	active	f	35.87	54.02	1	2026-02-24 01:17:32.594+00	2026-03-05 04:40:21.292078+00
20a0a586-9f1f-4d3e-83cf-a45e66447424	b25e7896-17a2-40dd-91dc-030c1351cf2b	95e077ad-4e88-46a4-8b5b-cb9909adf156	Sassy Cyber Circus	Circus	http://localhost:4000/uploads/subgroups/posters/sassy-cyber-circus--poster--1771901927969.jpg	\N	active	f	53.87	43.32	1	2026-02-24 02:58:58.903+00	2026-03-05 04:40:21.292078+00
43ac00d9-7a25-40fc-ba52-c72bc4d3adf9	b25e7896-17a2-40dd-91dc-030c1351cf2b	4d53c457-6be1-4b19-aaee-bf9742c007c3	Ticket Booth	Sale & Connection	http://localhost:4000/uploads/subgroups/posters/ticket-booth-that-thing-at-the-cabin--poster--4d53c457-6be1-4b19-aaee---1771911168580.jpg	\N	inactive	t	\N	\N	1	2026-02-24 04:52:45.613+00	2026-03-05 04:40:21.292078+00
42b11a0a-884e-47e9-a4b8-7a6b31147af0	b25e7896-17a2-40dd-91dc-030c1351cf2b	59d46d2c-2f8d-40d2-8f91-9540c3188a1a	Safety Care Center	Burner Care	/api/uploads/subgroups/posters/safety-care-center--poster--1771911448413.jpg	\N	active	f	24.74	62.11	1	2026-02-24 05:37:29.966+00	2026-03-05 04:40:21.292078+00
de356663-a8bb-41ab-b169-bb0db564f2b0	b25e7896-17a2-40dd-91dc-030c1351cf2b	626678cc-d044-4301-8612-646e01930eca	Still-Life Capture & Conserve	\N	http://localhost:4000/uploads/subgroups/posters/still-life-capture-conserve--poster--1771984336266.png	\N	inactive	t	\N	\N	1	2026-02-25 01:52:21.895+00	2026-03-05 04:40:21.292078+00
e42df121-778b-4d6b-b368-fb3ee5c813ee	b25e7896-17a2-40dd-91dc-030c1351cf2b	94626446-8364-4ace-b393-4073131bdfc8	Soot & Cinder	Fire Conclave	http://localhost:4000/uploads/subgroups/posters/soot-cinder--poster--1771984564013.jpg	\N	inactive	t	\N	\N	1	2026-02-25 01:56:14.425+00	2026-03-05 04:40:21.292078+00
d7844515-a5da-431d-b123-b81910687448	b25e7896-17a2-40dd-91dc-030c1351cf2b	f48bdfe3-1831-4a20-bc00-e592833a79d0	Sacred-Sound Calm Cove	Calmness, Joy	http://localhost:4000/uploads/subgroups/posters/sacred-sound-calm-cove--poster--1771988497412.jpg	\N	inactive	t	\N	\N	1	2026-02-25 03:01:42.121+00	2026-03-05 04:40:21.292078+00
16fa14eb-f980-4211-a5f8-95a03bbbe466	b25e7896-17a2-40dd-91dc-030c1351cf2b	c6cab28a-24d0-4586-8e4c-184771ac628c	Septic Care	Nobody cares more about your shit	http://localhost:4000/uploads/subgroups/posters/septic-care--poster--1771988697612.png	\N	inactive	t	\N	\N	1	2026-02-25 03:04:58.858+00	2026-03-05 04:40:21.292078+00
22f266ff-aa79-4380-8e21-f4e6efa77bdf	b25e7896-17a2-40dd-91dc-030c1351cf2b	0b191b6f-340f-4fc2-bd4e-cc3657f7dea5	Skyward Circus Company	Fly Freaks Unite!	http://localhost:4000/uploads/subgroups/posters/skyward-circus-company--poster--1771988884434.jpg	\N	inactive	t	\N	\N	1	2026-02-25 03:08:06.327+00	2026-03-05 04:40:21.292078+00
6e17058f-060d-48b7-bfde-76eff4e07b44	b25e7896-17a2-40dd-91dc-030c1351cf2b	0a9fdd99-5fa8-415c-a0d6-b15486f9ad03	□ ○ ○	Music makes you lose control	http://localhost:4000/uploads/subgroups/posters/image--poster--1771989036954.jpg	\N	inactive	t	\N	\N	1	2026-02-25 03:10:38.964+00	2026-03-05 04:40:21.292078+00
1650e467-f4d2-4803-b5d3-6e6a69b260f8	b25e7896-17a2-40dd-91dc-030c1351cf2b	35edee35-3f94-435c-8cc1-aa8ac61328bb	Superb Craft Cocktails	Specializing in Cocktails, Mocktails, and Tea Cocktails!	http://localhost:4000/uploads/subgroups/posters/superb-craft-cocktails--poster--1771989118969.jpg	\N	inactive	t	\N	\N	1	2026-02-25 03:12:01.104+00	2026-03-05 04:40:21.292078+00
46bbc9b4-c0ba-4037-8020-19519dedfbcc	b25e7896-17a2-40dd-91dc-030c1351cf2b	d8d481df-c5c7-4c76-b644-03d66f3f98ed	Space Catering	Eat and Be Merry	http://localhost:4000/uploads/subgroups/posters/space-catering--poster--1771990505883.png	\N	active	f	50.85	74.9	1	2026-02-25 03:35:07.6+00	2026-03-05 04:40:21.292078+00
05880452-7853-40f0-986b-f7729a45327a	b25e7896-17a2-40dd-91dc-030c1351cf2b	3c0e7430-2e94-49e7-8aaa-3803596c71ae	Stellar Cargo Carrier	Shipping Cargo w/ Care	http://localhost:4000/uploads/subgroups/posters/stellar-cargo-carrier--poster--1771991270894.png	\N	inactive	t	\N	\N	1	2026-02-25 03:48:07.177+00	2026-03-05 04:40:21.292078+00
25ab467b-85ae-4689-b1a6-bcfa878e447d	b25e7896-17a2-40dd-91dc-030c1351cf2b	879a5975-ed8f-4fc5-b6cc-192ebf856da8	Secret Candy Cove	Snacks, Candy & Concessions	http://localhost:4000/uploads/subgroups/posters/secret-candy-cove--poster--1771991371577.jpg	\N	inactive	t	\N	\N	1	2026-02-25 03:49:41.099+00	2026-03-05 04:40:21.292078+00
66ca55e3-8154-436f-8b7f-2d90b9540275	b25e7896-17a2-40dd-91dc-030c1351cf2b	c97b0278-c9f9-4b3a-b22c-a279d98bebf3	Sexy Call Center	Yum!	/api/uploads/subgroups/posters/sexy-call-center--poster--1771988771419.jpg	\N	active	f	\N	\N	1	2026-02-25 03:06:12.657+00	2026-03-05 04:40:34.163678+00
\.


--
-- Data for Name: cruises; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.cruises (id, name, year, location, starts_on, ends_on, map_image_url, special_page_image_url, casting_cost, casting_cost_url, status, is_featured, sort_order, force_all_subgroups_to_dock, created_by, created_at, updated_at) FROM stdin;
12573979-29c2-4136-b2eb-0f4d65290130	Burning Man	2026	Black Rock City	2026-08-24	2026-09-01	http://localhost:4000/uploads/cruises/maps/space-case-cruise--map--12573979-29c2-4136-b2eb---1771891819782.jpg	http://localhost:4000/uploads/cruises/special/burning-man--special--12573979-29c2-4136-b2eb---1771992346612.webp	8	https://burningman.org/black-rock-city/ticketing-information/	active	t	1	f	\N	2026-02-23 23:58:06.529+00	2026-02-25 22:09:47.361+00
b25e7896-17a2-40dd-91dc-030c1351cf2b	That Thing At The Cabin	2026	Cabin	2026-07-10	2026-07-14	http://localhost:4000/uploads/cruises/maps/that-thing-at-the-cabin--map--b25e7896-17a2-40dd-91dc---1771984665136.png	http://localhost:4000/uploads/cruises/special/that-thing-at-the-cabin--special--1771891897067.jpg	3	https://www.ttatc.com/tickets/	active	t	0	f	\N	2026-02-24 00:11:42.273+00	2026-02-25 22:08:23.358+00
50c6aa9d-d367-4176-a0ef-6c30a0efd4ad	Hearts O' Phyre	2026	Iowa	2026-08-30	2026-09-02	http://localhost:4000/uploads/cruises/maps/hearts-o-phyre--map--1771891955681.jpg	http://localhost:4000/uploads/cruises/special/hearts-o-phyre--special--1771891983162.jpg	2	https://hearthsophyre.org/tickets	active	t	0	f	\N	2026-02-24 00:13:07.61+00	2026-02-25 22:09:09.261+00
\.


--
-- Data for Name: subgroups; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.subgroups (id, name, slug, code, default_description, default_tile_image_url, extension, default_cost_level, created_at, updated_at) FROM stdin;
81164308-d1f2-4611-852d-5066293c5b4c	Soot & CInder	comms	COMMS	Fire Conclave	http://localhost:4000/uploads/subgroups/tiles/soot-cinder--tile--81164308-d1f2-4611-852d---1771983451964.jpg	3473	4	2026-02-23 23:58:06.529+00	2026-02-26 04:59:11.668+00
b3d60d72-b996-4f0e-bde6-8e25adda25ef	Star Cinq	build	BUILD	Communication Center	http://localhost:4000/uploads/subgroups/tiles/star-cinq--tile--b3d60d72-b996-4f0e-bde6---1771983464381.jpg	2666	2	2026-02-23 23:58:06.529+00	2026-02-25 03:38:12.377+00
87b23d3b-dbd7-4ac5-bc25-d76244d22311	Steeping Char Cafem	steeping-charm	STEEPING_CHARM	Cafe	http://localhost:4000/uploads/subgroups/tiles/steeping-char-cafem--tile--87b23d3b-dbd7-4ac5-bc25---1771983475544.jpg	4832	3	2026-02-24 00:24:13.395+00	2026-02-26 04:59:00.636+00
7502cc11-39f4-4221-8895-f4ce15b2faca	Sleeping Cloud	sleep-cloud-caravansari	SLEEP_CLOUD_CARAVANSARI	Caravansari for Pets and Travellers	http://localhost:4000/uploads/subgroups/tiles/sleep-cloud-caravansarai--tile--7502cc11-39f4-4221-8895---1771983505455.jpg	5632	2	2026-02-24 01:17:32.563+00	2026-02-27 20:26:30.507+00
01f6dd71-9894-422b-b536-65f5eb536af1	Star Cinq	star-cinq	STAR_CINQ	Communications	http://localhost:4000/uploads/subgroups/tiles/star-cinq--tile--01f6dd71-9894-422b-b536---1771983519231.jpg	\N	4	2026-02-24 01:56:01.239+00	2026-02-26 04:58:40.12+00
95e077ad-4e88-46a4-8b5b-cb9909adf156	Sassy Cyber Circus	sassy-cyber-circus	SASSY_CYBER_CIRCUS	Circus	http://localhost:4000/uploads/subgroups/tiles/sassy-cyber-circus--tile--95e077ad-4e88-46a4-8b5b---1771983535281.jpg	7277	6	2026-02-24 02:58:58.848+00	2026-02-27 04:33:20.796+00
4d53c457-6be1-4b19-aaee-bf9742c007c3	Ticket Booth	ticket-booth	TICKET_BOOTH	Sale & Connection	http://localhost:4000/uploads/subgroups/tiles/ticket-booth--tile--4d53c457-6be1-4b19-aaee---1771983546701.jpg	\N	2	2026-02-24 04:52:45.564+00	2026-02-25 03:24:00.24+00
626678cc-d044-4301-8612-646e01930eca	Still-Life Capture & Conserve	still-life-capture-conserve	STILLLIFE_CAPTURE_CONSERVE	\N	http://localhost:4000/uploads/subgroups/tiles/still-life-capture-conserve--tile--1771983591293.jpg	7845	2	2026-02-25 01:52:21.828+00	2026-02-26 04:58:17.806+00
94626446-8364-4ace-b393-4073131bdfc8	Soot & Cinder	soot-cinder	SOOT_CINDER	Fire Conclave	http://localhost:4000/uploads/subgroups/tiles/soot-cinder--tile--1771984545631.jpg	\N	4	2026-02-25 01:56:14.358+00	2026-02-26 04:58:18.589+00
f48bdfe3-1831-4a20-bc00-e592833a79d0	Sacred-Sound Calm Cove	sacred-sound-calm-cove	SACREDSOUND_CALM_COVE	Calmness, Joy	http://localhost:4000/uploads/subgroups/tiles/sacred-sound-calm-cove--tile--1771988444973.png	2683	2	2026-02-25 03:01:42.049+00	2026-02-26 04:58:19.606+00
c6cab28a-24d0-4586-8e4c-184771ac628c	Septic Care	septic-care	SEPTIC_CARE	Nobody cares more about your shit	http://localhost:4000/uploads/subgroups/tiles/septic-care--tile--1771988594709.jpg	\N	2	2026-02-25 03:04:58.782+00	2026-02-25 03:25:46.709+00
0b191b6f-340f-4fc2-bd4e-cc3657f7dea5	Skyward Circus Company	skyward-circus-company	SKYWARD_CIRCUS_COMPANY	Fly Freaks Unite!	http://localhost:4000/uploads/subgroups/tiles/skyward-circus-company--tile--1771988874981.png	4759	3	2026-02-25 03:08:06.249+00	2026-02-25 03:40:17.245+00
0a9fdd99-5fa8-415c-a0d6-b15486f9ad03	▨ ○ ○	subgroup	SUBGROUP	Music makes you lose control	http://localhost:4000/uploads/subgroups/tiles/image--tile--1771989025331.png	7200	3	2026-02-25 03:10:38.881+00	2026-02-26 05:19:29.084+00
35edee35-3f94-435c-8cc1-aa8ac61328bb	Superb Craft Cocktails	superb-craft-cocktails	SUPERB_CRAFT_COCKTAILS	Specializing in Cocktails, Mocktails, and Tea Cocktails!	http://localhost:4000/uploads/subgroups/tiles/superb-craft-cocktails--tile--1771989107837.jpg	4225	5	2026-02-25 03:12:01.065+00	2026-02-25 03:40:35.978+00
d8d481df-c5c7-4c76-b644-03d66f3f98ed	Space Catering	space-catering	SPACE_CATERING	Eat and Be Merry	http://localhost:4000/uploads/subgroups/tiles/space-catering--tile--1771990046197.png	\N	0	2026-02-25 03:35:07.513+00	2026-03-01 20:02:15.485+00
3c0e7430-2e94-49e7-8aaa-3803596c71ae	Stellar Cargo Carrier	stellar-cargo-carrier	STELLAR_CARGO_CARRIER	Shipping Cargo w/ Care	http://localhost:4000/uploads/subgroups/tiles/space-cargo-carrier--tile--1771990971732.jpg	\N	3	2026-02-25 03:48:07.096+00	2026-02-25 03:48:07.096+00
879a5975-ed8f-4fc5-b6cc-192ebf856da8	Secret Candy Cove	secret-candy-cove	SECRET_CANDY_COVE	Snacks, Candy & Concessions	http://localhost:4000/uploads/subgroups/tiles/secret-candy-cove--tile--1771991354456.png	\N	6	2026-02-25 03:49:41.015+00	2026-02-25 03:49:41.015+00
758ced5a-818e-4de0-a7dc-4ba3d8f57ace	Sexy Call Centerr	sexy-call-centerr-hop	SEXY_CALL_CENTERR_HOP	Ooh, la la la	http://localhost:4000/uploads/subgroups/tiles/sexy-call-center--tile--1772081716878.png	\N	2	2026-02-26 05:01:00.903+00	2026-02-26 05:01:10.37+00
3a73fd8c-15a8-41c5-bd13-6feaea198741	▨ ○ ○	subgroup-2	SUBGROUP_2	□ ○ ○□ ○ ○□ ○ ○□ ○ ○□ ○ ○□ ○ ○□ ○ ○	http://localhost:4000/uploads/subgroups/tiles/image--tile--1772082179010.png	7200	2	2026-02-26 05:16:23.718+00	2026-02-26 05:20:15.72+00
59d46d2c-2f8d-40d2-8f91-9540c3188a1a	Safety Care Center	safety-care-center	SAFETY_CARE_CENTER	Burner Care	/api/uploads/subgroups/tiles/safety-care-center--tile--59d46d2c-2f8d-40d2-8f91---1771983582507.jpg	\N	2	2026-02-24 05:37:29.919+00	2026-03-05 04:40:07.580447+00
c97b0278-c9f9-4b3a-b22c-a279d98bebf3	Sexy Call Center	sexy-call-center	SEXY_CALL_CENTER	Yum!	/api/uploads/subgroups/tiles/sexy-call-center--tile--c97b0278-c9f9-4b3a-b22c---1772083408235.png	6969	2	2026-02-25 03:06:12.581+00	2026-03-05 04:40:33.730435+00
4e9d5541-2650-4a6f-be26-a7a7e78064c2	Super Charge Crystal	super-charge-crystal	SUPER_CHARGE_CRYSTAL	Unhinged Power	/api/uploads/subgroups/tiles/super-charge-crystal--tile--4e9d5541-2650-4a6f-be26---1771981543489.png	\N	2	2026-02-24 05:34:24.556+00	2026-03-05 04:40:50.314943+00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, email, playa_name, phone_number, preferred_contact, pronouns, avatar_url, cadet_extension, role, is_disabled, created_at, updated_at) FROM stdin;
8a78b3c4-a41c-4367-a69b-c032a15ab362	starchild01@gmail.com	Vaga Lume	6127198671	discord	any_all	http://localhost:4000/uploads/cadets/avatars/vaga-lume--avatar--8a78b3c4-a41c-4367-a69b---1771985127079.webp	\N	admin	f	2026-02-24 23:33:12.789+00	2026-02-27 19:52:01.035+00
6d44631e-82b6-4877-b75a-7cddc0e4f0ae	derrick.lundberg@gmail.com	Derrick Lundberg	\N	\N	\N	\N	\N	user	f	2026-03-01 20:13:05.371+00	2026-03-01 20:13:05.371+00
\.


--
-- Name: badges badges_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_pkey PRIMARY KEY (id);


--
-- Name: cadet_badges cadet_badges_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cadet_badges
    ADD CONSTRAINT cadet_badges_pkey PRIMARY KEY (id);


--
-- Name: commitments commitments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commitments
    ADD CONSTRAINT commitments_pkey PRIMARY KEY (id);


--
-- Name: commitments commitments_unique_pair; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commitments
    ADD CONSTRAINT commitments_unique_pair UNIQUE (user_id, cruise_subgroup_id);


--
-- Name: cruise_subgroups cruise_subgroups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cruise_subgroups
    ADD CONSTRAINT cruise_subgroups_pkey PRIMARY KEY (id);


--
-- Name: cruise_subgroups cruise_subgroups_unique_pair; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cruise_subgroups
    ADD CONSTRAINT cruise_subgroups_unique_pair UNIQUE (cruise_id, subgroup_id);


--
-- Name: cruises cruises_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cruises
    ADD CONSTRAINT cruises_pkey PRIMARY KEY (id);


--
-- Name: subgroups subgroups_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subgroups
    ADD CONSTRAINT subgroups_code_key UNIQUE (code);


--
-- Name: subgroups subgroups_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subgroups
    ADD CONSTRAINT subgroups_pkey PRIMARY KEY (id);


--
-- Name: subgroups subgroups_slug_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.subgroups
    ADD CONSTRAINT subgroups_slug_key UNIQUE (slug);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: cadet_badges_user_badge_active_uniq; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX cadet_badges_user_badge_active_uniq ON public.cadet_badges USING btree (user_id, badge_id) WHERE (revoked_at IS NULL);


--
-- Name: commitments_cruise_subgroup_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX commitments_cruise_subgroup_idx ON public.commitments USING btree (cruise_subgroup_id);


--
-- Name: commitments_user_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX commitments_user_idx ON public.commitments USING btree (user_id, updated_at DESC);


--
-- Name: cruise_subgroups_cruise_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cruise_subgroups_cruise_idx ON public.cruise_subgroups USING btree (cruise_id, created_at);


--
-- Name: cruises_sort_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX cruises_sort_idx ON public.cruises USING btree (sort_order, year);


--
-- Name: users_cadet_extension_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_cadet_extension_idx ON public.users USING btree (cadet_extension);


--
-- Name: users_email_lower_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX users_email_lower_idx ON public.users USING btree (lower(email));


--
-- Name: badges badges_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: badges badges_cruise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_cruise_id_fkey FOREIGN KEY (cruise_id) REFERENCES public.cruises(id) ON DELETE SET NULL;


--
-- Name: cadet_badges cadet_badges_assigned_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cadet_badges
    ADD CONSTRAINT cadet_badges_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: cadet_badges cadet_badges_badge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cadet_badges
    ADD CONSTRAINT cadet_badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES public.badges(id) ON DELETE CASCADE;


--
-- Name: cadet_badges cadet_badges_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cadet_badges
    ADD CONSTRAINT cadet_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: commitments commitments_cruise_subgroup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commitments
    ADD CONSTRAINT commitments_cruise_subgroup_id_fkey FOREIGN KEY (cruise_subgroup_id) REFERENCES public.cruise_subgroups(id) ON DELETE CASCADE;


--
-- Name: commitments commitments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.commitments
    ADD CONSTRAINT commitments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: cruise_subgroups cruise_subgroups_cruise_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cruise_subgroups
    ADD CONSTRAINT cruise_subgroups_cruise_id_fkey FOREIGN KEY (cruise_id) REFERENCES public.cruises(id) ON DELETE CASCADE;


--
-- Name: cruise_subgroups cruise_subgroups_subgroup_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cruise_subgroups
    ADD CONSTRAINT cruise_subgroups_subgroup_id_fkey FOREIGN KEY (subgroup_id) REFERENCES public.subgroups(id) ON DELETE CASCADE;


--
-- Name: cruises cruises_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.cruises
    ADD CONSTRAINT cruises_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict 24s5NBC7NHuR1Ni0fQe0UiC90Ucpvw8bARK6ia11BRUANgWGIUPZO3FEafKH66Q

