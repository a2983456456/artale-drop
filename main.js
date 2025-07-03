/**
 * =================================================================
 * 全域變數宣告
 * =================================================================
 */

// 取得網址中的 'searchkey' 參數，用於實現分享連結後自動搜尋
const params = new URLSearchParams(window.location.search);
const searchParam = params.get("searchkey") || "";
// 將網址中的搜尋關鍵字設定到搜尋框中
document.getElementById("search").value = searchParam;

// 初始化全域變數，用於儲存從 JSON 檔案載入的資料
let dropData = {}; // 儲存怪物掉落物資料 { '怪物A': ['物品1', '物品2'] }
let mobData = {}; // 儲存怪物詳細屬性資料 { '怪物A': [LV, HP, MP, ...] }
let nameToIdMap = {}; // 儲存物品名稱到 ID 的對應 { '物品1': '1000001' }
let bossTime = {}; // 儲存 BOSS 的重生時間 { 'BOSS_A': '12小時' }
let spawnMap = {}; // 儲存怪物的出沒地圖 { '怪物A': { '地圖1': 1, '地圖2': 1 } }
let selectedRegions = new Set(); // 儲存使用者勾選的區域篩選條件
let area = {}; // 儲存地圖區域的資料，用於預設勾選
let aliasMap = {}; // 儲存物品或怪物的別名 { '楓葉': '楓葉' }
let selectedResistances = new Set(); // 儲存使用者選擇的屬性弱點篩選條件
let lazyData = [];
const BATCH_SIZE = 12; // 每次載入的數量，可調整效能
let lazyIndex = 0;
/**
 * =================================================================
 * 核心功能函式
 * =================================================================
 */

/**
 * 在文字中高亮顯示指定的關鍵字
 * @param {string} text - 要處理的原始文字
 * @param {string} keyword - 要高亮的關鍵字，支援用 '|' 分隔的多個關鍵字
 * @returns {string} - 包含 <mark> 標籤的 HTML 字串
 */
function highlight(text, keyword) {
    // 如果沒有關鍵字，直接返回原文
    if (!keyword) return text;

    // 處理 OR 搜尋的高亮 (例如: "關鍵字A|關鍵字B")
    if (keyword.includes("|")) {
        const keywords = keyword.split("|").map((k) => k.trim());
        let highlightedText = text;
        keywords.forEach((k) => {
            // 使用正則表達式，'gi' 表示全域、不分大小寫匹配
            const regex = new RegExp(`(${k})`, "gi");
            highlightedText = highlightedText.replace(regex, "<mark>$1</mark>");
        });
        return highlightedText;
    }

    // 一般單一關鍵字的高亮
    const regex = new RegExp(`(${keyword})`, "gi");
    return text.replace(regex, "<mark>$1</mark>");
}

/**
 * 檢查一個怪物是否為 BOSS
 * @param {string} monster - 怪物名稱
 * @returns {boolean} - 如果是 BOSS 則返回 true，否則 false
 */
function isBoss(monster) {
    // 檢查 bossTime 物件中是否存在該怪物的屬性
    return bossTime && Object.prototype.hasOwnProperty.call(bossTime, monster);
}

/**
 * 取得物品或怪物的顯示名稱
 * 如果有別名，會以 "本名(別名)" 的格式顯示
 * 如果是 BOSS，會在名稱後加上 "(BOSS)"
 * @param {string} item - 物品或怪物名稱
 * @param {string} number - 物品數量
 * @returns {string} - 處理後的顯示名稱
 */
function getDisplayName(item, number) {
    let name = item;
    // 檢查是否有別名，且別名不等於本名
    if (aliasMap[item] && aliasMap[item] !== item) {
        name = `${item}(${aliasMap[item]})`;
    }
    // 檢查是否為 BOSS
    if (isBoss(item)) {
        name += " (BOSS)";
    }
    return `${name}${number ? ` X ${number}` : ""}`;
}

/**
 * 檢查一個物品或怪物名稱是否符合搜尋關鍵字
 * @param {string} item - 物品或怪物名稱
 * @param {string} keyword - 搜尋關鍵字
 * @returns {boolean} - 是否符合
 */
