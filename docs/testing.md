# 測試說明

本專案目前只對 [src/lib/tdx.ts](../src/lib/tdx.ts) 撰寫單元測試。
本文件說明 **測什麼、為什麼測、怎麼設計**，方便未來新增測試時有一致的判斷標準。

---

## 1. 為什麼只測 tdx.ts

我們不追求覆蓋率數字，而是用「**壞掉時會不會痛**」做篩選。

| 模組 | 是否該測 | 理由 |
|---|---|---|
| `src/lib/tdx.ts` | ✅ | 隱式狀態（token 快取）、資料形變（envelope 攤平）、字串組裝（OData filter）—— 都是回歸高風險區 |
| `src/stores/favorites.ts` | ➖ | 邏輯主要是 CRUD；危險點 `syncAfterLogin` 已改為「全成功才清 LS」，比寫測試更有效 |
| `src/stores/stations.ts` | ➖ | TTL 快取邏輯簡單，且失敗時下次 mount 會自然重抓 |
| Vue 元件 / Views | ❌ | 沒有複雜分支邏輯；UI 回歸用手動驗證 + type-check 即可 |
| `StationInput.normalize()` | 🤔 可選 | 純函式好測，但目前只處理一組變體（臺/台）。若未來擴充 `VARIANT_MAP` 再補 |

判斷依據：**「這段壞了，使用者會怎麼感受？」** 如果答案是「沒感覺，下次重整就好」，通常不值得寫測試。

---

## 2. tdx.ts 的測試範圍

### 2.1 `getStationTimetable` 攤平與 Direction 注入（3 個測試）

**為什麼測**：這是 tdx.ts 唯一的資料形變邏輯。TDX v3 回的 group 帶 `Direction`，但內部 `TimeTables[]` 不帶。攤平時必須把 group 的 `Direction` 灌回每筆 entry，否則 [LiveView](../src/views/LiveView.vue) 拿到的就是 `undefined`，方向顯示會錯。

**測試案例**：
- 攤平後筆數正確、每筆都帶對應的 `Direction`
- **group `Direction` 蓋過 entry 自帶的 `Direction`**（防禦 API 多回欄位的情況）—— 此測試守住 `{ ...e, Direction: g.Direction }` 的 spread 順序，避免有人改成 `{ Direction: g.Direction, ...e }` 被覆蓋
- 空 group 回 `[]`

### 2.2 `getToken` 快取與過期（4 個測試）

**為什麼測**：`_token` 和 `_tokenExpiry` 是 module-level 隱式狀態，沒有測試就無法保證以下三件事：
1. 第一次呼叫會去拿 token
2. token 沒過期時不會再打 auth endpoint
3. 通過 60 秒安全邊際後會自動換新 token

任何人若把 `expires_in - 60` 改成 `expires_in`、或把 `Date.now() < _tokenExpiry` 寫錯方向，都會出現「以為還沒過期但 TDX 已拒絕」之類的細微 bug。

**測試案例**：
- 連呼三次 `getStations` → token 的 `fetch` POST 只被呼叫 1 次
- `expires_in: 100`，前進 39 秒 → 仍只 1 次（39 < 100 - 60）
- `expires_in: 100`，前進 41 秒 → 變 2 次（41 > 100 - 60）
- 確認 `Authorization: Bearer <token>` header 有正確送出

### 2.3 `unwrap` envelope 容錯（2 個測試）

**為什麼測**：TDX v3 envelope 偶爾會缺 key 或回空。`?? []` 是最後一道防線，壞了會讓上層接到 `undefined`，整個畫面崩。

**測試案例**：
- response `data` 沒有預期的 listKey → 回 `[]`
- response `data` 本身是 `null` → 回 `[]`

### 2.4 `getLiveTrains` 的 `$filter` 組裝（2 個測試）

**為什麼測**：`$filter = \`StationID eq '${stationId}'\`` 這種字串內插容易壞 —— 漏單引號、寫成 `=` 而非 `eq`、忘記條件分支。

**測試案例**：
- 給 stationId → params 包含正確的 OData 字串
- 沒給 stationId → params 只有 `$top` 和 `$format`（不能誤帶空字串的 `$filter`）

### 2.5 Sunset / Deprecation header 警告（3 個測試）

**為什麼測**：`warnedSunset` set 的目的是「每個 endpoint 只警告一次」，避免 console 被洗版。如果有人改錯這個 set 的判斷邏輯，console 會被淹沒（影響開發體驗）或完全靜默（錯過 API 棄用警示）。

