const params = new URLSearchParams(window.location.search);
const searchParam = params.get('searchkey') || ''; 
document.getElementById('search').value = searchParam;  
let dropData = {};
let mobData = {};
let nameToIdMap = {};
let bossTime = {};
let spawnMap = {};
let selectedRegions = new Set();
let area = {};
let aliasMap = {};
let selectedResistances = new Set();

function highlight(text, keyword) {
  if (!keyword) return text;
  
  // 處理 OR 搜尋的高亮
  if (keyword.includes('|')) {
    const keywords = keyword.split('|').map(k => k.trim());
    let highlightedText = text;
    keywords.forEach(k => {
      const regex = new RegExp(`(${k})`, 'gi');
      highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    });
    return highlightedText;
  }

  // 一般搜尋的高亮
  const regex = new RegExp(`(${keyword})`, 'gi');
  return text.replace(regex, '<mark>$1</mark>');
}

function isBoss(monster) {
  return bossTime && Object.prototype.hasOwnProperty.call(bossTime, monster);
}

function getDisplayName(item) {
  let name = item;
  if (aliasMap[item] && aliasMap[item] !== item) {
    name = `${item}(${aliasMap[item]})`;
  }
  if (isBoss(item)) {
    name += ' (BOSS)';
  }
  return name;
}

function matchesKeyword(item, keyword) {
  if (!keyword) return true;
  const loweredItem = item.toLowerCase();
  const alias = aliasMap[item];
  
  // 處理 OR 搜尋
  if (keyword.includes('|')) {
    const keywords = keyword.split('|').map(k => k.trim().toLowerCase());
    return keywords.some(k => {
      if (k === 'boss' && isBoss(item)) return true;
      return loweredItem.includes(k) || (alias && alias.toLowerCase().includes(k));
    });
  }

  // 一般搜尋
  const loweredKeyword = keyword.toLowerCase();
  if (loweredKeyword === 'boss' && isBoss(item)) return true;
  return loweredItem.includes(loweredKeyword) || 
         (alias && alias.toLowerCase().includes(loweredKeyword));
}