function matchesKeyword(item, keyword) {
    // 若無關鍵字，則視為符合
    if (!keyword) return true;
    const loweredItem = item.toLowerCase();
    const alias = aliasMap[item];

    // 處理 OR 搜尋
    if (keyword.includes("|")) {
        const keywords = keyword.split("|").map((k) => k.trim().toLowerCase());
        return keywords.some((k) => {
            // 特殊關鍵字 'boss' 處理
            if (k === "boss" && isBoss(item)) return true;
            // 檢查本名或別名是否包含關鍵字
            return (
                loweredItem.includes(k) ||
                (alias && alias.toLowerCase().includes(k))
            );
        });
    }

    // 一般搜尋
    const loweredKeyword = keyword.toLowerCase();
    // 特殊關鍵字 'boss' 處理
    if (loweredKeyword === "boss" && isBoss(item)) return true;
    // 檢查本名或別名是否包含關鍵字
    return (
        loweredItem.includes(loweredKeyword) ||
        (alias && alias.toLowerCase().includes(loweredKeyword))
    );
}

/**
 * 準備 lazy loading 的資料集，並初始化載入第一批卡片
 *
 * @param {Object} data - 怪物掉落物資料
 * @param {string} [keyword=""] - 搜尋關鍵字，用於高亮顯示與篩選
 * @param {boolean} [onlyMatchedDrops=false] - 是否僅顯示符合關鍵字的掉落物
 */
function prepareLazyRender(data, keyword = "", onlyMatchedDrops = false) {
    // 產生完整資料集並排序且篩選
    lazyData = Object.entries(data)
        .sort(([a], [b]) => {
            const aLv = mobData[a]?.[0] ?? 0;
            const bLv = mobData[b]?.[0] ?? 0;
            return aLv - bLv;
        })
        .map(([monster, items]) => {
            // 檢查怪物本身或其掉落物是否符合關鍵字
            const monsterMatch = matchesKeyword(monster, keyword);
            const matchedItems = items.filter((item) =>
                matchesKeyword(item, keyword)
            );
            return {
                monster,
                items: onlyMatchedDrops && keyword ? matchedItems : items,
                matchedItems,
                monsterMatch,
                lv: mobData[monster]?.[0] ?? 0,
                keyword,
            };
        })
        .filter((entry) => {
            // 獲取等級篩選範圍
            const minLv =
                parseInt(document.getElementById("min-lv").value) || 0;
            const maxLv =
                parseInt(document.getElementById("max-lv").value) || Infinity;
            const lv = entry.lv ?? 0;
            return (
                (entry.monsterMatch ||
                    entry.matchedItems.length > 0 ||
                    !keyword) &&
                lv >= minLv &&
                lv <= maxLv
            );
        });
    lazyIndex = 0;
    document.getElementById("drop-container").innerHTML = "";
    loadNextBatch();
}

/**
 * 渲染單張怪物卡片到指定容器中
 *
 * @param {HTMLElement} container - 要將卡片加入的父容器元素
 * @param {string} monster - 怪物名稱
 * @param {string[]} items - 該怪物的掉落物品清單
 * @param {string} [keyword=""] - 搜尋關鍵字，用於高亮顯示與篩選
 */
