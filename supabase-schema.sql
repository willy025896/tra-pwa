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

-- ---------------------------------------------------------------------------
-- 服務上線天數計數器（兼任 Supabase 保活 ping 的目標）
-- ---------------------------------------------------------------------------

-- 單列表：id 永遠是 1（check 強制只能有 id=1 這一列）
create table if not exists service_uptime (
  id int primary key default 1 check (id = 1),
  days int not null default 0,
  last_increment_date date not null default current_date
);

-- 種一筆初始資料。on conflict do nothing → 重跑此腳本不會覆蓋既有天數。
-- 想從實際上線日回填，把 last_increment_date 改成上線那天即可，
-- 第一次 bump 會自動補上「今天 - 上線日」的天數。
insert into service_uptime (id, days, last_increment_date)
values (1, 0, current_date)
on conflict (id) do nothing;

-- 開 RLS：寫入鎖住（只有下面的 RPC 用 service_role 能改），但開放唯讀。
alter table service_uptime enable row level security;

-- 任何人都能讀天數（前端 footer 要顯示）；沒有 insert/update policy，
-- 所以 anon 改不了，bump 一律走 service_role 繞過 RLS。
drop policy if exists "anyone can read uptime" on service_uptime;
create policy "anyone can read uptime"
  on service_uptime
  for select
  using (true);

-- bump：補上自上次以來經過的天數，回傳更新後的整列。
-- days += (今天 - 上次加的日期)：
--   * Action 被跳過幾天 → 下次一次補回，不會少加
--   * 同一天重複呼叫 → current_date - last_increment_date = 0，+0，冪等
-- set search_path = '' + schema-qualify：避免 search_path 被竄改（Supabase linter 建議）。
create or replace function bump_uptime()
returns service_uptime
language sql
set search_path = ''
as $$
  update public.service_uptime
  set days = days + (current_date - last_increment_date),
      last_increment_date = current_date
  where id = 1
  returning *;
$$;

-- 縱深防禦：bump 只該由 CI 的 service_role 呼叫，收回 anon/public 的執行權。
-- （即使不收回，anon 因 SECURITY INVOKER + 無 update policy 也改不動，但收回更乾淨。）
revoke execute on function bump_uptime() from anon, public;
grant execute on function bump_uptime() to service_role;
