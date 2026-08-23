-- card-price-tracker: schema + seed
-- Run this whole file once in the Supabase SQL editor of a fresh project.

create extension if not exists "pgcrypto";

-- ============ cards ============
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null default 'Pokémon',
  grade text not null default 'Raw',
  cost_thb numeric,
  costs_thb numeric[],
  quantity integer not null default 1,
  snkrdunk_url text,
  image_url text,
  custom_image_url text,
  is_wishlist boolean not null default false,
  created_at timestamptz not null default now()
);

-- for existing projects created before category/quantity existed:
alter table public.cards add column if not exists category text not null default 'Pokémon';
alter table public.cards add column if not exists quantity integer not null default 1;

-- costs_thb: per-unit purchase price for each physical copy owned (cards can
-- be duplicates bought at different prices). cost_thb stays as the total
-- (sum of costs_thb) for fast queries/sorting; quantity = costs_thb length.
alter table public.cards add column if not exists costs_thb numeric[];
update public.cards set costs_thb = array[cost_thb] where cost_thb is not null and costs_thb is null;

-- raw_condition: SNKRDUNK ungraded condition tier (A/B/C/D), only meaningful
-- when grade = 'Raw'. Used to pick the matching sold-price history on SNKRDUNK.
alter table public.cards add column if not exists raw_condition text;

-- sold tracking: mark a card as sold with the price it actually sold for,
-- so realized profit (sold_price_thb - cost_thb) can be shown separately
-- from the unrealized profit/loss of cards still held.
alter table public.cards add column if not exists is_sold boolean not null default false;
alter table public.cards add column if not exists sold_price_thb numeric;
alter table public.cards add column if not exists sold_at timestamptz;

-- sequential_set_id: groups multiple different cards added together in one
-- batch (e.g. "Suicune / Raikou / Entei" added at once) so they can be
-- displayed clustered together. No separate "set name" — just a shared id.
alter table public.cards add column if not exists sequential_set_id uuid;

-- sold_from_card_id: when selling fewer copies than a card's quantity, the
-- sold copies split off into a new row — this points back to the original
-- row so "ยกเลิกการขาย" can merge the quantity/costs back together instead
-- of leaving a permanently separate ×1 entry.
alter table public.cards add column if not exists sold_from_card_id uuid references public.cards(id) on delete set null;

-- item_type: independent from category (which is the franchise/product line,
-- e.g. Pokémon) — distinguishes a single card from a sealed box, since a
-- sealed box can belong to any category (e.g. a Pokémon sealed box).
alter table public.cards add column if not exists item_type text not null default 'การ์ด';

-- ============ price_history ============
-- one row per price snapshot. never updated/overwritten, only inserted.
create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  market_price_jpy numeric not null,
  market_price_thb numeric not null,
  exchange_rate numeric not null,
  fetched_at timestamptz not null default now()
);

create index if not exists price_history_card_id_idx on public.price_history(card_id);
create index if not exists price_history_fetched_at_idx on public.price_history(fetched_at desc);

-- ============ RLS ============
-- Single-user personal app: no auth screen, the app reads/writes with the
-- anon key directly, and price snapshots are written by a separate browser
-- automation flow using the same anon key (or via /api/update-price using
-- the service role key). Policies are intentionally open.
alter table public.cards enable row level security;
alter table public.price_history enable row level security;

drop policy if exists "cards_allow_all" on public.cards;
create policy "cards_allow_all" on public.cards for all
  using (true) with check (true);

drop policy if exists "price_history_allow_all" on public.price_history;
create policy "price_history_allow_all" on public.price_history for all
  using (true) with check (true);

-- ============ price_alerts ============
-- per-card price target: notify (via Telegram, see lib/priceAlerts.ts) when
-- a newly-fetched market_price_jpy crosses target_price_jpy in the given
-- direction. 'above' = notify once price rises to/past target (e.g. a losing
-- card reaching breakeven, or a held card reaching a profit goal). 'below' =
-- notify once price falls to/under target (e.g. a wishlist card getting
-- cheap enough to buy). Fires once: triggered_at gets set and the alert goes
-- quiet until the user edits target_price_jpy or re-activates it (editing
-- resets triggered_at to null — see lib/priceAlerts.ts).
create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  target_price_jpy numeric not null,
  direction text not null check (direction in ('above', 'below')),
  note text,
  is_active boolean not null default true,
  triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists price_alerts_card_id_idx on public.price_alerts(card_id);

alter table public.price_alerts enable row level security;
drop policy if exists "price_alerts_allow_all" on public.price_alerts;
create policy "price_alerts_allow_all" on public.price_alerts for all
  using (true) with check (true);

