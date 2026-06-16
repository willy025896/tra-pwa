# 服務上線天數計數器 + Supabase 保活機制（可移植指南）

一套「一石二鳥」的設計：用一個**真實的 DB 寫入**當作 Supabase 免費方案的保活 ping，
順便把這個寫入累積成「服務已上線 N 天」的計數器顯示在前端。

本文件記錄完整原理與移植步驟，方便搬到其他 Supabase + 前端 + GitHub Actions 的專案。

---

## 1. 要解決的問題

Supabase 免費方案會在**連續 7 天沒有「真實 DB 活動」**後暫停專案。

關鍵陷阱：**HTTP 流量不等於 DB 活動。** 常見的錯誤保活做法是用 anon key 去 `GET` 一張有 RLS 的表：

```bash
# ❌ 反例：anon 讀有 RLS 的表
curl ".../rest/v1/some_table?select=id&limit=1" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY"
```

問題：
- RLS 會把 anon（沒有 `auth.uid()`）擋掉，回 4xx 或回 200 但空陣列。
- 請求沒有對 Postgres 做一次有效查詢 → Supabase 仍判定閒置。
- 很多範例會「把 4xx 當成功」來讓 workflow 不報錯，反而**掩蓋了根本沒保到活**這件事。

**正解：用 `service_role` key 做一次真正打到 Postgres 的寫入。** service_role 繞過 RLS，
寫入一定成立，Supabase 才會認帳。

---

## 2. 整體架構

```
GitHub Actions (每天 cron)
        │  POST /rest/v1/rpc/bump_uptime   （service_role key）
        ▼
Supabase Postgres
  ├─ service_uptime 表（單列：days, last_increment_date）
  └─ bump_uptime() 函式：days += (今天 - 上次日期)，並更新上次日期
        ▲
        │  GET /rest/v1/service_uptime?select=days  （anon key，唯讀）
        │
前端（讀 days，顯示「服務已上線 N 天」）
```

三個角色、三把不同權限：

| 角色 | Key | 動作 | 受 RLS? |
|------|-----|------|---------|
| GitHub Actions（寫入/保活） | `service_role` | 呼叫 `bump_uptime()` RPC | 繞過 |
| 前端（唯讀顯示） | `anon` | `select days` | 受（靠 select policy 放行） |

---

## 3. 設計重點

### 3.1 為什麼「補天數」而不是「每次 +1」

GitHub 的 scheduled workflow **偶爾會延遲、甚至整次被跳過**（免費 runner 負載高時很常見）。
若每次固定 +1，跳一次就少一天。

解法：計數邏輯改成「**補上自上次以來經過的天數**」：

```
days += (current_date - last_increment_date)
last_increment_date = current_date
```

- **跳過幾天** → 下次跑時一次補回（自癒）。
- **同一天重複跑** → `current_date - last_increment_date = 0`，+0（冪等）。

### 3.2 為什麼放在 SQL 函式（RPC）

「讀現值 → 算差 → 寫回」必須是**原子操作**，否則並發會 race。
包成 Postgres 函式用單一 RPC 呼叫，一次 `update ... returning *` 搞定。

### 3.3 權限切分

- 寫入只走 `service_role`（在 CI secret，繞過 RLS）→ 前端永遠改不了天數。
- 前端只要唯讀，給一條 `for select using (true)` 的 policy 放行即可。
- **`service_role` key 絕不能進前端 env**（尤其 Vite 的 `VITE_*` 會打包進 bundle、公開可見）。
  它只該存在於 CI 的 secret。

### 3.4 安全與健壯性強化（已內建於上面範本）

這些不是必要才能跑，但建議一開始就帶上，移植時直接沿用：

**DB 端**
- **`set search_path = '' + schema-qualify`**：函式不固定 `search_path` 會被 Supabase linter 標 warning，
  也是 search_path 注入的防線；改用 `public.service_uptime` 全限定名稱。
