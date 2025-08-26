document.addEventListener('DOMContentLoaded', () => {
    // --- Element Variables ---
    const body = document.body;
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const monsterContainer = document.getElementById('monster-container');
    const searchBar = document.getElementById('search-bar');
    const speciesFilter = document.getElementById('species-filter');
    const crFilter = document.getElementById('cr-filter');
    const sortOrder = document.getElementById('sort-order');
    const navigationControls = document.getElementById('navigation-controls');
    const filtersContainer = document.querySelector('.filters');

    // --- State Variables ---
    let allMonsters = [];
    let currentMonster = null;
    let filteredMonsterNames = []; // フィルタリング・ソート後のモンスター名リスト

    // --- Dark Mode Logic ---
    function applyTheme(theme) {
        if (theme === 'dark') {
            body.classList.add('dark-mode');
            darkModeToggle.textContent = '☀️';
        } else {
            body.classList.remove('dark-mode');
            darkModeToggle.textContent = '🌙';
        }
    }
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
    darkModeToggle.addEventListener('click', () => {
        const newTheme = body.classList.contains('dark-mode') ? 'light' : 'dark';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
    });

    // --- Event Delegation ---
    document.addEventListener('click', (event) => {
        const target = event.target;
        
        if (target.closest('#navigation-controls')) {
            if (target.id === 'back-to-list') window.location.href = window.location.pathname;
            else if (target.id === 'copy-url') copyUrlToClipboard();
            else if (target.id === 'cocofolia-button' && currentMonster) copyCocofoliaData(currentMonster);
        }
        
        if (target.id === 'copy-palette-button') {
            const paletteText = document.querySelector('.chat-palette-textarea').value;
            navigator.clipboard.writeText(paletteText).then(() => {
                alert('チャットパレットをクリップボードにコピーしました！');
                target.textContent = 'コピー完了！';
                setTimeout(() => { target.textContent = 'チャットパレットをコピー'; }, 2000);
            });
        }
    });

    // --- Main Data Loading ---
    const jsonFiles = [
        '両生種、鳥竜種、獣竜種.json', '牙獣種、牙竜種.json', '甲殻種.json',
        '飛竜種、海竜種.json', '甲虫種、魚竜種、蛇竜種.json',
        '鋏角種、鳥竜種、不明.json', '古龍種.json', '小型モンスター.json'
    ];
    const timestamp = `?t=${new Date().getTime()}`;
    const fetchPromises = jsonFiles.map(file => fetch(file + timestamp).then(res => res.ok ? res.json() : Promise.reject(`Failed to load ${file}`)));

    Promise.all(fetchPromises)
        .then(dataArrays => {
            allMonsters = dataArrays.flat();
            const params = new URLSearchParams(window.location.search);
            const monsterName = params.get('monster');

            if (monsterName) {
                const monster = allMonsters.find(m => m.name_jp === decodeURIComponent(monsterName));
                if (monster) displaySingleMonster(monster);
                else displayNotFound();
            } else {
                initializeListView();
            }
        })
        .catch(error => {
            console.error('Error loading monster data:', error);
            monsterContainer.innerHTML = `<p style="color: red;">モンスターデータの読み込みに失敗しました。</p>`;
        });

    // --- View Initializers ---
    function initializeListView() {
        populateFilters(allMonsters);
        loadFilterState();
        let debounceTimer;
        searchBar.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(filterAndSortMonsters, 300);
        });
        speciesFilter.addEventListener('change', filterAndSortMonsters);
        crFilter.addEventListener('change', filterAndSortMonsters);
        sortOrder.addEventListener('change', filterAndSortMonsters);
        filterAndSortMonsters();
    }

    // --- Display Functions ---
    function displaySingleMonster(monster) {
        currentMonster = monster;
        filtersContainer.style.display = 'none';
        
        const params = new URLSearchParams(window.location.search);
        const currentIndex = parseInt(params.get('index'), 10);
        const monsterList = JSON.parse(sessionStorage.getItem('filteredMonsterNames') || '[]');

        let navHTML = '';
        if (monsterList.length > 0 && !isNaN(currentIndex)) {
            if (currentIndex > 0) {
                const prevMonsterName = monsterList[currentIndex - 1];
                navHTML += `<a href="?monster=${encodeURIComponent(prevMonsterName)}&index=${currentIndex - 1}" class="nav-button">前へ</a>`;
            }
            if (currentIndex < monsterList.length - 1) {
                const nextMonsterName = monsterList[currentIndex + 1];
                navHTML += `<a href="?monster=${encodeURIComponent(nextMonsterName)}&index=${currentIndex + 1}" class="nav-button">次へ</a>`;
            }
        }
        
        navigationControls.innerHTML = `
            <button class="nav-button" id="back-to-list">一覧に戻る</button>
            ${navHTML}
            <button class="nav-button" id="copy-url">共有用URLをコピー</button>
            <button class="nav-button" id="cocofolia-button">ココフォリア用データをコピー</button>
        `;
        displayMonsters([monster], true);
    }

    function displayNotFound() {
        filtersContainer.style.display = 'none';
        navigationControls.innerHTML = `<button class="nav-button" id="back-to-list">一覧に戻る</button>`;
        monsterContainer.innerHTML = '<p>指定されたモンスターが見つかりませんでした。</p>';
    }

    function displayMonsters(monsters, isSingleView = false) {
        monsterContainer.innerHTML = '';
        monsterContainer.className = isSingleView ? 'single-monster-view' : '';

        if (monsters.length === 0 && !isSingleView) {
            monsterContainer.innerHTML = '<p style="text-align:center;">該当するモンスターが見つかりませんでした。</p>';
            return;
        }

        monsters.forEach(monster => {
            try {
                const monsterCard = document.createElement('div');
                monsterCard.className = 'stat-block';
                const ac = getArmorClassValue(monster.armor_class);
                const linkIndex = filteredMonsterNames.indexOf(monster.name_jp);
                
                const monsterNameHTML = isSingleView
                    ? `<h2>${monster.name_jp} (${monster.name_en || ''})</h2>`
                    : `<h2><a href="?monster=${encodeURIComponent(monster.name_jp)}&index=${linkIndex}">${monster.name_jp} (${monster.name_en || ''})</a></h2>`;

                let innerHTML = `
                    ${monsterNameHTML}
                    <p class="size-type">${monster.size_type_alignment || ''}</p>
                    <div class="separator"></div>
                    ${renderSimpleP('アーマークラス', ac.display)}
                    ${renderSimpleP('ヒットポイント', `${monster.hit_points.average} (${monster.hit_points.dice})`)}
                    ${renderSimpleP('移動速度', monster.speed)}
                    <div class="separator"></div>
                `;

                if (monster.ability_scores) {
                    innerHTML += `<ul class="ability-scores">
                        <li><h4>筋力</h4><p>${monster.ability_scores.strength}</p></li>
                        <li><h4>敏捷力</h4><p>${monster.ability_scores.dexterity}</p></li>
                        <li><h4>耐久力</h4><p>${monster.ability_scores.constitution}</p></li>
                        <li><h4>知力</h4><p>${monster.ability_scores.intelligence}</p></li>
                        <li><h4>判断力</h4><p>${monster.ability_scores.wisdom}</p></li>
                        <li><h4>魅力</h4><p>${monster.ability_scores.charisma}</p></li>
                    </ul><div class="separator"></div>`;
                }

                innerHTML += `
                    ${renderSimpleP('セーヴィングスロー', monster.saving_throws)}
                    ${renderSimpleP('技能', monster.skills)}
                    ${renderSimpleP('ダメージ脆弱性', monster.damage_vulnerabilities)}
                    ${renderSimpleP('ダメージ抵抗', monster.damage_resistances)}
                    ${renderSimpleP('ダメージ完全耐性', monster.damage_immunities)}
                    ${renderSimpleP('状態異常完全耐性', monster.condition_immunities)}
                    ${renderSimpleP('感覚', monster.senses)}
                    ${renderSimpleP('言語', monster.languages)}
                    ${renderSimpleP('脅威度', monster.challenge_rating)}
                    ${renderSection('特殊能力', monster.special_traits)}
                    ${renderSection('アクション', monster.actions)}
                    ${renderSection('ボーナスアクション', monster.bonus_actions)}
                    ${renderSection('リアクション', monster.reactions)}
                    ${renderSection('伝説的アクション', monster.legendary_actions)}
                    ${renderSection('巣穴のアクション', monster.lair_actions)}
                `;
                
                monsterCard.innerHTML = innerHTML;
                monsterContainer.appendChild(monsterCard);

                if (isSingleView && monster.commands) {
                    const chatPaletteSection = document.createElement('div');
                    chatPaletteSection.className = 'stat-block chat-palette-section';
                    chatPaletteSection.innerHTML = `
                         <h3>チャットパレット</h3>
                         <p>以下のテキストをコピーして、ココフォリアのチャットパレットに貼り付けてください。</p>
                         <textarea readonly class="chat-palette-textarea">${monster.commands.trim()}</textarea>
                         <button id="copy-palette-button" class="nav-button">チャットパレットをコピー</button>
                    `;
                    monsterContainer.appendChild(chatPaletteSection);
                }

            } catch(e) { console.error(`Error rendering monster: ${monster.name_jp}`, e); }
        });
    }
    
    // --- Render Helpers ---
    function renderSimpleP(label, content) { return content ? `<p><strong>${label}:</strong> ${content}</p>` : ''; }
    function renderSection(title, items) {
        if (!items || !Array.isArray(items) || items.length === 0) return '';
        return `
            <h3>${title}</h3>
            ${items.map(item => `<div class="trait-item"><p><strong><em>${item.name}.</em></strong> ${item.description}</p></div>`).join('')}
        `;
    }

    // --- Filter and Sort Logic ---
    function filterAndSortMonsters() {
        let processedMonsters = [...allMonsters];
        const searchTerm = searchBar.value.toLowerCase();
        if (searchTerm) {
            processedMonsters = processedMonsters.filter(m => m.name_jp.toLowerCase().includes(searchTerm) || (m.name_en && m.name_en.toLowerCase().includes(searchTerm)));
        }
        const selectedSpecies = speciesFilter.value;
        if (selectedSpecies !== 'all') {
            processedMonsters = processedMonsters.filter(m => extractSpecies(m.size_type_alignment) === selectedSpecies);
        }
        const selectedCR = crFilter.value;
        if (selectedCR !== 'all') {
            processedMonsters = processedMonsters.filter(m => m.challenge_rating && m.challenge_rating.startsWith(selectedCR));
        }
        const sortBy = sortOrder.value;
        if (sortBy === 'name_asc') {
            processedMonsters.sort((a, b) => a.name_jp.localeCompare(b.name_jp, 'ja'));
        } else if (sortBy === 'cr_asc') {
            processedMonsters.sort((a, b) => crToNumber(a.challenge_rating) - crToNumber(b.challenge_rating));
        } else if (sortBy === 'cr_desc') {
            processedMonsters.sort((a, b) => crToNumber(b.challenge_rating) - crToNumber(a.challenge_rating));
        }

        filteredMonsterNames = processedMonsters.map(m => m.name_jp);
        sessionStorage.setItem('filteredMonsterNames', JSON.stringify(filteredMonsterNames));
        saveFilterState();
        displayMonsters(processedMonsters);
    }
    
    function populateFilters(monsters) {
        const species = new Set(monsters.map(m => extractSpecies(m.size_type_alignment)).filter(Boolean));
        const challengeRatings = new Set(monsters.map(m => m.challenge_rating?.split(' ')[0]).filter(Boolean));
        Array.from(species).sort().forEach(s => speciesFilter.add(new Option(s, s)));
        Array.from(challengeRatings).sort((a, b) => crToNumber(a) - crToNumber(b)).forEach(cr => crFilter.add(new Option(cr, cr)));
    }
    
    // --- Filter State Persistence ---
    function saveFilterState() {
        const filterState = {
            search: searchBar.value,
            species: speciesFilter.value,
            cr: crFilter.value,
            sort: sortOrder.value
        };
        sessionStorage.setItem('monsterFilterState', JSON.stringify(filterState));
    }
    function loadFilterState() {
        const savedState = JSON.parse(sessionStorage.getItem('monsterFilterState'));
        if (savedState) {
            searchBar.value = savedState.search || '';
            speciesFilter.value = savedState.species || 'all';
            crFilter.value = savedState.cr || 'all';
            sortOrder.value = savedState.sort || 'default';
        }
    }

    // --- Helper Functions ---
    const extractSpecies = sizeType => (sizeType?.split('の')[1] || '').split('、')[0].trim();
    const crToNumber = cr => {
        if (!cr) return -1;
        const crString = cr.split(' ')[0];
        // '1/2' のような分数を評価するためにevalを使用
        try {
            return eval(crString);
        } catch {
            return parseInt(crString, 10) || 0;
        }
    };
    const getArmorClassValue = ac => {
        let display = 'N/A', value = 10;
        if (ac) {
            if (typeof ac === 'object' && ac.value) {
                display = `${ac.value} (${ac.type})`;
                value = parseInt(ac.value, 10) || 10;
            } else {
                display = ac.toString();
                value = parseInt(display.match(/\d+/)?.[0], 10) || 10;
            }
        }
        return { display, value };
    };

    // --- Cocofolia Data Generation ---
    function copyUrlToClipboard() {
        navigator.clipboard.writeText(window.location.href).then(() => alert('URLをクリップボードにコピーしました！'));
    }
    function copyCocofoliaData(monster) {
        try {
            const cocofoliaData = generateCocofoliaJson(monster);
            navigator.clipboard.writeText(JSON.stringify(cocofoliaData, null, 2)).then(() => {
                alert('ココフォリア用のデータをコピーしました。\nココフォリアの画面上でペーストするとコマが作成されます。');
            });
        } catch (e) { console.error("Failed to generate or copy Cocofolia data:", e); }
    }
    function generateCocofoliaJson(monster) {
        const ac = getArmorClassValue(monster.armor_class);
        const dexMod = Math.floor((parseInt(monster.ability_scores.dexterity) - 10) / 2);
        const memo = `${monster.size_type_alignment}\n【移動速度】${monster.speed}`;

        return {
            kind: "character",
            data: {
                name: monster.name_jp,
                memo,
                initiative: dexMod,
                externalUrl: window.location.href,
                status: [{ label: "HP", value: monster.hit_points.average, max: monster.hit_points.average }, { label: "AC", value: ac.value, max: ac.value }],
                params: Object.entries(monster.ability_scores).map(([key, value]) => ({ label: key.substring(0, 2).toUpperCase(), value })),
                palette: monster.commands || ""
            }
        };
    }
});```