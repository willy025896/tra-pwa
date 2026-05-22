-- 在 Supabase SQL Editor 執行這段建立 table

create table favorite_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  from_id text not null,
  from_name text not null,
  to_id text not null,
  to_name text not null,
  label text,
  created_at timestamptz default now()
);

-- 啟用 RLS
alter table favorite_routes enable row level security;

-- 只允許本人讀寫自己的資料
create policy "users can manage own routes"
  on favorite_routes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