-- ============ portfolio_alerts ============
-- Global (not per-card) target on total portfolio market value —
-- "การ์ดของฉัน" scope only (matches Dashboard/buildWeeklyDigest('mine')),
-- checked after every price update (lib/portfolioAlerts.ts). Same
-- once-then-arm behavior as price_alerts above.
create table if not exists public.portfolio_alerts (
  id uuid primary key default gen_random_uuid(),
  target_value_thb numeric not null,
  direction text not null check (direction in ('above', 'below')),
  note text,
  is_active boolean not null default true,
  triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.portfolio_alerts enable row level security;
drop policy if exists "portfolio_alerts_allow_all" on public.portfolio_alerts;
create policy "portfolio_alerts_allow_all" on public.portfolio_alerts for all
  using (true) with check (true);

-- ============ app_settings: telegram notification settings ============
-- app_settings itself was created manually by the user (see lib/appSettings.ts
-- for the jpy_thb_rate / site_title columns added the same way) — these two
-- columns hold the Telegram bot token + the user's personal chat id that
-- price-alert notifications get pushed to. Same row (id=1).
alter table public.app_settings add column if not exists telegram_bot_token text;
alter table public.app_settings add column if not exists telegram_chat_id text;

-- ============ storage bucket for custom card images ============
insert into storage.buckets (id, name, public)
values ('card-images', 'card-images', true)
on conflict (id) do nothing;

drop policy if exists "card_images_public_read" on storage.objects;
create policy "card_images_public_read" on storage.objects for select
  using (bucket_id = 'card-images');

drop policy if exists "card_images_public_write" on storage.objects;
create policy "card_images_public_write" on storage.objects for insert
  with check (bucket_id = 'card-images');

drop policy if exists "card_images_public_update" on storage.objects;
create policy "card_images_public_update" on storage.objects for update
  using (bucket_id = 'card-images');

drop policy if exists "card_images_public_delete" on storage.objects;
create policy "card_images_public_delete" on storage.objects for delete
  using (bucket_id = 'card-images');

-- ============ seed: 18 owned PSA10 cards ============
insert into public.cards (name, grade, cost_thb, snkrdunk_url, is_wishlist) values
('Pikachu Poncho Team Skull', 'PSA10', 344000, 'https://snkrdunk.com/apparels/91218', false),
('Pikachu Festa 2014', 'PSA10', 217000, 'https://snkrdunk.com/apparels/91407', false),
('Pikachu Festa 2017', 'PSA10', 102410, 'https://snkrdunk.com/apparels/91220', false),
('Pikachu Master Battle 2019', 'PSA10', 147500, 'https://snkrdunk.com/apparels/93060', false),
('Pikachu ex SAR MC 764/742 (จูป่า)', 'PSA10', 92950, 'https://snkrdunk.com/apparels/737036', false),
('Pikachu CP3', 'PSA10', 169000, 'https://snkrdunk.com/apparels/91489', false),
('Lugia V Paradigm', 'PSA10', 22000, 'https://snkrdunk.com/apparels/100567', false),
('Charizard ex SAR SV3 134/108 (ด้อนคริสตัล)', 'PSA10', 15000, 'https://snkrdunk.com/apparels/132279', false),
('Charizard ex SAR SV4a 349/190 (ด้อนคริสตัลไชนี่)', 'PSA10', 15400, 'https://snkrdunk.com/apparels/162095', false),
('Charizard V SR: SA S9 103/100 (ด้อนสู้กับบานะ)', 'PSA10', 11200, 'https://snkrdunk.com/apparels/91147', false),
('MEGA Charizard X ex SAR M2 110/080 (ด้อนดำ)', 'PSA10', 17410, 'https://snkrdunk.com/apparels/704401', false),
('Pikachu CHR sm11b 054/049 (จูเรด)', 'PSA10', 4890, 'https://snkrdunk.com/apparels/126664', false),
('Mew CP5', 'PSA10', 34400, 'https://snkrdunk.com/apparels/91475', false),
('Celebi CP5', 'PSA10', 12500, 'https://snkrdunk.com/apparels/106669', false),
('Lugia Bandit Ring 1ED', 'PSA10', 37600, 'https://snkrdunk.com/apparels/91514', false),
('Mewtwo CP6', 'PSA10', 50715, 'https://snkrdunk.com/apparels/91463', false),
('MEGA Gengar ex SAR M2a 240/193 High Class Pack', 'PSA10', 11690, 'https://snkrdunk.com/apparels/724996', false),
('Gengar VMAX: SA SGG 020/019 High Class Deck', 'PSA10', 69000, 'https://snkrdunk.com/apparels/91178', false);
