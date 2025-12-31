-- BOARDS
create table if not exists public.boards (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled board',
  description text,
  is_trashed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- BOARD MEMBERS (collaboration)
create table if not exists public.board_members (
  board_id uuid not null references public.boards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);

-- BOARD ITEMS (cards on canvas)
create table if not exists public.board_items (
  id uuid primary key default gen_random_uuid(),
  board_id uuid not null references public.boards(id) on delete cascade,
  type text not null check (type in ('note','link','todo','image','line','column','board_ref')),
  title text,
  content jsonb not null default '{}'::jsonb,
  x double precision not null default 0,
  y double precision not null default 0,
  w double precision not null default 320,
  h double precision not null default 160,
  rotation double precision not null default 0,
  z_index int not null default 0,
  parent_item_id uuid references public.board_items(id) on delete set null,
  is_trashed boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- COMMENTS
create table if not exists public.board_item_comments (
  id uuid primary key default gen_random_uuid(),
  board_item_id uuid not null references public.board_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- Updated_at triggers
create or replace function public.touch_updated_at()
returns trigger language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_boards_updated on public.boards;
create trigger trg_boards_updated before update on public.boards
for each row execute function public.touch_updated_at();

drop trigger if exists trg_items_updated on public.board_items;
create trigger trg_items_updated before update on public.board_items
for each row execute function public.touch_updated_at();

-- RLS
alter table public.boards enable row level security;
alter table public.board_members enable row level security;
alter table public.board_items enable row level security;
alter table public.board_item_comments enable row level security;

-- Policies for boards
create policy "boards_select_member"
on public.boards for select
using (
  exists (
    select 1 from public.board_members bm
    where bm.board_id = boards.id and bm.user_id = auth.uid()
  )
);

create policy "boards_insert_owner"
on public.boards for insert
with check (owner_user_id = auth.uid());

create policy "boards_update_owner"
on public.boards for update
using (owner_user_id = auth.uid());

create policy "boards_delete_owner"
on public.boards for delete
using (owner_user_id = auth.uid());

-- Policies for board_members
create policy "board_members_select_member"
on public.board_members for select
using (
  exists (
    select 1 from public.board_members bm
    where bm.board_id = board_members.board_id and bm.user_id = auth.uid()
  )
);

create policy "board_members_insert_owner_only"
on public.board_members for insert
with check (
  exists (
    select 1 from public.boards b
    where b.id = board_members.board_id and b.owner_user_id = auth.uid()
  )
);

create policy "board_members_delete_owner_only"
on public.board_members for delete
using (
  exists (
    select 1 from public.boards b
    where b.id = board_members.board_id and b.owner_user_id = auth.uid()
  )
);

-- Policies for board_items
create policy "items_select_member"
on public.board_items for select
using (
  exists (
    select 1 from public.board_members bm
    where bm.board_id = board_items.board_id and bm.user_id = auth.uid()
  )
);

create policy "items_insert_editor_or_owner"
on public.board_items for insert
with check (
  exists (
    select 1 from public.board_members bm
    where bm.board_id = board_items.board_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner','editor')
  )
);

create policy "items_update_editor_or_owner"
on public.board_items for update
using (
  exists (
    select 1 from public.board_members bm
    where bm.board_id = board_items.board_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner','editor')
  )
);

create policy "items_delete_editor_or_owner"
on public.board_items for delete
using (
  exists (
    select 1 from public.board_members bm
    where bm.board_id = board_items.board_id
      and bm.user_id = auth.uid()
      and bm.role in ('owner','editor')
  )
);

-- Policies for comments
create policy "comments_select_member"
on public.board_item_comments for select
using (
  exists (
    select 1
    from public.board_items i
    join public.board_members bm on bm.board_id = i.board_id
    where i.id = board_item_comments.board_item_id
      and bm.user_id = auth.uid()
  )
);

create policy "comments_insert_member"
on public.board_item_comments for insert
with check (user_id = auth.uid());

create policy "comments_delete_own"
on public.board_item_comments for delete
using (user_id = auth.uid());