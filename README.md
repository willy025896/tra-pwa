# 台鐵快查 (tra-pwa)

一款台鐵時刻、即時動態與票價的行動優先查詢 PWA。資料來源為交通部 [TDX 運輸資料流通服務](https://tdx.transportdata.tw/) 的台鐵 v3 API，介面以手機單欄佈局與深色主題設計，可安裝至桌面離線使用。

## 功能

- **常用路線**：將出發站與到達站組合儲存為常用路線（可加備註名稱），首頁一鍵帶入時刻查詢。
  - 未登入時存於瀏覽器 `localStorage`；以 Google 帳號登入後改存 Supabase，並會把本機已存的路線同步上雲，達成跨裝置共用。
- **時刻查詢**：選擇起訖站與日期，查詢當日 OD 直達班次，顯示車種、發車／到達時間與行駛時間，可一鍵交換起訖站。
- **即時動態**：選擇車站查看列車即時看板，呈現誤點分鐘數、進站／在站／離站／通過狀態與方向（南下／北上），並結合當日站別時刻表顯示目的地與預計時間，每 30 秒自動更新。
- **票價查詢**：查詢起訖站之間各車種的票價，含全票、來回票、孩童、敬老、愛心等票種分類。
- **車站搜尋**：可篩選的車站下拉選單，搜尋時自動匹配「臺／台」異體字。
- **PWA**：可安裝至主畫面、獨立視窗執行，採 `autoUpdate` 自動更新；車站清單於 `localStorage` 快取 7 天以降低 API 請求。

## 使用技術

| 類別 | 技術 |
| --- | --- |
| 前端框架 | Vue 3（`<script setup>` Composition API）+ TypeScript |
| 建置工具 | Vite |
| 路由 | Vue Router（懶載入路由、依路由更新文件標題） |
| 狀態管理 | Pinia |
| PWA | vite-plugin-pwa（Service Worker、Web App Manifest） |
| 後端 / 認證 | Supabase（Google OAuth 登入、常用路線儲存） |
| 資料來源 | TDX 台鐵 v3 API（OAuth2 client credentials 取 token） |
| HTTP | axios |
| 日期處理 | Day.js |

## 專案結構

```
src/
├── views/        # 四個主要頁面：首頁、時刻、動態、票價
├── components/   # BottomNav 底部導航、StationInput 車站選擇
├── stores/       # Pinia：auth 認證、favorites 常用路線、stations 車站清單
├── lib/          # tdx TDX API 封裝、supabase 客戶端
├── router/       # 路由設定
└── types/        # 共用型別
```
