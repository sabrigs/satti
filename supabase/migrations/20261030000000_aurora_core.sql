-- Aurora: schema inicial (perfis, listas, itens e streamings do usuário).
-- Aplicar no projeto Supabase via SQL Editor ou `supabase db push`.

-- Perfil do usuário ------------------------------------------------------
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Listas ----------------------------------------------------------------
-- `kind` marca as três listas de sistema. Listas customizadas (futuro)
-- usam kind = 'custom'.
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('to_watch', 'watched', 'favorites', 'custom')),
  name text not null,
  created_at timestamptz not null default now(),
  unique (user_id, id)
);

create unique index lists_one_system_per_kind
  on public.lists (user_id, kind)
  where kind <> 'custom';

-- Itens de lista -------------------------------------------------------
-- Um título é identificado pelo par (tmdb_id, media_type) da TMDB API.
create table public.list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  tmdb_id integer not null,
  media_type text not null check (media_type in ('movie', 'tv')),
  title text not null,
  poster_path text,
  added_at timestamptz not null default now(),
  foreign key (user_id, list_id) references public.lists (user_id, id) on delete cascade,
  unique (list_id, tmdb_id, media_type)
);

create index list_items_list_added_idx on public.list_items (list_id, added_at desc);

-- Invariantes entre listas de sistema ----------------------------------
-- 1. Um título não pode estar em "to_watch" e "watched" ao mesmo tempo.
-- 2. Um título só pode estar em "favorites" se também estiver em "watched".
-- "Favorites" não é alterada automaticamente ao remover de "watched".
create or replace function public.enforce_list_rules()
returns trigger
language plpgsql
as $$
declare
  target_kind text;
begin
  select kind into target_kind from public.lists where id = new.list_id;

  if target_kind = 'to_watch' and exists (
    select 1 from public.list_items li
    join public.lists l on l.id = li.list_id
    where li.user_id = new.user_id
      and li.tmdb_id = new.tmdb_id
      and li.media_type = new.media_type
      and l.kind = 'watched'
  ) then
    raise exception 'title_already_watched' using errcode = 'P0001';
  end if;

  if target_kind = 'watched' and exists (
    select 1 from public.list_items li
    join public.lists l on l.id = li.list_id
    where li.user_id = new.user_id
      and li.tmdb_id = new.tmdb_id
      and li.media_type = new.media_type
      and l.kind = 'to_watch'
  ) then
    raise exception 'title_still_to_watch' using errcode = 'P0001';
  end if;

  if target_kind = 'favorites' and not exists (
    select 1 from public.list_items li
    join public.lists l on l.id = li.list_id
    where li.user_id = new.user_id
      and li.tmdb_id = new.tmdb_id
      and li.media_type = new.media_type
      and l.kind = 'watched'
  ) then
    raise exception 'favorite_requires_watched' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger list_items_enforce_rules
  before insert on public.list_items
  for each row execute function public.enforce_list_rules();

-- Streamings do usuário --------------------------------------------------
-- provider_id é o id do provedor na TMDB API (watch providers).
create table public.user_streamings (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider_id integer not null,
  provider_name text not null,
  logo_path text,
  created_at timestamptz not null default now(),
  primary key (user_id, provider_id)
);

-- Criação automática no primeiro login ----------------------------------
-- Cria o perfil e as três listas de sistema para cada novo usuário.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id) values (new.id);
  insert into public.lists (user_id, kind, name) values
    (new.id, 'to_watch', 'To watch'),
    (new.id, 'watched', 'Watched'),
    (new.id, 'favorites', 'Favorites');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS: cada usuário acessa apenas os próprios dados -----------------------
alter table public.profiles enable row level security;
alter table public.lists enable row level security;
alter table public.list_items enable row level security;
alter table public.user_streamings enable row level security;

create policy "own profile" on public.profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own lists" on public.lists
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own list items" on public.list_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own streamings" on public.user_streamings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