function renderCards(data, keyword = '', onlyMatchedDrops = false) {
  const minLv = parseInt(document.getElementById('min-lv').value) || 0;
  const maxLv = parseInt(document.getElementById('max-lv').value) || Infinity;
  const container = document.getElementById('drop-container');
  container.innerHTML = '';
  const loweredKeyword = keyword.toLowerCase();
  const onlyShowImage = document.getElementById('toggle-name-hover').checked;

  Object.entries(data)
    .sort(([a], [b]) => {
      const aLv = mobData[a]?.[0] ?? 0;
      const bLv = mobData[b]?.[0] ?? 0;
      return aLv - bLv;
    })
    .forEach(([monster, items]) => {
      const monsterMatch = matchesKeyword(monster, keyword);
      const matchedItems = items.filter(item => matchesKeyword(item, keyword));
      const lv = mobData[monster]?.[0] ?? 0;
      const shouldShow = (!keyword || monsterMatch || matchedItems.length > 0) && lv >= minLv && lv <= maxLv;
      if (!shouldShow) return;

      const card = document.createElement('div');
      card.className = 'monster-card';

      const monsterImg = document.createElement('img');
      monsterImg.src = `image/${encodeURIComponent(monster)}.png`;
      monsterImg.alt = monster;
      monsterImg.className = 'monster-image';
      card.appendChild(monsterImg);

      const monsterTitle = document.createElement('div');
      monsterTitle.className = 'monster-name';
      monsterTitle.innerHTML = highlight(getDisplayName(monster), keyword);
      card.appendChild(monsterTitle);

      if (mobData[monster]) {
        const [lv, hp, mp, exp, pdef, mdef, eva, acc, file] = mobData[monster];
        const attr = document.createElement('div');
        attr.className = 'monster-attr';

        // 等級（占兩欄）
        const lvBox = document.createElement('div');
        lvBox.className = 'attr-box fullwidth';
        lvBox.textContent = `等級：${lv}`;
        attr.appendChild(lvBox);

        // HP 和 MP
        const hpBox = document.createElement('div');
        hpBox.className = 'attr-box';
        if (String(hp).includes('(')) {
          const formattedHp = String(hp).replace('(', '<br><span style="font-size: 0.9em">(');
          hpBox.innerHTML = `HP：${formattedHp}</span>`;
          hpBox.style.whiteSpace = 'normal';
          hpBox.style.lineHeight = '1.4';
        } else {
          hpBox.textContent = `HP：${hp}`;
        }
        attr.appendChild(hpBox);

        const mpBox = document.createElement('div');
        mpBox.className = 'attr-box';
        mpBox.textContent = `MP：${mp}`;
        attr.appendChild(mpBox);

        // 經驗 和 迴避
        const expBox = document.createElement('div');
        expBox.className = 'attr-box';
        expBox.textContent = `經驗：${exp}`;
        attr.appendChild(expBox);

        const evaBox = document.createElement('div');
        evaBox.className = 'attr-box';
        evaBox.textContent = `迴避：${eva}`;
        attr.appendChild(evaBox);

        // 物防 和 魔防
        const pdBox = document.createElement('div');
        pdBox.className = 'attr-box';
        pdBox.textContent = `物理防禦：${pdef}`;
        attr.appendChild(pdBox);

        const mdBox = document.createElement('div');
        mdBox.className = 'attr-box';
        mdBox.textContent = `魔法防禦：${mdef}`;
        attr.appendChild(mdBox);

        // 命中需求（占兩欄）
        const accBox = document.createElement('div');
        accBox.className = 'attr-box fullwidth';
        accBox.textContent = `命中需求：${acc}`;
        attr.appendChild(accBox);

        // 新增屬性剋制資訊
        if (mobData[monster][9]) {
          const resBox = document.createElement('div');
          resBox.className = 'attr-box fullwidth';
          const resText = mobData[monster][9];
          
          // 解析屬性剋制字串
          const buffList = [];
          const resistList = [];
          if (resText === 'ALL2') {
            const span = document.createElement('span');
            span.className = 'resistance-tag resistance-all2';
            span.textContent = '物攻/魔法屬性減半';
            resistList.push(span.outerHTML);
          } else {
            let i = 0;
            while (i < resText.length) {
              // 檢查是否是可治癒狀態
              if (resText[i] === 'H' && i + 1 < resText.length && resText[i + 1] === 'S') {
                const span = document.createElement('span');
                span.className = 'resistance-tag resistance-heal';
                span.textContent = '可治癒';
                buffList.push(span.outerHTML);
                i += 2;
                continue;
              }

              // 處理一般屬性
              const type = resText[i];
              const value = resText[i + 1];
              let typeText = '';
              let typeClass = '';
              let valueText = '';
              
              // 轉換屬性代號和對應的CSS類別
              switch (type) {
                case 'H': 
                  typeText = '聖';
                  typeClass = 'holy';
                  break;
                case 'F': 
                  typeText = '火';
                  typeClass = 'fire';
                  break;
                case 'I': 
                  typeText = '冰';
                  typeClass = 'ice';
                  break;
                case 'S': 
                  typeText = '毒';
                  typeClass = 'poison';
                  break;
                case 'L': 
                  typeText = '雷';
                  typeClass = 'lightning';
                  break;
              }
              
              // 轉換效果代號
              switch (value) {
                case '1': valueText = '無效'; break;
                case '2': valueText = '減半'; break;
                case '3': valueText = '加成'; break;
              }
              
              if (typeText && valueText) {
                const span = document.createElement('span');
                span.className = `resistance-tag resistance-${typeClass}`;
                span.textContent = `${typeText}${valueText}`;
                if (value === '3') {
                  buffList.push(span.outerHTML);
                } else {
                  resistList.push(span.outerHTML);
                }
              }
              i += 2;
            }
          }
          
          if (buffList.length > 0 || resistList.length > 0) {
            const resBox = document.createElement('div');
            resBox.className = 'attr-box fullwidth';
            
            if (buffList.length > 0) {
              const buffDiv = document.createElement('div');
              buffDiv.style.marginBottom = '4px';
              buffDiv.style.display = 'flex';
              buffDiv.style.alignItems = 'center';
              buffDiv.style.gap = '8px';
              buffDiv.style.flexWrap = 'wrap';
              buffDiv.style.justifyContent = 'center';
              
              const buffTitle = document.createElement('span');
              buffTitle.textContent = '屬性加成：';
              
              const buffTags = document.createElement('div');
              buffTags.style.display = 'flex';
              buffTags.style.flexWrap = 'wrap';
              buffTags.style.gap = '4px';
              buffTags.style.justifyContent = 'center';
              buffTags.style.flex = '1';
              buffTags.innerHTML = buffList.join('');
              
              buffDiv.appendChild(buffTitle);
              buffDiv.appendChild(buffTags);
              resBox.appendChild(buffDiv);
            }
            
            if (resistList.length > 0) {
              const resistDiv = document.createElement('div');
              resistDiv.style.display = 'flex';
              resistDiv.style.alignItems = 'center';
              resistDiv.style.gap = '8px';
              resistDiv.style.flexWrap = 'wrap';
              resistDiv.style.justifyContent = 'center';
              
              const resistTitle = document.createElement('span');
              resistTitle.textContent = '屬性抗性：';
              
              const resistTags = document.createElement('div');
              resistTags.style.display = 'flex';
              resistTags.style.flexWrap = 'wrap';
              resistTags.style.gap = '4px';
              resistTags.style.justifyContent = 'center';
              resistTags.style.flex = '1';
              resistTags.innerHTML = resistList.join('');
              
              resistDiv.appendChild(resistTitle);
              resistDiv.appendChild(resistTags);
              resBox.appendChild(resistDiv);
            }
            
            attr.appendChild(resBox);
          }
        }

        if (spawnMap[monster]) {
          const maps = Object.keys(spawnMap[monster]);
          const summary = `出沒地圖（${maps.length}張）`;

          const mapBox = document.createElement('div');
          mapBox.className = 'attr-box fullwidth';
          mapBox.style.cursor = 'pointer';

          const summarySpan = document.createElement('span');
          summarySpan.textContent = '▶ ' + summary;

          const detailSpan = document.createElement('span');
          detailSpan.innerHTML = maps.map(map => `<div style='text-align:left' class="map-name">${map.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`).join('');
          detailSpan.style.display = 'none';
          detailSpan.style.marginTop = '0.5em';
          detailSpan.style.marginLeft = '0.5em';
          detailSpan.style.color = '#aaa';
          detailSpan.style.userSelect = 'text';

          mapBox.appendChild(summarySpan);
          mapBox.appendChild(detailSpan);

          summarySpan.style.userSelect = 'none';
          summarySpan.style.cursor = 'pointer';
          
          mapBox.addEventListener('click', (e) => {
            if (window.getSelection().toString() || e.target.classList.contains('map-name')) {
              return;
            }
            e.stopPropagation();
            const isShown = detailSpan.style.display === 'block';
            detailSpan.style.display = isShown ? 'none' : 'block';
            summarySpan.textContent = (isShown ? '▶ ' : '▼ ') + summary;
          });

          attr.appendChild(mapBox);
        }

        if (bossTime[monster]) {
          const respawnBox = document.createElement('div');
          respawnBox.className = 'attr-box fullwidth';
          respawnBox.textContent = `重生時間：${bossTime[monster]}`;
          attr.appendChild(respawnBox);
        }

        card.appendChild(attr);
      }

      const itemsToShow = onlyMatchedDrops && keyword ? matchedItems : items;

      const itemContainer = document.createElement('div');
      if (onlyShowImage) itemContainer.className = 'only-image-mode';

      const equipContainer = document.createElement('div');
      const useContainer = document.createElement('div');
      const etcContainer = document.createElement('div');
      const otherContainer = document.createElement('div');

      itemsToShow.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = onlyShowImage ? 'hide-text' : 'item';

        const itemImg = document.createElement('img');
        itemImg.src = `image/${encodeURIComponent(item)}.png`;
        itemImg.alt = item;
        itemImg.className = 'item-icon';
        
        const itemId = parseInt(nameToIdMap[item] ?? '0');
        const isEquip = (itemId >= 1000001 && itemId <= 1999999) || (itemId >= 2060000 && itemId <= 2079999) || (itemId >= 2330000 && itemId <= 2339999);
        
        if (keyword && matchesKeyword(item, keyword)) {
          itemImg.classList.add('highlighted');
        }

        const itemText = document.createElement('span');
        itemText.innerHTML = highlight(getDisplayName(item), keyword);

        const itemLink = document.createElement('a');
        itemLink.href = `https://maplesaga.com/library/cn/permalink/${isEquip ? 'equip' : 'item'}/${itemId}`;
        itemLink.target = '_blank';
        itemLink.style.color = 'inherit';
        itemLink.style.textDecoration = 'none';

        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'item-icon-wrapper';
        imgWrapper.appendChild(itemImg);
        itemLink.appendChild(imgWrapper); 
        itemLink.appendChild(itemText);
        itemDiv.appendChild(itemLink);
        

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

      if (equipContainer.hasChildNodes()) {
        const equipBox = document.createElement('div');
        equipBox.style.border = '1px solid #42aaff';
        equipBox.style.borderRadius = '4px';
        equipBox.style.padding = '8px 2px';
        equipBox.style.marginBottom = '8px';
        equipBox.appendChild(equipContainer);
        itemContainer.appendChild(equipBox);
      }
      if (useContainer.hasChildNodes()) {
        const useBox = document.createElement('div');
        useBox.style.border = '1px solid #42ff42';
        useBox.style.borderRadius = '4px';
        useBox.style.padding = '8px 2px';
        useBox.style.marginBottom = '8px';
        useBox.appendChild(useContainer);
        itemContainer.appendChild(useBox);
      }
      if (etcContainer.hasChildNodes()) {
        const etcBox = document.createElement('div');
        etcBox.style.border = '1px solid #ffaa42';
        etcBox.style.borderRadius = '4px';
        etcBox.style.padding = '8px 2px';
        etcBox.style.marginBottom = '8px';
        etcBox.appendChild(etcContainer);
        itemContainer.appendChild(etcBox);
      }
      itemContainer.appendChild(otherContainer);

      card.appendChild(itemContainer);
      container.appendChild(card);
    });

    if (!container.hasChildNodes()) {
      container.textContent = '找不到符合的怪物或掉落物';
    }
}