function renderCard(container, monster, items, keyword = "") {
    // 獲取 "只顯示圖片" 的選項狀態
    const onlyShowImage = document.getElementById("toggle-name-hover").checked;

    // --- 開始建立卡片 ---
    const card = document.createElement("div");
    card.className = "monster-card";

    // 怪物圖片
    const monsterImg = document.createElement("img");
    monsterImg.src = `image/${encodeURIComponent(monster)}.png`;
    monsterImg.alt = monster;
    monsterImg.className = "monster-image";
    card.appendChild(monsterImg);

    // 怪物名稱 (包含高亮)
    const monsterTitle = document.createElement("div");
    monsterTitle.className = "monster-name";
    monsterTitle.innerHTML = highlight(getDisplayName(monster), keyword);
    card.appendChild(monsterTitle);

    // 如果有怪物的詳細屬性資料，則顯示
    if (mobData[monster]) {
        const [lv, hp, mp, exp, pdef, mdef, eva, acc, file, resistance] =
            mobData[monster];
        const attr = document.createElement("div");
        attr.className = "monster-attr";

        // 等級 (佔滿整行)
        const lvBox = document.createElement("div");
        lvBox.className = "attr-box fullwidth";
        lvBox.textContent = `等級：${lv}`;
        attr.appendChild(lvBox);

        // HP (特殊處理包含括號的血量)
        const hpBox = document.createElement("div");
        hpBox.className = "attr-box";
        if (String(hp).includes("(")) {
            const formattedHp = String(hp).replace(
                "(",
                '<br><span style="font-size: 0.9em">('
            );
            hpBox.innerHTML = `HP：${formattedHp}</span>`;
            hpBox.style.whiteSpace = "normal";
            hpBox.style.lineHeight = "1.4";
        } else {
            hpBox.textContent = `HP：${hp}`;
        }
        attr.appendChild(hpBox);

        // MP
        const mpBox = document.createElement("div");
        mpBox.className = "attr-box";
        mpBox.textContent = `MP：${mp}`;
        attr.appendChild(mpBox);

        // 經驗值
        const expBox = document.createElement("div");
        expBox.className = "attr-box";
        expBox.textContent = `經驗：${exp}`;
        attr.appendChild(expBox);

        // 迴避率
        const evaBox = document.createElement("div");
        evaBox.className = "attr-box";
        evaBox.textContent = `迴避：${eva}`;
        attr.appendChild(evaBox);

        // 物理防禦
        const pdBox = document.createElement("div");
        pdBox.className = "attr-box";
        pdBox.textContent = `物理防禦：${pdef}`;
        attr.appendChild(pdBox);

        // 魔法防禦
        const mdBox = document.createElement("div");
        mdBox.className = "attr-box";
        mdBox.textContent = `魔法防禦：${mdef}`;
        attr.appendChild(mdBox);

        // 命中需求 (佔滿整行)
        const accBox = document.createElement("div");
        accBox.className = "attr-box fullwidth";
        accBox.textContent = `命中需求：${acc}`;
        attr.appendChild(accBox);

        // 屬性抗性/加成資訊
        if (mobData[monster][9]) {
            const resText = mobData[monster][9];

            // 解析屬性字串 (e.g., "H2I3")
            const buffList = []; // 加成
            const resistList = []; // 抗性
            if (resText === "ALL2") {
                // 特殊代碼：物魔減半
                const span = document.createElement("span");
                span.className = "resistance-tag resistance-all2";
                span.textContent = "物攻/魔法屬性減半";
                resistList.push(span.outerHTML);
            } else {
                let i = 0;
                while (i < resText.length) {
                    // 特殊代碼：HS (Healable/可治癒)
                    if (
                        resText[i] === "H" &&
                        i + 1 < resText.length &&
                        resText[i + 1] === "S"
                    ) {
                        const span = document.createElement("span");
                        span.className = "resistance-tag resistance-heal";
                        span.textContent = "可治癒";
                        buffList.push(span.outerHTML);
                        i += 2;
                        continue;
                    }

                    // 處理一般屬性 (一個屬性由2個字元組成，如 H1)
                    const type = resText[i];
                    const value = resText[i + 1];
                    let typeText = "",
                        typeClass = "",
                        valueText = "";

                    // 轉換屬性代號
                    switch (type) {
                        case "H":
                            typeText = "聖";
                            typeClass = "holy";
                            break;
                        case "F":
                            typeText = "火";
                            typeClass = "fire";
                            break;
                        case "I":
                            typeText = "冰";
                            typeClass = "ice";
                            break;
                        case "S":
                            typeText = "毒";
                            typeClass = "poison";
                            break;
                        case "L":
                            typeText = "雷";
                            typeClass = "lightning";
                            break;
                    }

                    // 轉換效果代號
                    switch (value) {
                        case "1":
                            valueText = "無效";
                            break;
                        case "2":
                            valueText = "減半";
                            break;
                        case "3":
                            valueText = "加成";
                            break;
                    }

                    if (typeText && valueText) {
                        const span = document.createElement("span");
                        span.className = `resistance-tag resistance-${typeClass}`;
                        span.textContent = `${typeText}${valueText}`;
                        // 根據效果分類
                        if (value === "3") {
                            buffList.push(span.outerHTML);
                        } else {
                            resistList.push(span.outerHTML);
                        }
                    }
                    i += 2;
                }
            }

            // 如果有任何加成或抗性，則建立對應的顯示區塊
            if (buffList.length > 0 || resistList.length > 0) {
                const resBox = document.createElement("div");
                resBox.className = "attr-box fullwidth";

                // 顯示屬性加成
                if (buffList.length > 0) {
                    const buffDiv = document.createElement("div");
                    buffDiv.style.marginBottom = "4px";
                    buffDiv.style.display = "flex";
                    buffDiv.style.alignItems = "center";
                    buffDiv.style.gap = "8px";
                    buffDiv.style.flexWrap = "wrap";
                    buffDiv.style.justifyContent = "center";

                    buffDiv.innerHTML = `<span>屬性加成：</span><div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center;flex:1;">${buffList.join(
                        ""
                    )}</div>`;
                    resBox.appendChild(buffDiv);
                }

                // 顯示屬性抗性
                if (resistList.length > 0) {
                    const resistDiv = document.createElement("div");
                    resistDiv.style.display = "flex";
                    resistDiv.style.alignItems = "center";
                    resistDiv.style.gap = "8px";
                    resistDiv.style.flexWrap = "wrap";
                    resistDiv.style.justifyContent = "center";
                    resistDiv.innerHTML = `<span>屬性抗性：</span><div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center;flex:1;">${resistList.join(
                        ""
                    )}</div>`;
                    resBox.appendChild(resistDiv);
                }

                attr.appendChild(resBox);
            }
        }

        // 出沒地圖 (可摺疊)
        if (spawnMap[monster]) {
            const maps = Object.keys(spawnMap[monster]);
            const summary = `出沒地圖（${maps.length}張）`;

            const mapBox = document.createElement("div");
            mapBox.className = "attr-box fullwidth";
            mapBox.style.cursor = "pointer";

            const summarySpan = document.createElement("span");
            summarySpan.textContent = "▶ " + summary;
            summarySpan.style.userSelect = "none";
            summarySpan.style.cursor = "pointer";

            const detailSpan = document.createElement("span");
            detailSpan.innerHTML = maps
                .map(
                    (map) =>
                        `<div style='text-align:left' class="map-name">${map
                            .replace(/</g, "&lt;")
                            .replace(/>/g, "&gt;")}</div>`
                )
                .join("");
            detailSpan.style.display = "none";
            detailSpan.style.marginTop = "0.5em";
            detailSpan.style.marginLeft = "0.5em";
            detailSpan.style.color = "#aaa";
            detailSpan.style.userSelect = "text";
            mapBox.appendChild(summarySpan);
            mapBox.appendChild(detailSpan);

            // 點擊標題時展開/收合詳細地圖列表
            mapBox.addEventListener("click", (e) => {
                // 防止選取文字時觸發
                if (
                    window.getSelection().toString() ||
                    e.target.classList.contains("map-name")
                ) {
                    return;
                }
                e.stopPropagation();
                const isShown = detailSpan.style.display === "block";
                detailSpan.style.display = isShown ? "none" : "block";
                summarySpan.textContent = (isShown ? "▶ " : "▼ ") + summary;
            });

            attr.appendChild(mapBox);
        }

        // BOSS 重生時間
        if (bossTime[monster]) {
            const respawnBox = document.createElement("div");
            respawnBox.className = "attr-box fullwidth";
            respawnBox.textContent = `重生時間：${bossTime[monster]}`;
            attr.appendChild(respawnBox);
        }

        card.appendChild(attr);
    }

    // --- 處理掉落物 ---

    const itemContainer = document.createElement("div");
    if (onlyShowImage) itemContainer.className = "only-image-mode";

    // 建立不同類型物品的容器
    const equipContainer = document.createElement("div"); // 裝備
    const useContainer = document.createElement("div"); // 消耗
    const etcContainer = document.createElement("div"); // 其他
    const otherContainer = document.createElement("div"); // 未分類
    items.forEach((item) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = onlyShowImage ? "hide-text" : "item";

        // 物品名稱和數量 (利用 X or x 切割)
        const itemSplit = item.split(/[Xx]/);
        const itemName = itemSplit[0].trim();
        const itemNumber = itemSplit.length > 1 ? itemSplit[1].trim() : "";

        const itemImg = document.createElement("img");
        itemImg.src = `image/${encodeURIComponent(itemName)}.png`;
        itemImg.alt = itemName;
        itemImg.className = "item-icon";

        const itemId = parseInt(nameToIdMap[itemName] ?? "0");
        // 根據 Item ID 判斷是否為裝備
        const isEquip =
            (itemId >= 1000001 && itemId <= 1999999) ||
            (itemId >= 2060000 && itemId <= 2079999) ||
            (itemId >= 2330000 && itemId <= 2339999);

        // 如果物品符合關鍵字，給予高亮樣式
        if (keyword && matchesKeyword(itemName, keyword)) {
            itemImg.classList.add("highlighted");
        }

        const itemText = document.createElement("span");
        itemText.innerHTML = highlight(
            getDisplayName(itemName, itemNumber),
            keyword
        );

        // 為物品建立前往 maplesaga library 的外部連結
        const itemLink = document.createElement("a");
        const linkPath = isEquip ? "equip" : "item";
        itemLink.href = `https://maplesaga.com/library/cn/permalink/${linkPath}/${itemId}`;
        itemLink.target = "_blank";
        itemLink.style.color = "inherit";
        itemLink.style.textDecoration = "none";
        itemLink.appendChild(itemImg);
        itemLink.appendChild(itemText);
        itemDiv.appendChild(itemLink);

        // 根據 Item ID 將物品放入對應的分類容器
        if (isEquip) {
            equipContainer.appendChild(itemDiv);
        } else if (itemId >= 2000000 && itemId <= 2999999) {
            useContainer.appendChild(itemDiv);
        } else if (itemId >= 4000000 && itemId <= 4999999) {
            etcContainer.appendChild(itemDiv);
        } else {
            otherContainer.appendChild(itemDiv);
        }
    });

    // 如果分類容器中有物品，則將其加上外框並加入到主物品容器中
    if (equipContainer.hasChildNodes()) {
        const equipBox = document.createElement("div");
        equipBox.style.border = "1px solid #42aaff"; // 藍色框
        equipBox.style.padding = "4px";
        equipBox.style.marginBottom = "6px";
        equipBox.appendChild(equipContainer);
        itemContainer.appendChild(equipBox);
    }
    if (useContainer.hasChildNodes()) {
        const useBox = document.createElement("div");
        useBox.style.border = "1px solid #42ff42"; // 綠色框
        useBox.style.padding = "4px";
        useBox.style.marginBottom = "6px";
        useBox.appendChild(useContainer);
        itemContainer.appendChild(useBox);
    }
    if (etcContainer.hasChildNodes()) {
        const etcBox = document.createElement("div");
        etcBox.style.border = "1px solid #ffaa42"; // 橘色框
        etcBox.style.padding = "4px";
        etcBox.style.marginBottom = "6px";
        etcBox.appendChild(etcContainer);
        itemContainer.appendChild(etcBox);
    }
    itemContainer.appendChild(otherContainer); // 未分類的直接加入

    card.appendChild(itemContainer);
    container.appendChild(card); // 將完成的卡片加入到頁面容器中

    // 如果篩選後沒有任何卡片，顯示提示訊息
    if (!container.hasChildNodes()) {
        container.textContent = "找不到符合的怪物或掉落物";
    }
}