**測試案例**：
- 同一個 endpoint 連呼三次 → `console.warn` 只 1 次
- 兩個不同 endpoint 各帶 sunset → `console.warn` 2 次（分別記錄）
- 沒有 sunset header → 不應警告

### 2.6 URL 組裝（4 個測試）

**為什麼測**：`${BASE}/${version}${path}${suffix}` 的字串拼接容易少寫斜線或寫錯版本號。把預期 URL 寫死在斷言裡，未來若有人不小心動到 `ENDPOINTS` 的 path 會立刻被抓到。

**測試案例**：
- `getTimeTable(from, to, date)` → 完整 OD URL
- `getStationTimetable(id)` → 完整 station URL
- `getFare(from, to)` → 完整 ODFare URL
- 任何呼叫都帶上 `$format: 'JSON'`

---

## 3. 技術設計決策

### 3.1 為什麼選 Vitest

- 跟現有 Vite 8 build 同源，不用維護第二套 config
- TypeScript 原生支援，不需要額外的 transform 設定
- API 跟 Jest 幾乎一樣，學習成本低
- Watch mode 啟動快

### 3.2 為什麼用 `node` 環境而非 `jsdom`

`tdx.ts` 完全沒有 DOM 依賴，跑 jsdom 只是浪費啟動時間。設定在 [vite.config.ts](../vite.config.ts) 的 `test.environment: 'node'`。

未來如果要測 Vue 元件，再開一個 `test.environmentMatchGlobs` 或拆檔處理。

### 3.3 為什麼每個測試前都 `vi.resetModules()` + 重新 import

`tdx.ts` 有 module-level 狀態：
- `_token`、`_tokenExpiry` （token 快取）
- `warnedSunset`（已警告過的 endpoint set）

如果不重置 module，前一個測試留下的快取會污染下一個測試。例如：
- 「token 過期會 refresh」測試跑完後 → `_token` 有值
- 下一個「第一次呼叫會拿 token」測試就會失敗（因為已經有快取了）

`vi.resetModules()` 清掉 module registry，下次 `await import('./tdx')` 會重新執行整個模組，狀態歸零。

### 3.4 為什麼用 `vi.useFakeTimers()`

要驗證 60 秒安全邊際（39s 不更新、41s 更新）必須能精準控制 `Date.now()`。Fake timers 讓我們不用真的 sleep 也不用 monkey-patch Date。

每個測試完用 `vi.useRealTimers()` 還原，避免影響 Vitest 本身的 timeout 機制。

### 3.5 為什麼透過 public API 間接測試 `unwrap`

`unwrap` 沒有 export。兩個選擇：
1. 為了測試而 export → 增加 API surface、可能被誤用
2. 透過呼叫 `getStations()` 等 public function 來間接觸發 unwrap

選 (2)：測試更接近真實使用情境，也不污染模組介面。

### 3.6 為什麼用 `vi.stubGlobal('fetch', vi.fn())` 而不是真的打網路

- 不依賴外部服務 → 測試穩定、快速、可離線跑
- 不消耗 TDX 的 client credentials 配額
- 可以精準模擬邊界情境（空 envelope、sunset header、特定 expires_in）

---

## 4. 如何執行

```bash
npm test           # 跑一次
npm run test:watch # watch mode
```

預設只跑 `src/**/*.test.ts`。

---

## 5. 未來新增測試的指引

### 5.1 該寫測試的訊號

- 純函式有複雜分支或字串組裝
- 有 module-level 隱式狀態
- 失敗會造成資料遺失或安全問題
- 修過一次的 bug（用測試守住，避免回歸）

### 5.2 不該寫測試的訊號

- 只是把資料塞進 component template
- 失敗時下次操作會自然修正（如可重抓的 cache）
- 純樣式調整
- 為了覆蓋率而寫

### 5.3 命名與位置

- 測試檔放在被測檔旁邊：`foo.ts` → `foo.test.ts`
- 用 `describe` 區分功能群組，`it` 描述具體情境（「**做什麼 → 預期結果**」）
- 避免測試名只寫 `'works'`、`'returns correct value'`

### 5.4 新增 TDX endpoint 時

如果在 [src/lib/tdx.ts](../src/lib/tdx.ts) 的 `ENDPOINTS` 加新項目，至少補一個「URL 組裝」測試（參考 §2.6），避免拼字錯誤。