function refresh() {
  const keyword = document.getElementById('search').value;
  const onlyMatchedDrops = document.getElementById('toggle-filtered').checked;
  const regionSet = selectedRegions;

  const filterByRegion = (monster) => {
    if (!spawnMap[monster]) return true;
    if (regionSet.size === 0) return true;
    const maps = Object.keys(spawnMap[monster]);
    return maps.some(map => regionSet.has(map.split('：')[0]));
  };

  const filterByResistance = (monster) => {
    if (selectedResistances.size === 0) return true;
    const resistance = mobData[monster]?.[9];
    if (!resistance) return false;
    
    if (resistance === 'ALL2' && selectedResistances.has('ALL2')) return true;
    
    for (let i = 0; i < resistance.length; i += 2) {
      const type = resistance[i];
      const value = resistance[i + 1];
      const key = `${type}${value}`;
      if (selectedResistances.has(key)) return true;
    }
    return false;
  };

  const filteredDrop = {};
  for (const [monster, items] of Object.entries(dropData)) {
    if (filterByRegion(monster) && filterByResistance(monster)) {
      filteredDrop[monster] = items;
    }
  }

  renderCards(filteredDrop, keyword, onlyMatchedDrops);
}

Promise.all([
  fetch('drop_data.json').then(res => res.json()),
  fetch('mob.json').then(res => res.json()),
  fetch('item.json').then(res => res.json()),
  fetch('boss_time.json').then(res => res.json()),
  fetch('map.json').then(res => res.json()),
  fetch('map_exception.json').then(res => res.json()),
  fetch('area.json').then(res => res.json()),
  fetch('alias.json').then(res => res.json())
]).then(([drop, mob, itemMap, boss, map, mapException, areaData, alias]) => {
  spawnMap = {};
  area = areaData;
  aliasMap = alias;
  
  for (const [monster, maps] of Object.entries(map)) {
    spawnMap[monster] = {};
    for (const [mapName, value] of Object.entries(maps)) {
      if (mapException[mapName] !== undefined) {
        if (mapException[mapName] !== 'INVALID') {
          spawnMap[monster][mapException[mapName]] = value;
        }
        continue;
      }

      const [region, ...rest] = mapName.split('：');
      if (mapException[region] === 'INVALID') {
        continue;
      }
      const correctRegion = mapException[region] || region;
      const correctMapName = [correctRegion, ...rest].join('：');
      spawnMap[monster][correctMapName] = value;
    }
    if (Object.keys(spawnMap[monster]).length === 0) {
      delete spawnMap[monster];
    }
  }
  
  bossTime = boss;
  mobData = mob;
  nameToIdMap = {};
  for (const [id, name] of Object.entries(itemMap)) {
    nameToIdMap[name] = id;
  }
  Object.entries(drop).forEach(([monster, items]) => {
    drop[monster] = items.sort((a, b) => {
      const aId = parseInt(nameToIdMap[a] ?? '0');
      const bId = parseInt(nameToIdMap[b] ?? '0');
      const isAEquip = aId >= 1000001 && aId <= 1999999;
      const isBEquip = bId >= 1000001 && bId <= 1999999;

      if (isAEquip && !isBEquip) return -1;
      if (!isAEquip && isBEquip) return 1;

      return (aId || 0) - (bId || 0);
    });
  });
  dropData = drop;

  const regionSet = new Set();
  for (const maps of Object.values(spawnMap)) {
    Object.keys(maps).forEach(map => regionSet.add(map.split('：')[0]));
  }
  const regionCheckboxes = document.getElementById('region-checkboxes');
  Object.entries(area).forEach(([region, defaultChecked]) => {
    if (regionSet.has(region)) {
      const label = document.createElement('label');
      label.style.marginRight = '8px';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = region;
      checkbox.checked = defaultChecked === 1;
      if (checkbox.checked) selectedRegions.add(region);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) selectedRegions.add(region);
        else selectedRegions.delete(region);
        refresh();
      });
      label.appendChild(checkbox);
      label.append(` ${region}`);
      regionCheckboxes.appendChild(label);
    }
  });

  // 初始化屬性剋制選項
  const resistanceLabels = {
    'H': '聖',
    'F': '火',
    'I': '冰',
    'S': '毒',
    'L': '雷'
  };
  const valueLabels = {
    '3': '加成'  // 只保留加成效果
  };

  const resistanceTypes = new Set();
  Object.values(mob).forEach(mobInfo => {
    const resistance = mobInfo[9];
    if (!resistance) return;
    
    if (resistance === 'ALL2') {
      return; // 不添加 ALL2
    }
    
    let i = 0;
    while (i < resistance.length) {
      // 檢查是否是可治癒狀態
      if (resistance[i] === 'H' && i + 1 < resistance.length && resistance[i + 1] === 'S') {
        resistanceTypes.add('HS');
        i += 2;
        continue;
      }

      const type = resistance[i];
      const value = resistance[i + 1];
      // 跳過物理屬性和非加成效果
      if (type === 'P' || value !== '3') {
        i += 2;
        continue;
      }
      // 檢查類型和值是否都有定義在對應表中
      if (resistanceLabels[type] && valueLabels[value]) {
        resistanceTypes.add(`${type}${value}`);
      }
      i += 2;
    }
  });

  const resistanceCheckboxes = document.getElementById('resistance-checkboxes');

  const sortedResistances = Array.from(resistanceTypes).sort((a, b) => {
    // 定義順序權重
    const order = {
      'F3': 1,  // 火加成
      'S3': 2,  // 毒加成
      'I3': 3,  // 冰加成
      'L3': 4,  // 雷加成
      'H3': 5,  // 聖加成
      'HS': 6   // 可治癒
    };
    
    return (order[a] || 99) - (order[b] || 99);
  });

  sortedResistances.forEach(resistance => {
    const label = document.createElement('label');
    const button = document.createElement('button');
    button.type = 'button';
    button.value = resistance;
    
    if (resistance === 'HS') {
      button.textContent = '可治癒';
    } else {
      const type = resistance[0];
      const value = resistance[1];
      button.textContent = `${resistanceLabels[type]}${valueLabels[value]}`;
    }
    
    button.addEventListener('click', () => {
      const isSelected = button.classList.contains('selected');
      if (!isSelected) {
        selectedResistances.add(resistance);
        button.classList.add('selected');
      } else {
        selectedResistances.delete(resistance);
        button.classList.remove('selected');
      }
      refresh();
    });
    
    label.appendChild(button);
    resistanceCheckboxes.appendChild(label);
  });

  refresh();
}).catch(error => {
  document.getElementById('drop-container').innerText = '載入失敗：' + error;
});

