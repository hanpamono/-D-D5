document.addEventListener('DOMContentLoaded', () => {
    const monsterContainer = document.getElementById('monster-container');
    const speciesFilter = document.getElementById('species-filter');
    const crFilter = document.getElementById('cr-filter');
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
                if (monster) {
                    displaySingleMonster(monster);
                } else {
                    displayNotFound();
                }
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
    
    window.copyUrlToClipboard = function() {
        navigator.clipboard.writeText(window.location.href).then(() => {
            alert('URLをクリップボードにコピーしました！');
        });
    };
    
    window.copyCocofoliaData = function(monster) {
        try {
            const cocofoliaData = generateCocofoliaJson(monster);
            navigator.clipboard.writeText(JSON.stringify(cocofoliaData, null, 2)).then(() => {
                alert('ココフォリア用のデータをコピーしました。\nココフォリアの画面上でペーストするとコマが作成されます。');
            }, () => {
                alert('コピーに失敗しました。');
            });
        } catch (e) {
            console.error("Failed to generate Cocofolia data:", e);
            alert("ココフォリア用データの生成に失敗しました。詳細はブラウザのコンソールを確認してください。");
        }
    };


    function initializeListView() {
        populateFilters(allMonsters);
        filterMonsters();
        speciesFilter.addEventListener('change', filterMonsters);
        crFilter.addEventListener('change', filterMonsters);
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

        const sortedSpecies = Array.from(species).sort();
        sortedSpecies.forEach(s => {
            const option = document.createElement('option');
            option.value = s;
            option.textContent = s;
            speciesFilter.appendChild(option);
        });

        const sortedCRs = Array.from(challengeRatings).sort((a, b) => crToNumber(a) - crToNumber(b));
        sortedCRs.forEach(cr => {
            const option = document.createElement('option');
            option.value = cr;
            option.textContent = cr;
            crFilter.appendChild(option);
        });
    }

    function filterMonsters() {
        let filteredMonsters = allMonsters;
        const selectedSpecies = speciesFilter.value;
        const selectedCR = crFilter.value;

        if (selectedSpecies !== 'all') {
            filteredMonsters = filteredMonsters.filter(m => extractSpecies(m.size_type_alignment) === selectedSpecies);
        }
        if (selectedCR !== 'all') {
            filteredMonsters = filteredMonsters.filter(m => m.challenge_rating && m.challenge_rating.startsWith(selectedCR));
        }

        displayMonsters(filteredMonsters, false);
    }

    function displayMonsters(monsters, isSingleView) {
        monsterContainer.innerHTML = '';
        if (monsters.length === 0) {
            monsterContainer.innerHTML = '<p>該当するモンスターが見つかりませんでした。</p>';
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
    function extractSpecies(sizeType) {
        if (!sizeType) return null;
        const parts = sizeType.split('の');
        if (parts.length > 1) {
            return parts[1].split('、')[0].trim();
        }
        return null;
    }

    function crToNumber(cr) {
        if (!cr) return -1;
        const crString = cr.split(' ')[0];
        if (crString.includes('/')) {
            const parts = crString.split('/');
            return parseInt(parts[0], 10) / parseInt(parts[1], 10);
        }
        return parseInt(crString, 10);
    }
    
    function getArmorClassValue(ac) {
        let display = 'N/A';
        let value = 10;
        if (ac) {
            if (typeof ac === 'object' && ac.value) {
                display = `${ac.value} (${ac.type})`;
                value = parseInt(ac.value, 10) || 10;
            } else if (typeof ac === 'string' || typeof ac === 'number') {
                display = ac.toString();
                const matchedValue = display.match(/\d+/);
                if (matchedValue) value = parseInt(matchedValue[0], 10);
            }
        }
        return { display, value };
    }
    
    function getAbilityModifier(scoreString) {
        if (!scoreString) return 0;
        const scoreMatch = scoreString.match(/-?\d+/);
        if (!scoreMatch) return 0;
        const score = parseInt(scoreMatch[0], 10);
        return Math.floor((score - 10) / 2);
    }
    
    // --- Cocofolia Data Generation (Layout Improved) ---
    function generateCocofoliaJson(monster) {
        const ac = getArmorClassValue(monster.armor_class);
        const dexMod = getAbilityModifier(monster.ability_scores.dexterity);
        
        const memoLines = [];

        // Line 1: Size and Type
        memoLines.push(monster.size_type_alignment || '情報なし');

        // Line 2: Speed
        if (monster.speed) {
            memoLines.push(`【移動速度】${monster.speed}`);
        }
        memoLines.push(''); // Blank line

        // Line 3 & 4: Ability Scores
        const abilities = monster.ability_scores;
        memoLines.push(`筋力: ${abilities.strength}　敏捷力: ${abilities.dexterity}　耐久力: ${abilities.constitution}`);
        memoLines.push(`知力: ${abilities.intelligence}　判断力: ${abilities.wisdom}　魅力: ${abilities.charisma}`);
        memoLines.push(''); // Blank line

        // Saves and Skills
        if (monster.saving_throws || monster.skills) {
            memoLines.push('【セーヴィングスロー】');
            if (monster.saving_throws) memoLines.push(monster.saving_throws);
            if (monster.skills) memoLines.push(monster.skills);
            memoLines.push(''); // Blank line
        }

        // Resistances and Immunities
        if (monster.damage_resistances) memoLines.push(`【ダメージ抵抗】\n${monster.damage_resistances}\n`);
        if (monster.damage_immunities) memoLines.push(`【ダメージ完全耐性】\n${monster.damage_immunities}\n`);
        if (monster.condition_immunities) memoLines.push(`【状態異常完全耐性】\n${monster.condition_immunities}\n`);
        
        // Senses (without title)
        if (monster.senses) {
            memoLines.push(`${monster.senses}\n`);
        }

        // Special Traits
        if (monster.special_traits && monster.special_traits.length > 0) {
            memoLines.push('【特殊能力】');
            monster.special_traits.forEach(trait => {
                memoLines.push(`・${trait.name}: ${trait.description}`);
            });
        }

        const data = {
            kind: "character",
            data: {
                name: monster.name_jp,
                memo: memoLines.join('\n').trim(),
                initiative: dexMod,
                externalUrl: window.location.href,
                status: [
                    { label: "HP", value: monster.hit_points.average, max: monster.hit_points.average },
                    { label: "AC", value: ac.value, max: ac.value }
                ],
                params: [
                    { label: "筋力", value: monster.ability_scores.strength },
                    { label: "敏捷力", value: monster.ability_scores.dexterity },
                    { label: "耐久力", value: monster.ability_scores.constitution },
                    { label: "知力", value: monster.ability_scores.intelligence },
                    { label: "判断力", value: monster.ability_scores.wisdom },
                    { label: "魅力", value: monster.ability_scores.charisma }
                ],
                palette: ""
            }
        };
        return data;
    }
});