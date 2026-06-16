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

-- ---------------------------------------------------------------------------
-- Supabase linter 加固：rls_auto_enable() event trigger 函式收回對外執行權
-- ---------------------------------------------------------------------------
--
-- public.rls_auto_enable() 是一個綁在 event trigger 上的 SECURITY DEFINER 函式
-- （在 Supabase 後台建立，非本檔產生）：每當 public schema 有新 table 被 CREATE，
-- 就自動幫它 enable row level security，是一層「忘記開 RLS」的保險。
--
-- 問題：Postgres 預設把新函式的 EXECUTE 權限 grant 給 PUBLIC，導致 anon/authenticated
-- 能透過 /rest/v1/rpc/rls_auto_enable 看到它，觸發 linter 警告
-- (0028/0029 *_security_definer_function_executable)。
--
-- 收回 EXECUTE 不影響功能：event trigger 函式由 DDL 事件本身觸發，與角色的 EXECUTE
-- 權限無關；且其 pg_event_trigger_ddl_commands() 只能在 trigger 情境執行，
-- 直接 RPC 呼叫本來就會報錯。故不改 SECURITY INVOKER（需 DEFINER 高權才能 alter table）、
-- 也不刪除（自動開 RLS 是有用的加固），只收回對外執行權。
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 備註：linter 另有一條 WARN「Leaked Password Protection Disabled」刻意不處理——
-- 該功能現需 Pro 方案才能開啟，且本專案僅用 Google OAuth、無密碼流程，實質無防護對象。
-- 升級方案或日後加入 email/password 登入時，再到 Dashboard → Authentication 開啟即可。