// 載入下一批資料
function loadNextBatch() {
    const container = document.getElementById("drop-container");
    const end = Math.min(lazyIndex + BATCH_SIZE, lazyData.length);
    if (lazyIndex >= lazyData.length) {
        return;
    }
    for (let i = lazyIndex; i < end; i++) {
        const { monster, items, keyword } = lazyData[i];
        // 呼叫原本單一怪物的卡片渲染邏輯
        const fragment = document.createDocumentFragment();
        renderCard(fragment, monster, items, keyword);
        container.appendChild(fragment);
    }

    lazyIndex = end;
    if (lazyIndex >= lazyData.length) {
        const noMoreTip = document.getElementById("no-more-tip");
        noMoreTip.style.display = "block";
    }
}
/**
 * 刷新頁面顯示的總入口函式
 * 根據目前所有的篩選條件（關鍵字、區域、屬性等）重新渲染卡片
 */
function refresh() {
    const keyword = document.getElementById("search").value;
    const onlyMatchedDrops = document.getElementById("toggle-filtered").checked;
    const regionSet = selectedRegions;
    lazyIndex = 0;
    document.getElementById("drop-container").innerHTML = "";
    // 定義區域篩選邏輯
    const filterByRegion = (monster) => {
        if (!spawnMap[monster]) return true; // 沒有地圖資訊的怪物預設通過
        if (regionSet.size === 0) return true; // 若未選擇任何區域，則全部通過
        const maps = Object.keys(spawnMap[monster]);
        // 檢查怪物的任何一張出沒地圖是否在被選中的區域內
        return maps.some((map) => regionSet.has(map.split("：")[0]));
    };

    // 定義屬性篩選邏輯
    const filterByResistance = (monster) => {
        if (selectedResistances.size === 0) return true; // 若未選擇任何屬性，則全部通過
        const resistance = mobData[monster]?.[9];
        if (!resistance) return false; // 沒有屬性資訊的怪物不通過

        if (resistance === "ALL2" && selectedResistances.has("ALL2"))
            return true;

        // 遍歷怪物的屬性字串
        for (let i = 0; i < resistance.length; i += 2) {
            const key = resistance.substring(i, i + 2);
            if (selectedResistances.has(key)) return true;
        }
        return false;
    };

    // 根據篩選條件過濾出最終要顯示的怪物
    const filteredDrop = {};
    for (const [monster, items] of Object.entries(dropData)) {
        if (filterByRegion(monster) && filterByResistance(monster)) {
            filteredDrop[monster] = items;
        }
    }
    // 使用過濾後的資料重新渲染卡片
    prepareLazyRender(filteredDrop, keyword, onlyMatchedDrops);
}