- **`revoke execute ... from anon, public`**：`bump_uptime()` 預設 `PUBLIC` 可執行，等於 anon 也能打這支 RPC。
  雖然它是 SECURITY INVOKER、加上 `service_uptime` 沒有 update policy，anon 呼叫只會更新 0 列、改不動天數，
  但收回執行權是更乾淨的縱深防禦。
- **`check (id = 1)` + 冪等語句**：防止誤插多列；`if not exists` / `on conflict do nothing` /
  `drop policy if exists` 讓整份腳本可安全重跑。

**CI 端**（只管「單次執行內的暫時性失敗」，與 cron 漏跑的補天數機制分屬兩層、互不重疊）
- **`timeout-minutes: 5`**：job 卡死時自動中止。
- **`--connect-timeout 15 --max-time 30`**：連線與總逾時上限。
- **`--retry 3 --retry-delay 5`**：只重試暫時性錯誤；**不要加 `--retry-all-errors`**——4xx 是設定/權限錯，
  重試也沒用，只會白等。
- **空回應守衛**：重試耗盡仍連不上時 `status` 會是空字串，先 `[ -z "$status" ]` 擋掉，
  避免後面整數比較噴 bash 錯。

> 已經建好物件、之後才要補這些強化的專案，見 [§9 既有專案的 migration SQL](#9-既有專案的-migration-sql)。

---

## 4. 移植步驟

### Step 1 — Supabase SQL

在目標專案的 Supabase SQL Editor 執行：

這份腳本是**冪等的**（`if not exists` / `on conflict` / `drop policy if exists` / `create or replace`），
重跑不會覆蓋既有天數或報錯：

```sql
-- 單列表：id 永遠是 1（check 強制只能有 id=1 這一列，防誤插多列）
create table if not exists public.service_uptime (
  id int primary key default 1 check (id = 1),
  days int not null default 0,
  last_increment_date date not null default current_date
);

-- 種初始資料。on conflict do nothing → 重跑不會覆蓋既有天數。
-- 想從實際上線日回填，把 last_increment_date 設成上線那天，
-- 第一次 bump 會自動補上「今天 - 上線日」的天數。
insert into public.service_uptime (id, days, last_increment_date)
values (1, 0, current_date)
on conflict (id) do nothing;

-- 開 RLS：寫入鎖住，只開放唯讀
alter table public.service_uptime enable row level security;

-- 任何人都能讀（前端顯示用）；沒有 insert/update policy → anon 改不了
drop policy if exists "anyone can read uptime" on public.service_uptime;
create policy "anyone can read uptime"
  on public.service_uptime for select using (true);

-- bump：補上自上次以來經過的天數，回傳更新後整列。
-- set search_path = '' + schema-qualify：避免 search_path 被竄改（Supabase linter 會 warning）。
create or replace function public.bump_uptime()
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
revoke execute on function public.bump_uptime() from anon, public;
grant  execute on function public.bump_uptime() to service_role;
```

### Step 2 — GitHub Actions Secret

到目標 repo → **Settings → Secrets and variables → Actions → Repository secrets**，新增：

- `SUPABASE_URL` — 專案 URL（例如 `https://xxxx.supabase.co`）
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase 後台 → Project Settings → API → **service_role** 那把（標 `secret`）

> ⚠️ 用 **Repository** secret，不是 Environment secret。
> Environment secret 只在 job 宣告 `environment:` 時才讀得到；這種純保活 job 沒有宣告，會讀成空字串而失敗。

### Step 3 — Workflow 檔

新增 `.github/workflows/keep-supabase-alive.yml`：

```yaml
name: Keep Supabase Alive

on:
  schedule:
    # 每天執行一次 (UTC 00:00)。GitHub cron 偶爾會延遲或被跳過，
    # 但 bump_uptime() 會補上漏掉的天數，所以天數不會少加，
    # 同時也讓「離 7 天閒置紅線」永遠保有大量緩衝。
    - cron: '0 0 * * *'
  workflow_dispatch: # 允許手動觸發

jobs:
  ping:
    runs-on: ubuntu-latest
    timeout-minutes: 5 # backstop：整個 job 卡死（非 curl 層）時自動中止，不佔 runner
    steps:
      - name: Bump service uptime (real DB write keeps Supabase active)
        run: |
          # 逾時與重試只管「單次執行內的暫時性失敗」；cron 漏跑由 bump_uptime() 補天數，互不重疊。
          #   --connect-timeout 15 / --max-time 30：連線與總逾時上限
          #   --retry 3 --retry-delay 5：只重試暫時性錯誤（連線失敗、逾時、5xx/408/429）；
          #     不重試 4xx——那是設定/權限錯，重試也沒用，只會白等。
          response=$(curl -s -w "\n%{http_code}" \
            --connect-timeout 15 --max-time 30 \
            --retry 3 --retry-delay 5 \
            -X POST \
            "${{ secrets.SUPABASE_URL }}/rest/v1/rpc/bump_uptime" \
            -H "apikey: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{}')

          body=$(echo "$response" | head -n -1)
          status=$(echo "$response" | tail -n 1)

          echo "HTTP status: $status"
          echo "Response: $body"

          # 空回應防護：重試耗盡仍連不上時 status 會是空字串，
          # 先擋掉，避免 [ "" -ge 200 ] 的整數比較噴 bash 錯。
          if [ -z "$status" ]; then
            echo "No response from Supabase (connection failed after retries)."
            exit 1
          fi

          # 嚴格要求 2xx，不把 4xx 當成功來掩蓋問題
          if [ "$status" -ge 200 ] && [ "$status" -lt 300 ]; then
            echo "Uptime bumped. Supabase is alive."
          else
            echo "Failed to bump uptime — Supabase may NOT have registered activity."
            exit 1
          fi
```

### Step 4 — 前端讀取 + 顯示

> 📌 **移植前請先決策（必填）**
>
> Step 1~3（保活機制本身）是完整且獨立的——**就算完全不在前端顯示天數,保活照樣運作。**
> 前端顯示純粹是「順便露個臉」的加值,要不要做、做在哪由你決定:
>
> 1. **是否要在頁面顯示「服務已上線 N 天」?**（是 / 否）
> 2. 若要,**顯示在哪個位置?**
>    例如:首頁 footer、關於頁、設定頁角落、側邊欄底部……
>    挑一個對使用者干擾最小、又看得到的地方。
>
> ⚠️ **若未做出決策（沒指定位置）→ 前端就不顯示此數值**,
> 直接跳過本 Step 4,只保留 Step 1~3 的保活機制即可。
> 之後想加再回來做也行,不影響已運作的保活。

決定要顯示後,讀取邏輯如下（這裡用 Vue + Pinia + `@supabase/supabase-js`；其他框架照樣搬，重點是那支 query）：

```ts
// stores/uptime.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase' // 用 anon key 建的 client

export const useUptimeStore = defineStore('uptime', () => {
  const days = ref<number | null>(null)

  async function load() {
    if (days.value !== null) return // 一個 session 讀一次就夠
    const { data, error } = await supabase
      .from('service_uptime')
      .select('days')
      .eq('id', 1)
      .maybeSingle() // 0 列回 null（不像 .single() 會丟 406），單純不顯示
    if (!error && data) days.value = data.days
  }

  return { days, load }
})
```

顯示（footer，讀到才出現、fire-and-forget 不擋頁面）：

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useUptimeStore } from '@/stores/uptime'
const uptimeStore = useUptimeStore()
onMounted(() => {
  uptimeStore.load() // 不 await，晚一點出現也無妨
})
</script>

