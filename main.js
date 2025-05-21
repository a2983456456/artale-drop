const params = new URLSearchParams(window.location.search);
const searchParam = params.get("searchkey") || "";
document.getElementById("search").value = searchParam;
let dropData = {};
let mobData = {};
let nameToIdMap = {};
let bossTime = {};
let spawnMap = {};
let selectedRegions = new Set();
let area = {}; // 添加 area 全域變數

function highlight(text, keyword) {
  if (!keyword) return text;
  const regex = new RegExp(`(${keyword})`, "gi");
  return text.replace(regex, "<mark>$1</mark>");
}

function renderCards(data, keyword = "", onlyMatchedDrops = false) {
  const minLv = parseInt(document.getElementById("min-lv").value) || 0;
  const maxLv = parseInt(document.getElementById("max-lv").value) || Infinity;
  const container = document.getElementById("drop-container");
  container.innerHTML = "";
  const loweredKeyword = keyword.toLowerCase();
  const onlyShowImage = document.getElementById("toggle-name-hover").checked;

  Object.entries(data)
    .sort(([a], [b]) => {
      const aLv = mobData[a]?.[0] ?? 0;
      const bLv = mobData[b]?.[0] ?? 0;
      return aLv - bLv;
    })
    .forEach(([monster, items]) => {
      const monsterMatch = monster.toLowerCase().includes(loweredKeyword);
      const matchedItems = items.filter((item) =>
        item.toLowerCase().includes(loweredKeyword)
      );
      const lv = mobData[monster]?.[0] ?? 0;
      const shouldShow =
        (!keyword || monsterMatch || matchedItems.length > 0) &&
        lv >= minLv &&
        lv <= maxLv;
      if (!shouldShow) return;

      const card = document.createElement("div");
      card.className = "monster-card";

      const monsterImg = document.createElement("img");
      monsterImg.src = `image/${encodeURIComponent(monster)}.png`;
      monsterImg.alt = monster;
      monsterImg.className = "monster-image";
      card.appendChild(monsterImg);

      const monsterTitle = document.createElement("div");
      monsterTitle.className = "monster-name";
      monsterTitle.innerHTML = highlight(monster, keyword);
      card.appendChild(monsterTitle);

      if (mobData[monster]) {
        const [lv, hp, mp, exp, pdef, mdef, eva, acc, file] = mobData[monster];
        const attr = document.createElement("div");
        attr.className = "monster-attr";

        // 等級（占兩欄）
        const lvBox = document.createElement("div");
        lvBox.className = "attr-box fullwidth";
        lvBox.textContent = `等級：${lv}`;
        attr.appendChild(lvBox);

        // HP 和 MP
        const hpBox = document.createElement("div");
        hpBox.className = "attr-box";
        hpBox.textContent = `HP：${hp}`;
        attr.appendChild(hpBox);

        const mpBox = document.createElement("div");
        mpBox.className = "attr-box";
        mpBox.textContent = `MP：${mp}`;
        attr.appendChild(mpBox);

        // 經驗 和 迴避
        const expBox = document.createElement("div");
        expBox.className = "attr-box";
        expBox.textContent = `經驗：${exp}`;
        attr.appendChild(expBox);

        const evaBox = document.createElement("div");
        evaBox.className = "attr-box";
        evaBox.textContent = `迴避：${eva}`;
        attr.appendChild(evaBox);

        // 物防 和 魔防
        const pdBox = document.createElement("div");
        pdBox.className = "attr-box";
        pdBox.textContent = `物理防禦：${pdef}`;
        attr.appendChild(pdBox);

        const mdBox = document.createElement("div");
        mdBox.className = "attr-box";
        mdBox.textContent = `魔法防禦：${mdef}`;
        attr.appendChild(mdBox);

        // 命中需求（占兩欄）
        const accBox = document.createElement("div");
        accBox.className = "attr-box fullwidth";
        accBox.textContent = `命中需求：${acc}`;
        attr.appendChild(accBox);

        if (spawnMap[monster]) {
          const maps = Object.keys(spawnMap[monster]);
          const summary = `出沒地圖（${maps.length}張）`;

          const mapBox = document.createElement("div");
          mapBox.className = "attr-box fullwidth";
          mapBox.style.cursor = "pointer";

          const summarySpan = document.createElement("span");
          summarySpan.textContent = "▶ " + summary;

          const detailSpan = document.createElement("span");
          detailSpan.innerHTML = maps
            .map(
              (map) =>
                `<div style='text-align:left' class="map-name">${map}</div>`
            )
            .join("");
          detailSpan.style.display = "none";
          detailSpan.style.marginTop = "0.5em";
          detailSpan.style.marginLeft = "0.5em";
          detailSpan.style.color = "#aaa";
          detailSpan.style.userSelect = "text"; // 允許選取文字

          mapBox.appendChild(summarySpan);
          mapBox.appendChild(detailSpan);

          summarySpan.style.userSelect = "none"; // 禁止選取符號部分，避免誤選
          summarySpan.style.cursor = "pointer";

          mapBox.addEventListener("click", (e) => {
            // 如果正在選取文字，或點擊到地圖名稱，不執行收合操作
            if (
              window.getSelection().toString() ||
              e.target.classList.contains("map-name")
            ) {
              return;
            }
            e.stopPropagation(); // 防止冒泡
            const isShown = detailSpan.style.display === "block";
            detailSpan.style.display = isShown ? "none" : "block";
            summarySpan.textContent = (isShown ? "▶ " : "▼ ") + summary;
          });

          attr.appendChild(mapBox);
        }

        if (bossTime[monster]) {
          const respawnBox = document.createElement("div");
          respawnBox.className = "attr-box fullwidth";
          respawnBox.textContent = `重生時間：${bossTime[monster]}`;
          attr.appendChild(respawnBox);
        }

        card.appendChild(attr);
      }

      const itemsToShow = onlyMatchedDrops && keyword ? matchedItems : items;

      const itemContainer = document.createElement("div");
      if (onlyShowImage) itemContainer.className = "only-image-mode";

      const equipContainer = document.createElement("div");
      const useContainer = document.createElement("div");
      const etcContainer = document.createElement("div");
      const otherContainer = document.createElement("div");

      itemsToShow.forEach((item) => {
        const itemDiv = document.createElement("div");
        itemDiv.className = onlyShowImage ? "hide-text" : "item";

        const itemImg = document.createElement("img");
        itemImg.src = `image/${encodeURIComponent(item)}.png`;
        itemImg.alt = item;
        itemImg.className = "item-icon";

        const itemId = parseInt(nameToIdMap[item] ?? "0");
        const isEquip =
          (itemId >= 1000001 && itemId <= 1999999) ||
          (itemId >= 2060000 && itemId <= 2079999) ||
          (itemId >= 2330000 && itemId <= 2339999);
        const isConsumable = itemId >= 2000000 && itemId <= 2999999;

        if (keyword && item.toLowerCase().includes(loweredKeyword)) {
          itemImg.classList.add("highlighted");
        }

        const itemText = document.createElement("span");
        itemText.innerHTML = highlight(item, keyword);

        if (isEquip) {
          const itemLink = document.createElement("a");
          itemLink.href = `https://maplesaga.com/library/cn/permalink/equip/${itemId}`;
          itemLink.target = "_blank";
          itemLink.style.color = "inherit";
          itemLink.style.textDecoration = "none";
          itemLink.appendChild(itemImg);
          itemLink.appendChild(itemText);
          itemDiv.appendChild(itemLink);
        } else {
          const itemLink = document.createElement("a");
          itemLink.href = `https://maplesaga.com/library/cn/permalink/item/${itemId}`;
          itemLink.target = "_blank";
          itemLink.style.color = "inherit";
          itemLink.style.textDecoration = "none";
          itemLink.appendChild(itemImg);
          itemLink.appendChild(itemText);
          itemDiv.appendChild(itemLink);
        }

        if (isEquip) {
          equipContainer.appendChild(itemDiv);
        } else if (isConsumable) {
          useContainer.appendChild(itemDiv);
        } else if (itemId >= 4000000 && itemId <= 4999999) {
          etcContainer.appendChild(itemDiv);
        } else {
          otherContainer.appendChild(itemDiv);
        }
      });

      if (equipContainer.hasChildNodes()) {
        const equipBox = document.createElement("div");
        equipBox.style.border = "1px solid #42aaff";
        equipBox.style.padding = "4px";
        equipBox.style.marginBottom = "6px";
        equipBox.appendChild(equipContainer);
        itemContainer.appendChild(equipBox);
      }
      if (useContainer.hasChildNodes()) {
        const useBox = document.createElement("div");
        useBox.style.border = "1px solid #42ff42";
        useBox.style.padding = "4px";
        useBox.style.marginBottom = "6px";
        useBox.appendChild(useContainer);
        itemContainer.appendChild(useBox);
      }
      if (etcContainer.hasChildNodes()) {
        const etcBox = document.createElement("div");
        etcBox.style.border = "1px solid #ffaa42";
        etcBox.style.padding = "4px";
        etcBox.style.marginBottom = "6px";
        etcBox.appendChild(etcContainer);
        itemContainer.appendChild(etcBox);
      }
      itemContainer.appendChild(otherContainer);

      card.appendChild(itemContainer);
      container.appendChild(card);
    });

  if (!container.hasChildNodes()) {
    container.textContent = "找不到符合的怪物或掉落物";
  }
}

