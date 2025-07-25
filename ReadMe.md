### check_monster_drop.json

此檔案用於 掉落物是否已經被玩家驗證過

在此檔案中的怪物與掉落物 代表尚未驗證

### drop_data.json

此檔案用於顯示怪物的掉落物

### item.json

此檔案用於存放怪物與掉落物的 id,方便"物品排序"與"超連結"

### mob.json

此檔案存放各怪物的基本資料

(等級,HP,MP,經驗,迴避,物理防禦,魔法防禦,命中需求)

### boss_time.json

此檔案存放各 BOSS 的重生時間

### map.json

此檔案存放怪物的出沒地圖

### alias.json

此檔案存放掉落物的別名,幫助顯示在物品名稱的後方 (真實在 artale 的物品名稱)

### area.json

此檔案存放目前網站上所顯示的區域地圖, 用於篩選地圖怪物

### version.js

此檔案主要是因為有 PWA 的版本更新需求所建置,有功能或資料更新時會前進 1 個小版號

### PWA

使用 manifest.json 進行建置並利用 PWA/image 的圖片當作 應用程式的 Image
建置與更版 JS 撰寫在 main.js 的下方 和 service-worker.js