<template>
  <footer v-if="uptimeStore.days !== null">
    服務已上線 {{ uptimeStore.days }} 天
  </footer>
</template>
```

> **純 JS / 不用 supabase-js 的版本**：直接打 REST 即可
> ```js
> const res = await fetch(
>   `${SUPABASE_URL}/rest/v1/service_uptime?select=days&id=eq.1`,
>   { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
> )
> const [row] = await res.json()
> const days = row?.days ?? null
> ```

---

## 5. 從實際上線日回填天數

種表時 `last_increment_date` 預設今天（days 從 0 起算）。若想反映「真正上線到現在」的天數，
找出上線日（通常是首個部署 commit，可用 `git log --reverse` 或部署設定檔的加入日），跑一次：

```sql
-- 把 '2026-05-28' 換成你的上線日
update public.service_uptime
set days = current_date - date '2026-05-28',
    last_increment_date = current_date
where id = 1;
```

這段會：
- `days` 立刻設成「今天 − 上線日」，前端馬上顯示正確天數（不用等 workflow）。
- `last_increment_date` 設成今天，明天 bump 接著 +1，不會重複加。

---

## 6. 驗證

1. **手動觸發 workflow**：repo → Actions → 該 workflow → Run workflow。
   看 log 出現 `HTTP status: 200` 且回傳帶 `days` 的 JSON。
2. **DB 確認**：
   ```sql
   select * from public.service_uptime;
   ```
3. **前端**：重新整理頁面，footer 顯示「服務已上線 N 天」。

---

## 7. 常見坑

| 症狀 | 原因 | 解法 |
|------|------|------|
| 前端 `406 Not Acceptable` | `.single()` 讀到 0 列（RLS select policy 沒套用、或 `id=1` 沒資料、或表沒建） | 補 policy / insert / 建表；前端用 `.maybeSingle()` 不再丟錯 |
| workflow 紅燈、非 2xx | secret 沒設、用到 Environment secret、key 放錯（用了 anon） | 用 Repository secret 放 `service_role` |
| 仍收到 Supabase 不活躍通知 | ping 沒真正寫入 DB（anon 被 RLS 擋、把 4xx 當成功） | 改用 service_role 走 RPC 寫入、嚴格 2xx |
| 天數偶爾少加 | 用「每次 +1」且 cron 被跳過 | 改用「補天數」邏輯（本文設計） |
| service_role 外洩風險 | 誤放進前端 `VITE_*` env，打包進 bundle | service_role **只**放 CI secret；前端永遠只用 anon |
| workflow 偶發紅燈 | 網路抖動、Supabase 短暫不可達 | curl 加 `--retry` / `--connect-timeout` / `--max-time`；job 加 `timeout-minutes`（見 §3.4） |
| 整數比較 `[: : integer expression expected` | 連不上時 `status` 為空字串 | 加 `[ -z "$status" ]` 空回應守衛（見 §3.4） |

---

## 8. 檔案對照（本專案實作位置，移植時的範本）

| 檔案 | 角色 |
|------|------|
| [supabase-schema.sql](../supabase-schema.sql) | `service_uptime` 表 + policy + `bump_uptime()` |
| [.github/workflows/keep-supabase-alive.yml](../.github/workflows/keep-supabase-alive.yml) | 每天 cron 呼叫 RPC |
| [src/stores/uptime.ts](../src/stores/uptime.ts) | 前端唯讀 store |
| [src/views/HomeView.vue](../src/views/HomeView.vue) | footer 顯示「服務已上線 N 天」 |

---

## 9. 既有專案的 migration SQL

如果 `service_uptime` / `bump_uptime()` **已經建好**，要補上 §3.4 的 DB 端強化，
不必重建，到 SQL Editor 跑這段即可（CI 端強化直接改 workflow 檔，不涉及 DB）：

```sql
-- 1. 限制 service_uptime 只能有 id=1 這一列（既有那列須已是 1，否則先清掉 id≠1 的列）
alter table public.service_uptime
  add constraint service_uptime_id_check check (id = 1);

-- 2. 重建 bump_uptime：固定 search_path + schema-qualify（不碰資料，既有天數不變）
create or replace function public.bump_uptime()
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

-- 3. 收回 anon/public 執行權，只留 service_role
--    （create or replace 不會重置既有授權，所以這步一定要跑）
revoke execute on function public.bump_uptime() from anon, public;
grant  execute on function public.bump_uptime() to service_role;
```

跑完用 service_role 手動觸發 workflow 驗證仍是 `HTTP status: 200`（revoke 不影響 service_role）。