function refresh() {
  const keyword = document.getElementById("search").value;
  const onlyMatchedDrops = document.getElementById("toggle-filtered").checked;
  const regionSet = selectedRegions;

  const filterByRegion = (monster) => {
    const maps = spawnMap[monster] ? Object.keys(spawnMap[monster]) : [];
    if (regionSet.size === 0) return true;
    return maps.some((map) => regionSet.has(map.split("：")[0]));
  };

  const filteredDrop = {};
  for (const [monster, items] of Object.entries(dropData)) {
    if (filterByRegion(monster)) {
      filteredDrop[monster] = items;
    }
  }

  renderCards(filteredDrop, keyword, onlyMatchedDrops);
}

Promise.all([
  fetch("drop_data.json").then((res) => res.json()),
  fetch("mob.json").then((res) => res.json()),
  fetch("item.json").then((res) => res.json()),
  fetch("boss_time.json").then((res) => res.json()),
  fetch("map.json").then((res) => res.json()),
  fetch("map_exception.json").then((res) => res.json()),
  fetch("area.json").then((res) => res.json()),
])
  .then(([drop, mob, itemMap, boss, map, mapException, areaData]) => {
    spawnMap = {};
    area = areaData; // 儲存 area 資料到全域變數
    // 過濾掉無效區域的地圖，並修正區域名稱
    for (const [monster, maps] of Object.entries(map)) {
      spawnMap[monster] = {};
      for (const [mapName, value] of Object.entries(maps)) {
        // 先檢查是否為完整地圖名稱的替換
        if (mapException[mapName] !== undefined) {
          if (mapException[mapName] !== "INVALID") {
            spawnMap[monster][mapException[mapName]] = value;
          }
          continue;
        }

        // 如果不是完整地圖名稱，則檢查區域名稱
        const [region, ...rest] = mapName.split("：");
        if (mapException[region] === "INVALID") {
          // 如果區域被標記為無效，則跳過
          continue;
        }
        // 如果在 map_exception 中有對應的正確名稱，就使用它；否則保持原樣
        const correctRegion = mapException[region] || region;
        const correctMapName = [correctRegion, ...rest].join("：");
        spawnMap[monster][correctMapName] = value;
      }
      // 如果過濾後該怪物沒有任何地圖，則刪除該怪物的地圖資訊
      if (Object.keys(spawnMap[monster]).length === 0) {
        delete spawnMap[monster];
      }
    }

    bossTime = boss;
    mobData = mob;
    // 根據 item ID 排序每個怪物的掉落物
    nameToIdMap = {};
    for (const [id, name] of Object.entries(itemMap)) {
      nameToIdMap[name] = id;
    }
    Object.entries(drop).forEach(([monster, items]) => {
      drop[monster] = items.sort((a, b) => {
        const aId = parseInt(nameToIdMap[a] ?? "0");
        const bId = parseInt(nameToIdMap[b] ?? "0");
        const isAEquip = aId >= 1000001 && aId <= 1999999;
        const isBEquip = bId >= 1000001 && bId <= 1999999;

        if (isAEquip && !isBEquip) return -1;
        if (!isAEquip && isBEquip) return 1;

        return (aId || 0) - (bId || 0);
      });
    });
    dropData = drop;

    // 初始化區域勾選框
    const regionSet = new Set();
    for (const maps of Object.values(spawnMap)) {
      Object.keys(maps).forEach((map) => regionSet.add(map.split("：")[0]));
    }
    const regionCheckboxes = document.getElementById("region-checkboxes");
    // 使用 area.json 的順序
    Object.entries(area).forEach(([region, defaultChecked]) => {
      if (regionSet.has(region)) {
        // 只顯示有怪物的區域
        const label = document.createElement("label");
        label.style.marginRight = "8px";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = region;
        checkbox.checked = defaultChecked === 1; // 根據 area.json 設定預設勾選狀態
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
    refresh();
  })
  .catch((error) => {
    document.getElementById("drop-container").innerText = "載入失敗：" + error;
  });

let debounceTimer;
document.getElementById("search").addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refresh, 300);
});
document.getElementById("toggle-filtered").addEventListener("change", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refresh, 300);
});
document.getElementById("toggle-name-hover").addEventListener("change", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refresh, 300);
});
document.getElementById("min-lv").addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refresh, 300);
});
document.getElementById("max-lv").addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refresh, 300);
});
document.getElementById("share-btn").addEventListener("click", function () {
  const searchValue = document.getElementById("search").value;
  const url = new URL(window.location.href);
  url.searchParams.set("searchkey", searchValue);
  navigator.clipboard.writeText(url.toString()).then(() => {
    alert("已複製分享連結！");
  });
});

function toggleRegions() {
  const regionControls = document.querySelector(".region-controls");
  const toggleBtn = document.querySelector(".toggle-regions-btn");
  regionControls.classList.toggle("show");
  toggleBtn.textContent = regionControls.classList.contains("show")
    ? "隱藏區域選擇"
    : "顯示區域選擇";
}

function toggleAllRegions() {
  const btn = document.querySelector(".toggle-all-btn");
  const isSelectAll = btn.textContent === "全選區域";
  const checkboxes = document.querySelectorAll(
    '#region-checkboxes input[type="checkbox"]'
  );

  checkboxes.forEach((checkbox) => {
    checkbox.checked = isSelectAll;
    if (isSelectAll) {
      selectedRegions.add(checkbox.value);
    } else {
      selectedRegions.delete(checkbox.value);
    }
  });

  btn.textContent = isSelectAll ? "取消全選區域" : "全選區域";
  refresh();
}

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

  // 重置全選按鈕的狀態
  document.querySelector(".toggle-all-btn").textContent = "全選區域";
  refresh();
}
