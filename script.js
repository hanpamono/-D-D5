document.addEventListener('DOMContentLoaded', () => {
    // --- Dark Mode Logic ---
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const body = document.body;

    // On page load, check for saved theme
    if (localStorage.getItem('theme') === 'dark') {
        body.classList.add('dark-mode');
        darkModeToggle.textContent = '☀️';
    }

    darkModeToggle.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
        if (body.classList.contains('dark-mode')) {
            localStorage.setItem('theme', 'dark');
            darkModeToggle.textContent = '☀️';
        } else {
            localStorage.setItem('theme', 'light');
            darkModeToggle.textContent = '🌙';
        }
    });
    // --- End Dark Mode Logic ---


    const monsterContainer = document.getElementById('monster-container');
    const searchBar = document.getElementById('search-bar');
    const speciesFilter = document.getElementById('species-filter');
    const crFilter = document.getElementById('cr-filter');
    const sortOrder = document.getElementById('sort-order');
    const navigationControls = document.getElementById('navigation-controls');
    const filtersContainer = document.querySelector('.filters');

    let allMonsters = [];

    const jsonFiles = [
        '両生種、鳥竜種、獣竜種.json', '牙獣種、牙竜種.json', '甲殻種.json',
        '飛竜種、海竜種.json', '甲虫種、魚竜種、蛇竜種.json',
        '鋏角種、鳥竜種、不明.json', '古龍種.json', '小型モンスター.json'
    ];

    Promise.all(jsonFiles.map(file => fetch(file).then(res => res.json())))
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
            monsterContainer.innerHTML = '<p>モンスターデータの読み込みに失敗しました。</p>';
        });

    function displaySingleMonster(monster) {
        filtersContainer.style.display = 'none';
        monsterContainer.classList.add('single-monster-view');
        
        navigationControls.innerHTML = `
            <button class="nav-button" onclick="window.location.href = window.location.pathname;">一覧に戻る</button>
            <button class="nav-button" onclick="copyUrlToClipboard()">共有用URLをコピー</button>
            <button class="nav-button" id="cocofolia-button">ココフォリア用データをコピー</button>
        `;
        
        document.getElementById('cocofolia-button').addEventListener('click', () => {
            copyCocofoliaData(monster);
        });

        displayMonsters([monster], true);
    }
    
    window.copyUrlToClipboard = () => navigator.clipboard.writeText(window.location.href).then(() => alert('URLをクリップボードにコピーしました！'));
    
    window.copyCocofoliaData = monster => {
        try {
            const cocofoliaData = generateCocofoliaJson(monster);
            navigator.clipboard.writeText(JSON.stringify(cocofoliaData, null, 2)).then(() => {
                alert('ココフォリア用のデータをコピーしました。\nココフォリアの画面上でペーストするとコマが作成されます。');
            });
        } catch (e) {
            console.error("Failed to generate Cocofolia data:", e);
            alert("ココフォリア用データの生成に失敗しました。詳細はブラウザのコンソールを確認してください。");
        }
    };

    function initializeListView() {
        populateFilters(allMonsters);
        
        searchBar.addEventListener('input', filterAndSortMonsters);
        speciesFilter.addEventListener('change', filterAndSortMonsters);
        crFilter.addEventListener('change', filterAndSortMonsters);
        sortOrder.addEventListener('change', filterAndSortMonsters);

        filterAndSortMonsters(); // Initial display
    }

    function displayNotFound() {
        filtersContainer.style.display = 'none';
        navigationControls.innerHTML = `<button class="nav-button" onclick="window.location.href = window.location.pathname;">一覧に戻る</button>`;
        monsterContainer.innerHTML = '<p>指定されたモンスターが見つかりませんでした。</p>';
    }
    
    function populateFilters(monsters) {
        const species = new Set();
        const challengeRatings = new Set();
        monsters.forEach(monster => {
            const monsterSpecies = extractSpecies(monster.size_type_alignment);
            if(monsterSpecies) species.add(monsterSpecies);
            if(monster.challenge_rating) challengeRatings.add(monster.challenge_rating.split(' ')[0]);
        });
        Array.from(species).sort().forEach(s => {
            speciesFilter.appendChild(new Option(s, s));
        });
        Array.from(challengeRatings).sort((a, b) => crToNumber(a) - crToNumber(b)).forEach(cr => {
            crFilter.appendChild(new Option(cr, cr));
        });
    }

    function filterAndSortMonsters() {
        let processedMonsters = [...allMonsters];

        // 1. Search Filter
        const searchTerm = searchBar.value.toLowerCase();
        if (searchTerm) {
            processedMonsters = processedMonsters.filter(m =>
                m.name_jp.toLowerCase().includes(searchTerm) ||
                m.name_en.toLowerCase().includes(searchTerm)
            );
        }

        // 2. Dropdown Filters
        const selectedSpecies = speciesFilter.value;
        if (selectedSpecies !== 'all') {
            processedMonsters = processedMonsters.filter(m => extractSpecies(m.size_type_alignment) === selectedSpecies);
        }
        const selectedCR = crFilter.value;
        if (selectedCR !== 'all') {
            processedMonsters = processedMonsters.filter(m => m.challenge_rating && m.challenge_rating.startsWith(selectedCR));
        }

        // 3. Sort
        const sortBy = sortOrder.value;
        if (sortBy === 'name_asc') {
            processedMonsters.sort((a, b) => a.name_jp.localeCompare(b.name_jp, 'ja'));
        } else if (sortBy === 'cr_asc') {
            processedMonsters.sort((a, b) => crToNumber(a.challenge_rating) - crToNumber(b.challenge_rating));
        } else if (sortBy === 'cr_desc') {
            processedMonsters.sort((a, b) => crToNumber(b.challenge_rating) - crToNumber(a.challenge_rating));
        }

        displayMonsters(processedMonsters);
    }

    function displayMonsters(monsters, isSingleView = false) {
        monsterContainer.innerHTML = '';
        if (monsters.length === 0) {
            monsterContainer.innerHTML = '<p style="text-align:center;">該当するモンスターが見つかりませんでした。</p>';
            return;
        }

        monsters.forEach(monster => {
            const monsterCard = document.createElement('div');
            monsterCard.className = 'stat-block';
            const ac = getArmorClassValue(monster.armor_class);
            
            const monsterNameHTML = isSingleView
                ? `<h2>${monster.name_jp} (${monster.name_en})</h2>`
                : `<h2><a href="?monster=${encodeURIComponent(monster.name_jp)}">${monster.name_jp} (${monster.name_en})</a></h2>`;

            monsterCard.innerHTML = `
                ${monsterNameHTML}
                <p class="size-type">${monster.size_type_alignment}</p>
                <div class="separator"></div>
                <p><strong>アーマークラス:</strong> ${ac.display}</p>
                <p><strong>ヒットポイント:</strong> ${monster.hit_points.average} (${monster.hit_points.dice})</p>
                <p><strong>移動速度:</strong> ${monster.speed}</p>
                <div class="separator"></div>
                <ul class="ability-scores">
                    <li><h4>筋力</h4><p>${monster.ability_scores.strength}</p></li>
                    <li><h4>敏捷力</h4><p>${monster.ability_scores.dexterity}</p></li>
                    <li><h4>耐久力</h4><p>${monster.ability_scores.constitution}</p></li>
                    <li><h4>知力</h4><p>${monster.ability_scores.intelligence}</p></li>
                    <li><h4>判断力</h4><p>${monster.ability_scores.wisdom}</p></li>
                    <li><h4>魅力</h4><p>${monster.ability_scores.charisma}</p></li>
                </ul>
                <div class="separator"></div>
                ${monster.saving_throws ? `<p><strong>セーヴィングスロー:</strong> ${monster.saving_throws}</p>` : ''}
                ${monster.skills ? `<p><strong>技能:</strong> ${monster.skills}</p>` : ''}
                ${monster.damage_vulnerabilities ? `<p><strong>ダメージ脆弱性:</strong> ${monster.damage_vulnerabilities}</p>` : ''}
                ${monster.damage_resistances ? `<p><strong>ダメージ抵抗:</strong> ${monster.damage_resistances}</p>` : ''}
                ${monster.damage_immunities ? `<p><strong>ダメージ完全耐性:</strong> ${monster.damage_immunities}</p>` : ''}
                ${monster.condition_immunities ? `<p><strong>状態異常完全耐性:</strong> ${monster.condition_immunities}</p>` : ''}
                <p><strong>感覚:</strong> ${monster.senses}</p>
                <p><strong>言語:</strong> ${monster.languages}</p>
                <p><strong>脅威度:</strong> ${monster.challenge_rating}</p>
                ${renderSection('特殊能力', monster.special_traits)}
                ${renderSection('アクション', monster.actions)}
                ${renderSection('ボーナスアクション', monster.bonus_actions)}
                ${renderSection('リアクション', monster.reactions)}
                ${renderSection('伝説的アクション', monster.legendary_actions)}
                ${renderSection('巣穴のアクション', monster.lair_actions)}
            `;
            monsterContainer.appendChild(monsterCard);
        });
    }

    function renderSection(title, items) {
        if (!items || !Array.isArray(items) || items.length === 0) return '';
        const sectionClass = title.toLowerCase().replace(/ /g, '-');
        return `
            <div class="${sectionClass}">
                <div class="separator"></div>
                <h3>${title}</h3>
                ${items.map(item => `
                    <div class="trait-item">
                        <p><strong><em>${item.name}.</em></strong> ${item.description}</p>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // --- Helper Functions ---
    const extractSpecies = sizeType => (sizeType?.split('の')[1] || '').split('、')[0].trim();
    const crToNumber = cr => {
        if (!cr) return -1;
        const crString = cr.split(' ')[0];
        return crString.includes('/') ? parseInt(crString.split('/')[0]) / parseInt(crString.split('/')[1]) : parseInt(crString);
    };
    const getArmorClassValue = ac => {
        let display = 'N/A', value = 10;
        if (ac) {
            if (typeof ac === 'object' && ac.value) {
                display = `${ac.value} (${ac.type})`;
                value = parseInt(ac.value) || 10;
            } else {
                display = ac.toString();
                value = parseInt(display.match(/\d+/)?.[0]) || 10;
            }
        }
        return { display, value };
    };
    const getAbilityModifier = scoreString => Math.floor(((parseInt(scoreString?.match(/-?\d+/)?.[0]) || 10) - 10) / 2);

    // --- Cocofolia Data Generation ---
    function generateCocofoliaJson(monster) {
        const ac = getArmorClassValue(monster.armor_class);
        const dexMod = getAbilityModifier(monster.ability_scores.dexterity);
        const memoLines = [];
        
        memoLines.push(monster.size_type_alignment || '情報なし');
        if (monster.speed) memoLines.push(`【移動速度】${monster.speed}`);
        memoLines.push('');
        
        const abilities = monster.ability_scores;
        memoLines.push(`筋力: ${abilities.strength}　敏捷力: ${abilities.dexterity}　耐久力: ${abilities.constitution}`);
        memoLines.push(`知力: ${abilities.intelligence}　判断力: ${abilities.wisdom}　魅力: ${abilities.charisma}`);
        memoLines.push('');
        
        if (monster.saving_throws || monster.skills) {
            memoLines.push('【セーヴィングスロー/技能】');
            if (monster.saving_throws) memoLines.push(monster.saving_throws);
            if (monster.skills) memoLines.push(monster.skills);
            memoLines.push('');
        }

        const addMemoSection = (title, content) => {
            if (content) memoLines.push(`【${title}】\n${content}\n`);
        };
        addMemoSection('ダメージ抵抗', monster.damage_resistances);
        addMemoSection('ダメージ完全耐性', monster.damage_immunities);
        addMemoSection('状態異常完全耐性', monster.condition_immunities);
        
        if (monster.senses) memoLines.push(`${monster.senses}\n`);
        
        if (monster.special_traits?.length > 0) {
            memoLines.push('【特殊能力】');
            monster.special_traits.forEach(t => memoLines.push(`・${t.name}: ${t.description}`));
        }

        return {
            kind: "character",
            data: {
                name: monster.name_jp,
                memo: memoLines.join('\n').trim(),
                initiative: dexMod,
                externalUrl: window.location.href,
                status: [{ label: "HP", value: monster.hit_points.average, max: monster.hit_points.average }, { label: "AC", value: ac.value, max: ac.value }],
                params: Object.values(monster.ability_scores).map(value => ({ label: "", value })),
                palette: ""
            }
        };
    }
});