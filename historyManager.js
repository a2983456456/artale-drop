// historyManager.js

const HISTORY_KEY = "search_history";
const COOKIE_KEY = "search_history_cookie";
const MAX_RECORDS = 100;
const COOKIE_EXPIRE_DAYS = 30;

// 取得目前的查詢紀錄
function getRecords() {
    let records = _getFromLocalStorage();
    if (!records.length) {
        records = _getFromCookie();
        if (records.length) _saveToLocalStorage(records);
    }
    return records;
}

// 新增一筆查詢紀錄
function addRecord(type, keyword) {
    // 僅允許合法 type
    if (type !== "monster" && type !== "item") return;
    // 僅允許非空且長度合理的 keyword
    if (!keyword || typeof keyword !== "string" || keyword.length > 50) return;
    let records = getRecords();
    // 移除重複
    records = records.filter(
        (r) => !(r.type === type && r.keyword === keyword)
    );
    // 新增到最前面
    records.unshift({
        type,
        keyword,
        timestamp: Date.now(),
    });
    // 限制最大數量
    if (records.length > MAX_RECORDS) records = records.slice(0, MAX_RECORDS);
    _saveToLocalStorage(records);
    _saveToCookie(records);
}

// 清除所有查詢紀錄
function clearHistory() {
    try {
        localStorage.removeItem(HISTORY_KEY);
    } catch {}
    // 清除 cookie
    document.cookie = `${COOKIE_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

// --- LocalStorage 操作 ---
function _getFromLocalStorage() {
    try {
        const data = localStorage.getItem(HISTORY_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}
function _saveToLocalStorage(records) {
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(records));
    } catch {}
}

// --- Cookie 操作 ---
function _getFromCookie() {
    const match = document.cookie.match(
        new RegExp("(^| )" + COOKIE_KEY + "=([^;]+)")
    );
    if (!match) return [];
    try {
        return JSON.parse(decodeURIComponent(match[2]));
    } catch {
        return [];
    }
}
function _saveToCookie(records) {
    const expires = new Date(
        Date.now() + COOKIE_EXPIRE_DAYS * 864e5
    ).toUTCString();
    // SameSite=Strict 增加安全性，secure 僅在 https 下啟用
    let cookieStr = `${COOKIE_KEY}=${encodeURIComponent(
        JSON.stringify(records)
    )}; expires=${expires}; path=/; SameSite=Strict`;
    if (location.protocol === "https:") cookieStr += "; secure";
    document.cookie = cookieStr;
}

// --- 導出 API ---
window.historyManager = {
    addRecord,
    getRecords,
    clearHistory,
};
