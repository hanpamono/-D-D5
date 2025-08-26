document.addEventListener('DOMContentLoaded', () => {
    // --- Dark Mode Logic ---
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const body = document.body;

    // Function to apply the theme
    function applyTheme(theme) {
        if (theme === 'dark') {
            body.classList.add('dark-mode');
            darkModeToggle.textContent = '☀️';
        } else {
            body.classList.remove('dark-mode');
            darkModeToggle.textContent = '🌙';
        }
    }

    // On page load, check for saved theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);

    darkModeToggle.addEventListener('click', () => {
        const currentTheme = localStorage.getItem('theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', newTheme);
        applyTheme(newTheme);
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
    
    const timestamp = `?t=${new Date().getTime()}`;
    const fetchPromises = jsonFiles.map(file => 
        fetch(file + timestamp).then(res => {
            if (!res.ok) throw new Error(`Failed to load ${file}`);
            return res.json();
        })
    );

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
            monsterContainer.innerHTML = `<p style="color: red;">モンスターデータの読み込みに失敗しました。ファイル名やJSONの形式が正しいか確認してください。</p>`;
        });

    function displaySingleMonster(monster) {
        filtersContainer.style.display = 'none';
        monsterContainer.className = 'single-monster-view';
        
        navigationControls.innerHTML = `
            <button class="nav-button" id="back-to-list">一覧に戻る</button>
            <button class="nav-button" id="copy-url">共有用URLをコピー</button>
            <button class="nav-button" id="cocofolia-button">ココフォリア用データをコピー</button>
        `;
        
        document.getElementById('back-to-list').addEventListener('click', () => window.location.href = window.location.pathname);
        document.getElementById('copy-url').addEventListener('click', () => copyUrlToClipboard());
        document.getElementById('cocofolia-button').addEventListener('click', () => copyCocofoliaData(monster));

        displayMonsters([monster]);
    }
    
    function copyUrlToClipboard() {
        navigator.clipboard.writeText(window.location.href).then(() => alert('URLをクリップボードにコピーしました！'));
    }
    
    function copyCocofoliaData(monster) {
        try {
            const cocofoliaData = generateCocofoliaJson(monster);
            
            // For debugging: Let's log what we are trying to copy
            console.log("--- Generating Cocofolia Data ---");
            console.log("Monster Source:", monster);
            console.log("Generated Palette:", cocofoliaData.data.palette);
            console.log("Full JSON:", cocofoliaData);
            
            if (!monster.commands || typeof monster.commands !== 'string' || monster.commands.trim() === "") {
                alert("エラー: このモンスターのチャットパレットデータ(commands)がJSONファイルから読み込めていません。\n\n考えられる原因:\n1. このモンスターのJSONデータに`commands`キーが存在しない。\n2. ブラウザのキャッシュが古い。（Ctrl+F5で更新してください）");
                return;
            }

            navigator.clipboard.writeText(JSON.stringify(cocofoliaData, null, 2)).then(() => {
                alert('ココフォリア用のデータをコピーしました。\nココフォリアの画面上でペーストするとコマが作成されます。');
            });
        } catch (e) {
            console.error("Failed to generate or copy Cocofolia data:", e);
            alert("ココフォリア用データの生成またはコピーに失敗しました。F12キーでコンソールを開き、エラー内容を確認してください。");
        }
    }

    function initializeListView() {
        populateFilters(allMonsters);
        searchBar.addEventListener('input', filterAndSortMonsters);
        speciesFilter.addEventListener('change', filterAndSortMonsters);
        crFilter.addEventListener('change', filterAndSortMonsters);
        sortOrder.addEventListener('change', filterAndSortMonsters);
        filterAndSortMonsters();
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
        Array.from(species).sort().forEach(s => speciesFilter.appendChild(new Option(s, s)));
        Array.from(challengeRatings).sort((a, b) => crToNumber(a) - crToNumber(b)).forEach(cr => crFilter.appendChild(new Option(cr, cr)));
    }

    function filterAndSortMonsters() {
        let processedMonsters = [...allMonsters];
        const searchTerm = searchBar.value.toLowerCase();
        if (searchTerm) {
            processedMonsters = processedMonsters.filter(m =>
                m.name_jp.toLowerCase().includes(searchTerm) ||
                (m.name_en && m.name_en.toLowerCase().includes(searchTerm))
            );
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
        displayMonsters(processedMonsters);
    }

    function displayMonsters(monsters, isSingleView = false) {
        monsterContainer.innerHTML = '';
        monsterContainer.className = isSingleView ? 'single-monster-view' : '';

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
            monsterContainer.appendChild(monsterCard);
        });
    }

    function renderSimpleP(label, content) {
        return content ? `<p><strong>${label}:</strong> ${content}</p>` : '';
    }

    function renderSection(title, items) {
        if (!items || !Array.isArray(items) || items.length === 0) return '';
        return `
            <div class="${title.toLowerCase().replace(/ /g, '-')}">
                <div class="separator"></div>
                <h3>${title}</h3>
                ${items.map(item => `<div class="trait-item"><p><strong><em>${item.name}.</em></strong> ${item.description}</p></div>`).join('')}
            </div>
        `;
    }
    
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

        const addMemoSection = (title, content) => { if (content) memoLines.push(`【${title}】\n${content}\n`); };
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
                params: Object.entries(abilities).map(([key, value]) => ({ label: key, value: value })),
                palette: monster.commands || ""
            }
        };
    }
});