/**
 * =================================================================
 * 資料載入與初始化
 * =================================================================
 */

// 使用 Promise.all 同時發起所有 JSON 檔案的請求
Promise.all([
    fetch("drop_data.json").then((res) => res.json()),
    fetch("mob.json").then((res) => res.json()),
    fetch("item.json").then((res) => res.json()),
    fetch("boss_time.json").then((res) => res.json()),
    fetch("map.json").then((res) => res.json()),
    fetch("map_exception.json").then((res) => res.json()),
    fetch("area.json").then((res) => res.json()),
    fetch("alias.json").then((res) => res.json()),
])
    .then(([drop, mob, itemMap, boss, map, mapException, areaData, alias]) => {
        // --- 資料前處理 ---

        spawnMap = {};
        area = areaData;
        aliasMap = alias;

        // 處理地圖資料，校正地圖名稱並建立 spawnMap
        for (const [monster, maps] of Object.entries(map)) {
            spawnMap[monster] = {};
            for (const [mapName, value] of Object.entries(maps)) {
                // 根據 map_exception.json 校正或過濾地圖
                if (mapException[mapName] !== undefined) {
                    if (mapException[mapName] !== "INVALID") {
                        spawnMap[monster][mapException[mapName]] = value;
                    }
                    continue;
                }
                const [region, ...rest] = mapName.split("：");
                if (mapException[region] === "INVALID") {
                    continue;
                }
                const correctRegion = mapException[region] || region;
                const correctMapName = [correctRegion, ...rest].join("：");
                spawnMap[monster][correctMapName] = value;
            }
            // 如果處理完怪物沒有任何有效率地圖，則從 spawnMap 中刪除
            if (Object.keys(spawnMap[monster]).length === 0) {
                delete spawnMap[monster];
            }
        }

        bossTime = boss;
        mobData = mob;

        // 建立 item name -> id 的映射表
        nameToIdMap = {};
        for (const [id, name] of Object.entries(itemMap)) {
            nameToIdMap[name] = id;
        }

        // 處理掉落資料，將每個怪物的掉落物進行排序
        Object.entries(drop).forEach(([monster, items]) => {
            drop[monster] = items.sort((a, b) => {
                const aId = parseInt(nameToIdMap[a] ?? "0");
                const bId = parseInt(nameToIdMap[b] ?? "0");
                const isAEquip = aId >= 1000001 && aId <= 1999999;
                const isBEquip = bId >= 1000001 && bId <= 1999999;

                // 裝備優先顯示
                if (isAEquip && !isBEquip) return -1;
                if (!isAEquip && isBEquip) return 1;

                // 其次按 ID 排序
                return aId - bId;
            });
        });
        dropData = drop;

        // --- 動態生成 UI 介面 ---

        // 根據地圖資料生成 "區域選擇" 的核取方塊
        const regionSet = new Set();
        for (const maps of Object.values(spawnMap)) {
            Object.keys(maps).forEach((map) =>
                regionSet.add(map.split("：")[0])
            );
        }
        const regionCheckboxes = document.getElementById("region-checkboxes");
        Object.entries(area).forEach(([region, defaultChecked]) => {
            if (regionSet.has(region)) {
                const label = document.createElement("label");
                const checkbox = document.createElement("input");
                checkbox.type = "checkbox";
                checkbox.value = region;
                checkbox.checked = defaultChecked === 1; // 根據 area.json 的設定決定是否預設勾選
                if (checkbox.checked) selectedRegions.add(region);
                checkbox.addEventListener("change", () => {
                    if (checkbox.checked) selectedRegions.add(region);
                    else selectedRegions.delete(region);
                    refresh();
                });
                label.appendChild(checkbox);
                label.append(` ${region}`);
                regionCheckboxes.appendChild(label);
            }
        });

        // 根據怪物屬性資料生成 "屬性選擇" 的按鈕
        const resistanceLabels = {
            H: "聖",
            F: "火",
            I: "冰",
            S: "毒",
            L: "雷",
        };
        const valueLabels = { 3: "加成" }; // 只篩選有 "加成" 效果的屬性

        const resistanceTypes = new Set();
        Object.values(mob).forEach((mobInfo) => {
            const resistance = mobInfo[9];
            if (!resistance) return;
            if (resistance === "ALL2") return; // 忽略 ALL2

            let i = 0;
            while (i < resistance.length) {
                if (resistance.substring(i, i + 2) === "HS") {
                    resistanceTypes.add("HS"); // 可治癒
                    i += 2;
                    continue;
                }
                const type = resistance[i];
                const value = resistance[i + 1];
                // 只關心有加成效果 (value === '3') 的魔法屬性
                if (
                    type !== "P" &&
                    value === "3" &&
                    resistanceLabels[type] &&
                    valueLabels[value]
                ) {
                    resistanceTypes.add(`${type}${value}`);
                }
                i += 2;
            }
        });

        const resistanceCheckboxes = document.getElementById(
            "resistance-checkboxes"
        );

        // 對屬性按鈕進行排序
        const sortedResistances = Array.from(resistanceTypes).sort((a, b) => {
            // 定義順序權重
            const order = {
                F3: 1, // 火加成
                S3: 2, // 毒加成
                I3: 3, // 冰加成
                L3: 4, // 雷加成
                H3: 5, // 聖加成
                HS: 6, // 可治癒
            };
            return (order[a] || 99) - (order[b] || 99);
        });

        // 建立屬性篩選按鈕
        sortedResistances.forEach((resistance) => {
            const label = document.createElement("label");
            const button = document.createElement("button");
            button.type = "button";
            button.value = resistance;

            if (resistance === "HS") {
                button.textContent = "可治癒";
            } else {
                const type = resistance[0];
                const value = resistance[1];
                button.textContent = `${resistanceLabels[type]}${valueLabels[value]}`;
            }

            button.addEventListener("click", () => {
                button.classList.toggle("selected"); // 切換選中樣式
                if (button.classList.contains("selected")) {
                    selectedResistances.add(resistance);
                } else {
                    selectedResistances.delete(resistance);
                }
                refresh();
            });
            label.appendChild(button);
            resistanceCheckboxes.appendChild(label);
        });

        // 所有資料處理和 UI 生成完畢後，執行第一次渲染
        refresh();
    })
    .catch((error) => {
        // 如果資料載入失敗，顯示錯誤訊息
        document.getElementById("drop-container").innerText =
            "載入失敗：" + error;
    });

