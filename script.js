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
    // --- Encounter Builder Elements ---
    const encounterBuilder = document.getElementById('encounter-builder');
    const toggleBuilderBtn = document.getElementById('toggle-builder');
    const playerCountInput = document.getElementById('player-count');
    const playerLevelInput = document.getElementById('player-level');
    const encounterList = document.getElementById('encounter-list');
    const totalXpSpan = document.getElementById('total-xp');
    const difficultySpan = document.getElementById('difficulty');
    const clearEncounterBtn = document.getElementById('clear-encounter');


    // --- State Variables ---
    let allMonsters = [];
    let currentMonster = null;
    let filteredMonsterNames = []; 
    let encounter = [];

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

        if (target.classList.contains('add-to-encounter-btn')) {
            const monsterName = target.dataset.monsterName;
            addMonsterToEncounter(monsterName);
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
            allMonsters.forEach(m => { m.xp = parseInt((m.challenge_rating || '0').split('(')[1]) || 0; });
            const params = new URLSearchParams(window.location.search);
            const monsterName = params.get('monster');

            if (monsterName) {
                const monster = allMonsters.find(m => m.name_jp === decodeURIComponent(monsterName));
                if (monster) displaySingleMonster(monster);
                else displayNotFound();
            } else {
                initializeListView();
            }
            initializeEncounterBuilder();
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
        encounterBuilder.style.display = 'none'; // 詳細ページではビルダーを隠す
        
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
                
                let monsterNameHTML = `<h2>${monster.name_jp} (${monster.name_en || ''})</h2>`;
                if (!isSingleView) {
                     monsterNameHTML = `<h2><a href="?monster=${encodeURIComponent(monster.name_jp)}&index=${linkIndex}">${monster.name_jp} (${monster.name_en || ''})</a></h2>
                                        <button class="add-to-encounter-btn" data-monster-name="${monster.name_jp}">追加</button>`;
                }

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
                    ${renderSection('特殊能力', monster.special_traits)}
                    ${renderSection('アクション', monster.actions)}
                    ${renderSection('ボーナスアクション', monster.bonus_actions)}
                    ${renderSection('リアクション', monster.reactions)}
                    ${renderSection('伝説的アクション', monster.legendary_actions)}
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
        // ... (previous filter/sort logic remains the same)
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
        return crString.includes('/') ? eval(crString) : parseInt(crString, 10);
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

    // --- Encounter Builder Logic ---
    const xpThresholds = [ // DMG p.82
        [0, 25, 50, 75, 100], [50, 100, 150, 200], [75, 150, 225, 400], [125, 250, 375, 500], [250, 500, 750, 1100], [300, 600, 900, 1400], [350, 750, 1100, 1700], [450, 900, 1400, 2100], [550, 1100, 1600, 2400], [600, 1200, 1900, 2800], [800, 1600, 2400, 3600], [1000, 2000, 3000, 4500], [1100, 2200, 3400, 5100], [1250, 2500, 3800, 5700], [1400, 2800, 4300, 6400], [1600, 3200, 4800, 7200], [2000, 3900, 5900, 8800], [2100, 4200, 6300, 9500], [2400, 4900, 7300, 10900], [2800, 5700, 8500, 12700]
    ];
    const multipliers = [0, 1, 1.5, 2, 2.5, 3, 4, 5]; // 0: 0, 1: 1, 2: 2, 3-6: 3, ...

    function getXpMultiplier(monsterCount) {
        if (monsterCount === 0) return 0;
        if (monsterCount === 1) return 1;
        if (monsterCount === 2) return 1.5;
        if (monsterCount >= 3 && monsterCount <= 6) return 2;
        if (monsterCount >= 7 && monsterCount <= 10) return 2.5;
        if (monsterCount >= 11 && monsterCount <= 14) return 3;
        return 4;
    }

    function calculateDifficulty() {
        const playerCount = parseInt(playerCountInput.value) || 1;
        const playerLevel = parseInt(playerLevelInput.value) -1 || 0;
        
        const monsterCounts = encounter.reduce((acc, name) => { acc[name] = (acc[name] || 0) + 1; return acc; }, {});
        const totalMonsters = encounter.length;
        
        const totalXP = encounter.reduce((sum, name) => sum + (allMonsters.find(m => m.name_jp === name)?.xp || 0), 0);
        const adjustedXP = totalXP * getXpMultiplier(totalMonsters);

        totalXpSpan.textContent = `${totalXP} (調整後: ${adjustedXP})`;
        
        if (totalMonsters === 0) {
            difficultySpan.textContent = '-';
            return;
        }

        const thresholds = xpThresholds[playerLevel].map(xp => xp * playerCount);
        if (adjustedXP < thresholds[1]) difficultySpan.textContent = '簡単';
        else if (adjustedXP < thresholds[2]) difficultySpan.textContent = '普通';
        else if (adjustedXP < thresholds[3]) difficultySpan.textContent = '難しい';
        else difficultySpan.textContent = '死の危険';
    }

    function renderEncounterList() {
        encounterList.innerHTML = '';
        const monsterCounts = encounter.reduce((acc, name) => { acc[name] = (acc[name] || 0) + 1; return acc; }, {});
        
        Object.entries(monsterCounts).forEach(([name, count]) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="monster-name">${name} (x${count})</span>
                <div class="monster-controls">
                    <button data-name="${name}" class="remove-one">-</button>
                    <button data-name="${name}" class="add-one">+</button>
                </div>
            `;
            encounterList.appendChild(li);
        });
        calculateDifficulty();
        sessionStorage.setItem('encounter', JSON.stringify(encounter));
    }

    function addMonsterToEncounter(monsterName) {
        encounter.push(monsterName);
        renderEncounterList();
    }

    function initializeEncounterBuilder() {
        encounter = JSON.parse(sessionStorage.getItem('encounter') || '[]');
        playerCountInput.value = sessionStorage.getItem('playerCount') || 4;
        playerLevelInput.value = sessionStorage.getItem('playerLevel') || 1;
        
        toggleBuilderBtn.addEventListener('click', () => encounterBuilder.classList.toggle('minimized'));
        playerCountInput.addEventListener('input', () => {
            sessionStorage.setItem('playerCount', playerCountInput.value);
            calculateDifficulty();
        });
        playerLevelInput.addEventListener('input', () => {
            sessionStorage.setItem('playerLevel', playerLevelInput.value);
            calculateDifficulty();
        });
        clearEncounterBtn.addEventListener('click', () => {
            encounter = [];
            renderEncounterList();
        });
        encounterList.addEventListener('click', e => {
            const monsterName = e.target.dataset.name;
            if (!monsterName) return;
            if (e.target.classList.contains('add-one')) {
                addMonsterToEncounter(monsterName);
            } else if (e.target.classList.contains('remove-one')) {
                const index = encounter.lastIndexOf(monsterName);
                if (index > -1) encounter.splice(index, 1);
                renderEncounterList();
            }
        });
        renderEncounterList();
    }
    
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
});