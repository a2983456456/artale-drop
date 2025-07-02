import { version } from "./version.js";
// 定義快取的名稱，用來版本管理快取資料
const CACHE_NAME = `artale-drop-v${version}`;
console.log("version", CACHE_NAME);
// 要被預先快取的資源清單
const URLS_TO_CACHE = [
    "/", // 網站根目錄
    "./index.html", // 主頁 HTML
    "./main.css", // CSS 檔案
    "./main.js", // 主 JS 檔案
    "./PWA/image/icon-192.png", // PWA 小 icon
    "./PWA/image/icon-512.png", // PWA 大 icon
];

// 監聽 install 事件：第一次安裝 Service Worker 時觸發
self.addEventListener("install", (event) => {
    event.waitUntil(
        // 開啟指定名稱的 cache（如果沒有會建立）
        caches.open(CACHE_NAME).then((cache) =>
            // 將 URLS_TO_CACHE 裡的檔案都加入快取
            cache.addAll(URLS_TO_CACHE)
        )
    );
    self.skipWaiting();
});

// 監聽 fetch 事件：攔截所有網路請求
self.addEventListener("fetch", (event) => {
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // 網路請求成功 → 更新快取
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, response.clone());
                    return response;
                });
            })
            .catch(() => {
                // 網路失敗 → 嘗試從快取取資料
                return caches.match(event.request);
            })
    );
});

// 監聽 activate 事件：當 Service Worker 被啟用時觸發
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            // 刪除所有舊的 cache（保留當前版本）
            Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        // 刪除舊版本快取
                        return caches.delete(cacheName);
                    }
                })
            )
        )
    );
    self.clients.claim();
});

// 監聽新 SW 控制頁面時，通知前端可更新
self.addEventListener("message", (event) => {
    if (event.data === "SKIP_WAITING") {
        self.skipWaiting();
    }
});