/**
 * =================================================================
 * 事件監聽器
 * =================================================================
 */

let debounceTimer; // 用於防抖的計時器
const delay = 500; // 防抖延遲時間 (毫秒)
// 為各個輸入框和選項設定監聽器，當使用者操作時，延遲 300 毫秒後觸發 refresh
// 使用 debounce (防抖) 可以避免使用者連續輸入時頻繁觸發刷新，提升效能
document.getElementById("search").addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refresh, delay);
});
document.getElementById("toggle-filtered").addEventListener("change", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refresh, delay);
});
document.getElementById("toggle-name-hover").addEventListener("change", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refresh, delay);
});
document.getElementById("min-lv").addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refresh, delay);
});
document.getElementById("max-lv").addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refresh, delay);
});

// "分享" 按鈕的點擊事件
document.getElementById("share-btn").addEventListener("click", function () {
    const searchValue = document.getElementById("search").value;
    const url = new URL(window.location.href);
    // 將目前的搜尋關鍵字加入到網址參數中
    url.searchParams.set("searchkey", searchValue);
    // 將產生的網址複製到使用者剪貼簿
    navigator.clipboard.writeText(url.toString()).then(() => {
        alert("已複製分享連結！");
    });
});

/**
 * =================================================================
 * UI 控制函式
 * =================================================================
 */

