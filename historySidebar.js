// historySidebar.js
// 歷史紀錄側欄功能

/**
 * 建立單一歷史紀錄的 <li> 元素
 * @param {Object} record
 * @returns {HTMLLIElement}
 */
function createHistoryListItem(record) {
    const li = document.createElement("li");
    const typeSpan = document.createElement("span");
    typeSpan.className =
        record.type === "monster"
            ? "history-type-monster"
            : "history-type-item";
    typeSpan.textContent = record.type === "monster" ? "怪物" : "掉落物";
    const keywordSpan = document.createElement("span");
    keywordSpan.textContent = record.keyword;
    const timeSpan = document.createElement("span");
    timeSpan.className = "history-timestamp";
    timeSpan.textContent = new Date(record.timestamp).toLocaleString();
    li.appendChild(typeSpan);
    li.appendChild(keywordSpan);
    li.appendChild(timeSpan);
    // 點擊時自動查詢（但不寫入新紀錄）
    li.style.cursor = "pointer";
    li.title = "點擊查詢此紀錄";
    li.addEventListener("click", function () {
        const searchInput = document.getElementById("search");
        if (searchInput) {
            searchInput.value = record.keyword;
            if (typeof window.refresh === "function") {
                window.refresh(false);
            }
        }
    });
    return li;
}

/**
 * 渲染歷史紀錄列表
 */
function renderHistorySidebar() {
    const list = document.getElementById("history-list");
    list.innerHTML = "";
    const records =
        (window.historyManager && window.historyManager.getRecords()) || [];
    if (records.length === 0) {
        const li = document.createElement("li");
        li.textContent = "尚無查詢紀錄";
        list.appendChild(li);
        return;
    }
    records.forEach((r) => list.appendChild(createHistoryListItem(r)));
}

// 監聽自訂事件，無論側欄是否開啟，直接重新渲染
window.addEventListener("history-record-added", renderHistorySidebar);

// 控制 refresh 是否寫入歷史紀錄
window._skipHistoryRecord = false;

// 側欄開關控制
document.addEventListener("DOMContentLoaded", function () {
    const sidebar = document.getElementById("history-sidebar");
    const openBtn = document.getElementById("history-btn");
    const closeBtn = document.getElementById("close-history-btn");
    const clearBtn = document.getElementById("clear-history-btn");
    if (openBtn) {
        openBtn.addEventListener("click", function () {
            sidebar.classList.toggle("open");
            if (sidebar.classList.contains("open")) {
                openBtn.classList.add("active");
                renderHistorySidebar();
            } else {
                openBtn.classList.remove("active");
            }
        });
    }
    if (closeBtn) {
        closeBtn.addEventListener("click", function () {
            sidebar.classList.remove("open");
            if (openBtn) openBtn.classList.remove("active");
        });
    }
    if (clearBtn) {
        clearBtn.addEventListener("click", function () {
            if (
                window.historyManager &&
                window.historyManager.getRecords().length > 0
            ) {
                window.historyManager.clearHistory();
                renderHistorySidebar();
            }
        });
    }
});