let debounceTimer;
document.getElementById('search').addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refresh, 300);
});
document.getElementById('toggle-filtered').addEventListener('change', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refresh, 300);
});
document.getElementById('toggle-name-hover').addEventListener('change', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refresh, 300);
});
document.getElementById('min-lv').addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refresh, 300);
});
document.getElementById('max-lv').addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(refresh, 300);
});
document.getElementById('share-btn').addEventListener('click', function () {
  const searchValue = document.getElementById('search').value;
  const url = new URL(window.location.href);
  url.searchParams.set('searchkey', searchValue);
  navigator.clipboard.writeText(url.toString()).then(() => {
    alert('已複製分享連結！');
  });
});

function toggleRegions() {
  const regionControls = document.querySelector('.region-controls');
  const toggleBtn = document.querySelector('.toggle-regions-btn');
  regionControls.classList.toggle('show');
  toggleBtn.textContent = regionControls.classList.contains('show') ? '隱藏區域選擇' : '區域選擇';
}

function selectAllRegions() {
  const checkboxes = document.querySelectorAll('#region-checkboxes input[type="checkbox"]');
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = true;
    selectedRegions.add(checkbox.value);
  });
  
  refresh();
}

function deselectAllRegions() {
  const checkboxes = document.querySelectorAll('#region-checkboxes input[type="checkbox"]');
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = false;
    selectedRegions.delete(checkbox.value);
  });
  
  refresh();
}