// 切換 "區域選擇" 面板的顯示與隱藏
function toggleRegions() {
    const regionControls = document.querySelector(".region-controls");
    const toggleBtn = document.querySelector(".toggle-regions-btn");
    regionControls.classList.toggle("show");
    toggleBtn.textContent = regionControls.classList.contains("show")
        ? "隱藏區域選擇"
        : "區域選擇";
}

// 全選所有區域
function selectAllRegions() {
    const checkboxes = document.querySelectorAll(
        '#region-checkboxes input[type="checkbox"]'
    );
    checkboxes.forEach((checkbox) => {
        checkbox.checked = true;
        selectedRegions.add(checkbox.value);
    });
    refresh();
}

// 取消全選所有區域
function deselectAllRegions() {
    const checkboxes = document.querySelectorAll(
        '#region-checkboxes input[type="checkbox"]'
    );
    checkboxes.forEach((checkbox) => {
        checkbox.checked = false;
        selectedRegions.delete(checkbox.value);
    });
    refresh();
}

// 選擇預設區域 (根據 area.json 的設定)
function selectDefaultRegions() {
    const checkboxes = document.querySelectorAll(
        '#region-checkboxes input[type="checkbox"]'
    );
    selectedRegions.clear();

    checkboxes.forEach((checkbox) => {
        const region = checkbox.value;
        const isDefaultRegion = area[region] === 1;
        checkbox.checked = isDefaultRegion;
        if (isDefaultRegion) {
            selectedRegions.add(region);
        }
    });

    refresh();
}

