-- card-price-tracker: schema + seed
-- Run this whole file once in the Supabase SQL editor of a fresh project.

create extension if not exists "pgcrypto";

-- ============ cards ============
create table if not exists public.cards (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    grade text not null default 'Raw',
    cost_thb numeric,
    snkrdunk_url text,
    image_url text,
    custom_image_url text,
    is_wishlist boolean not null default false,
    created_at timestamptz not null default now()
  );

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
alter table public.cards enable row level security;
alter table public.price_history enable row level security;

drop policy if exists "cards_allow_all" on public.cards;
create policy "cards_allow_all" on public.cards for all
  using (true) with check (true);

drop policy if exists "price_history_allow_all" on public.price_history;
create policy "price_history_allow_all" on public.price_history for all
  using (true) with check (true);

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