function selectDefaultRegions() {
  const checkboxes = document.querySelectorAll('#region-checkboxes input[type="checkbox"]');
  selectedRegions.clear();
  
  checkboxes.forEach(checkbox => {
    const region = checkbox.value;
    const isDefaultRegion = area[region] === 1;
    checkbox.checked = isDefaultRegion;
    if (isDefaultRegion) {
      selectedRegions.add(region);
    }
  });
  
  document.querySelector('.toggle-all-btn').textContent = '全選區域';
  refresh();
}

function toggleResistance() {
  const resistanceControls = document.querySelector('.resistance-controls');
  const toggleBtn = document.querySelector('.toggle-resistance-btn');
  resistanceControls.classList.toggle('show');
  toggleBtn.textContent = resistanceControls.classList.contains('show') ? '隱藏屬性選擇' : '屬性選擇';
}

let lastScrollTop = 0;
const disclaimer = document.querySelector('.disclaimer');

window.addEventListener('scroll', () => {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  
  // 當滾動到頂部時顯示
  if (scrollTop <= 0) {
    disclaimer.classList.remove('hidden');
  } 
  // 當向下滾動時隱藏
  else if (scrollTop > lastScrollTop) {
    disclaimer.classList.add('hidden');
  }
  
  lastScrollTop = scrollTop;
}); 