// 切換 "屬性選擇" 面板的顯示與隱藏
function toggleResistance() {
    const resistanceControls = document.querySelector(".resistance-controls");
    const toggleBtn = document.querySelector(".toggle-resistance-btn");
    resistanceControls.classList.toggle("show");
    toggleBtn.textContent = resistanceControls.classList.contains("show")
        ? "隱藏屬性選擇"
        : "屬性選擇";
}

// 監聽頁面滾動事件，以控制頁腳免責聲明的顯示與隱藏
let lastScrollTop = 0;
const disclaimer = document.querySelector(".disclaimer");

window.addEventListener("scroll", () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    // 當滾動到最頂部時，顯示免責聲明
    if (scrollTop <= 0) {
        disclaimer.classList.remove("hidden");
    }
    // 當向下方滾動時，隱藏免責聲明
    else if (scrollTop > lastScrollTop) {
        disclaimer.classList.add("hidden");
    }

    lastScrollTop = scrollTop;
});

// 監聽滾動事件載入更多
window.addEventListener("scroll", () => {
    if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 100
    ) {
        loadNextBatch();
    }
});

// 建立PWA
if ("serviceWorker" in navigator) {
    navigator.serviceWorker
        .register("./service-worker.js", { type: "module" })
        .then((reg) => {
            console.log("✅ Service worker registered.", reg);

            if (reg.waiting) {
                if (confirm("已有新版本可用，是否立即更新？")) {
                    reg.waiting.postMessage("SKIP_WAITING");
                }
            }
            // 監聽更新狀態
            reg.onupdatefound = () => {
                const newWorker = reg.installing;
                newWorker.onstatechange = () => {
                    if (newWorker.state === "installed") {
                        if (navigator.serviceWorker.controller) {
                            // 有新版本 → 通知用戶
                            if (confirm("已有新版本可用，是否立即更新？")) {
                                newWorker.postMessage("SKIP_WAITING");
                            }
                        } else {
                            console.log("PWA 已安裝並可離線使用");
                        }
                    }
                };
            };
        });

    // 監聽 controllerchange → 強制 reload 新版本
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        window.location.reload();
    });
}
