document.addEventListener('DOMContentLoaded', () => {
    const monsterContainer = document.getElementById('monster-container');
    const speciesFilter = document.getElementById('species-filter');
    const crFilter = document.getElementById('cr-filter');

    let allMonsters = [];

    // 読み込むJSONファイルリスト
    const jsonFiles = [
        '両生種、鳥竜種、獣竜種.json',
        '牙獣種、牙竜種.json',
        '甲殻種.json',
        '飛竜種、海竜種.json',
        '甲虫種、魚竜種、蛇竜種.json',
        '鋏角種、鳥竜種、不明.json',
        '古龍種.json',
        '小型モンスター.json'
    ];

    // すべてのJSONファイルを読み込む
    Promise.all(jsonFiles.map(file => fetch(file).then(res => res.json())))
        .then(dataArrays => {
            allMonsters = dataArrays.flat();
            populateFilters(allMonsters);
            displayMonsters(allMonsters);
        })
        .catch(error => {
            console.error('Error loading monster data:', error);
            monsterContainer.innerHTML = '<p>モンスターデータの読み込みに失敗しました。</p>';
        });

    // フィルターの選択肢を生成
    function populateFilters(monsters) {
        const species = new Set();
        const challengeRatings = new Set();

        monsters.forEach(monster => {
            const monsterSpecies = extractSpecies(monster.size_type_alignment);
            if(monsterSpecies) species.add(monsterSpecies);
            if(monster.challenge_rating) challengeRatings.add(monster.challenge_rating.split(' ')[0]);
        });

        // 種族フィルター
        const sortedSpecies = Array.from(species).sort();
        sortedSpecies.forEach(s => {
            const option = document.createElement('option');
            option.value = s;
            option.textContent = s;
            speciesFilter.appendChild(option);
        });

        // 脅威度フィルター
        const sortedCRs = Array.from(challengeRatings).sort((a, b) => crToNumber(a) - crToNumber(b));
         sortedCRs.forEach(cr => {
            const option = document.createElement('option');
            option.value = cr;
            option.textContent = cr;
            crFilter.appendChild(option);
        });

    }

    // イベントリスナーを設定
    speciesFilter.addEventListener('change', filterMonsters);
    crFilter.addEventListener('change', filterMonsters);

    // モンスターをフィルタリングして表示
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

        displayMonsters(filteredMonsters);
    }
    
    // モンスターデータをHTMLに変換して表示
    function displayMonsters(monsters) {
        monsterContainer.innerHTML = '';
        if (monsters.length === 0) {
            monsterContainer.innerHTML = '<p>該当するモンスターが見つかりませんでした。</p>';
            return;
        }

        monsters.forEach(monster => {
            const monsterCard = document.createElement('div');
            monsterCard.className = 'stat-block';

            let armorClass = monster.armor_class || 'N/A';
            if (typeof monster.armor_class === 'object') {
                armorClass = `${monster.armor_class.value} (${monster.armor_class.type})`;
            }

            monsterCard.innerHTML = `
                <h2>${monster.name_jp} (${monster.name_en})</h2>
                <p class="size-type">${monster.size_type_alignment}</p>
                <div class="separator"></div>
                <p><strong>アーマークラス:</strong> ${armorClass}</p>
                <p><strong>ヒットポイント:</strong> ${monster.hit_points.average} (${monster.hit_points.dice})</p>
                <p><strong>移動速度:</strong> ${monster.speed}</p>
                <div class="separator"></div>
                <ul class="ability-scores">
                    <li><strong>筋力</strong>${monster.ability_scores.strength}</li>
                    <li><strong>敏捷力</strong>${monster.ability_scores.dexterity}</li>
                    <li><strong>耐久力</strong>${monster.ability_scores.constitution}</li>
                    <li><strong>知力</strong>${monster.ability_scores.intelligence}</li>
                    <li><strong>判断力</strong>${monster.ability_scores.wisdom}</li>
                    <li><strong>魅力</strong>${monster.ability_scores.charisma}</li>
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
                <div class="separator"></div>
                
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

    // 各セクション（アクションなど）をレンダリングするヘルパー関数
    function renderSection(title, items) {
        if (!items || items.length === 0) return '';
        return `
            <div class="${title.toLowerCase().replace(' ', '-')}">
                <h3>${title}</h3>
                ${items.map(item => `
                    <div class="trait-item">
                        <p><strong>${item.name}.</strong> ${item.description}</p>
                    </div>
                `).join('')}
            </div>
        `;
    }

    // "大型の両生種、無属性" のような文字列から "両生種" を抽出する
    function extractSpecies(sizeType) {
        if (!sizeType) return null;
        const parts = sizeType.split('の');
        if (parts.length > 1) {
            return parts[1].split('、')[0].trim();
        }
        return null;
    }

    // 脅威度 (CR) をソート可能な数値に変換する
    function crToNumber(cr) {
        if (cr.includes('/')) {
            const parts = cr.split('/');
            return parseInt(parts[0], 10) / parseInt(parts[1], 10);
        }
        return parseInt(cr, 10);
    }
});