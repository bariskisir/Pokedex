document.addEventListener('DOMContentLoaded', () => {
    const btnMinimize = document.getElementById('btn-minimize');
    const btnClose = document.getElementById('btn-close');

    if (btnMinimize && btnClose && window.require) {
        const { ipcRenderer } = window.require('electron');
        btnMinimize.addEventListener('click', (e) => {
            e.stopPropagation();
            ipcRenderer.send('minimize-app');
        });
        btnClose.addEventListener('click', (e) => {
            e.stopPropagation();
            ipcRenderer.send('close-app');
        });
    }

    if (window.require) {
        const { ipcRenderer } = window.require('electron');
        window.addEventListener('mousemove', (event) => {
            const isOverInteractive = event.target.closest('#left-panel') ||
                event.target.closest('#right-panel') ||
                event.target.closest('#window-controls') ||
                event.target.classList.contains('left-curve-cutout');

            if (isOverInteractive) {
                ipcRenderer.send('set-ignore-mouse-events', false);
            } else {
                ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
            }
        });
        ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
    }

    const searchInput = document.getElementById('search-input');
    const searchClear = document.getElementById('search-clear');

    if (searchInput && searchClear) {
        searchInput.addEventListener('input', () => {
            searchClear.classList.toggle('visible', searchInput.value.length > 0);
        });

        searchClear.addEventListener('click', () => {
            searchInput.value = '';
            searchClear.classList.remove('visible');
            searchInput.focus();
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    const pokemonListEl = document.getElementById('pokemon-list');
    const pkmnName = document.getElementById('pkmn-name');
    const pkmnImage = document.getElementById('pkmn-image');
    const pkmnTypes = document.getElementById('pkmn-types');
    const pkmnHeight = document.getElementById('pkmn-height');
    const pkmnWeight = document.getElementById('pkmn-weight');
    const flavorText = document.getElementById('flavor-text');
    const pkmnDataContainer = document.querySelector('.pokemon-data');
    const pokemonMovesEl = document.getElementById('pokemon-moves');
    const pokemonEvolutionsEl = document.getElementById('pokemon-evolutions');
    const topLens = document.querySelector('.big-blue-glass');
    const smallLights = document.querySelectorAll('.small-lights .light');

    let allPokemon = [];
    const pokemonCache = new Map();

    const playLights = () => {
        let count = 0;
        const interval = setInterval(() => {
            topLens.classList.toggle('flash');
            smallLights.forEach(l => l.classList.toggle('flash'));
            count++;
            if (count > 6) {
                clearInterval(interval);
                topLens.classList.remove('flash');
                smallLights.forEach(l => l.classList.remove('flash'));
            }
        }, 300);
    };

    pkmnDataContainer.style.display = 'block';

    const fetchPokemonList = async () => {
        try {
            const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=10000');
            const data = await res.json();
            allPokemon = data.results.map((p, index) => {
                const urlParts = p.url.split('/');
                const apiId = parseInt(urlParts[urlParts.length - 2]);
                return {
                    ...p,
                    displayId: index + 1,
                    apiId: apiId
                };
            });
            renderList(allPokemon);
        } catch (error) {
            console.error(error);
            pokemonListEl.innerHTML = '<li style="color:red">Error loading data</li>';
        }
    };

    const renderList = (list) => {
        pokemonListEl.innerHTML = '';
        list.forEach(p => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="pkmn-number">#${p.displayId.toString().padStart(3, '0')}</span> <span class="pkmn-list-name">${p.name.toUpperCase()}</span>`;
            li.addEventListener('click', () => loadPokemon(p.apiId, p.displayId));
            pokemonListEl.appendChild(li);
        });
    };

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const val = e.target.value.toLowerCase();
            const filtered = allPokemon.filter(p => p.name.includes(val) || p.displayId.toString().includes(val));
            renderList(filtered);
        });
    }

    const loadPokemon = async (id, displayId) => {
        playLights();

        if (pokemonCache.has(id)) {
            renderPokemonData(pokemonCache.get(id), displayId);
            return;
        }

        try {
            pkmnName.innerText = "LOADING...";
            pkmnImage.src = "";
            pkmnTypes.innerHTML = '';
            pkmnHeight.innerText = "HT: --";
            pkmnWeight.innerText = "WT: --";
            flavorText.innerText = "Fetching data...";
            pokemonEvolutionsEl.innerHTML = "Loading...";

            const mainScreen = document.getElementById('main-screen');
            if (mainScreen) mainScreen.scrollTop = 0;
            if (pokemonMovesEl) pokemonMovesEl.scrollTop = 0;

            const pkmnRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
            if (!pkmnRes.ok) throw new Error('Pokemon not found');
            const pkmnData = await pkmnRes.json();

            const speciesRes = await fetch(pkmnData.species.url);
            let speciesData = null;
            if (speciesRes.ok) {
                speciesData = await speciesRes.json();
            }

            const [typeDetails, evolutionChain] = await Promise.all([
                Promise.all(pkmnData.types.map(t => fetch(t.type.url).then(r => r.json()))),
                fetchEvolutionChain(speciesData)
            ]);

            const fullData = { pkmnData, speciesData, typeDetails, evolutionChain };
            pokemonCache.set(id, fullData);
            renderPokemonData(fullData, displayId);

        } catch (error) {
            console.error(error);
            flavorText.innerText = "Error loading data.";
        }
    };

    const fetchEvolutionChain = async (speciesData) => {
        if (!speciesData || !speciesData.evolution_chain) return null;
        try {
            const res = await fetch(speciesData.evolution_chain.url);
            const data = await res.json();
            const chainArr = [];
            const parseChain = (stage) => {
                chainArr.push({ name: stage.species.name, url: stage.species.url });
                if (stage.evolves_to && stage.evolves_to.length > 0) {
                    stage.evolves_to.forEach(next => parseChain(next));
                }
            };
            parseChain(data.chain);
            return chainArr;
        } catch (error) {
            return null;
        }
    };

    const renderPokemonData = (data, displayId) => {
        const { pkmnData, speciesData, typeDetails, evolutionChain } = data;

        pkmnName.innerText = `#${displayId || pkmnData.id} ` + pkmnData.name.toUpperCase();
        pkmnImage.src = pkmnData.sprites.other['official-artwork'].front_default || pkmnData.sprites.front_default || '';
        pkmnHeight.innerText = `HT: ${pkmnData.height / 10}m`;
        pkmnWeight.innerText = `WT: ${pkmnData.weight / 10}kg`;

        pkmnTypes.innerHTML = pkmnData.types.map(t => `<span class="type-badge ${t.type.name}">${t.type.name}</span>`).join('');
        renderEffectiveness(typeDetails);

        if (speciesData && speciesData.flavor_text_entries) {
            const engEntry = speciesData.flavor_text_entries.find(e => e.language.name === 'en');
            flavorText.innerText = engEntry ? engEntry.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ') : "No data available.";
        } else {
            flavorText.innerText = "Data unknown.";
        }

        renderMoves(pkmnData.moves);
        renderEvolutions(evolutionChain);
    };

    const renderMoves = (moves) => {
        pokemonMovesEl.innerHTML = '';
        const sortedMoves = moves.map(m => {
            const verDetail = m.version_group_details.find(v => v.move_learn_method.name === 'level-up');
            return {
                name: m.move.name.replace('-', ' '),
                level: verDetail ? verDetail.level_learned_at : '-'
            };
        }).sort((a, b) => {
            if (a.level === '-' && b.level !== '-') return 1;
            if (b.level === '-' && a.level !== '-') return -1;
            return a.level - b.level;
        });

        if (sortedMoves.length === 0) {
            pokemonMovesEl.innerHTML = '<li>No moves found</li>';
            return;
        }

        sortedMoves.forEach(m => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="move-name">${m.name}</span>`;
            pokemonMovesEl.appendChild(li);
        });
    };

    const renderEffectiveness = (typeData) => {
        const pkmnEffectiveness = document.getElementById('pkmn-effectiveness');
        pkmnEffectiveness.innerHTML = '';
        const multipliers = {};

        typeData.forEach(type => {
            const rels = type.damage_relations;
            rels.half_damage_from.forEach(t => multipliers[t.name] = (multipliers[t.name] || 1) * 0.5);
            rels.no_damage_from.forEach(t => multipliers[t.name] = (multipliers[t.name] || 1) * 0);
            rels.double_damage_from.forEach(t => multipliers[t.name] = (multipliers[t.name] || 1) * 2.0);
        });

        const sorted = (mode) => Object.keys(multipliers)
            .filter(t => mode === 'strong' ? multipliers[t] < 1 : multipliers[t] > 1)
            .sort((a, b) => mode === 'strong' ? multipliers[a] - multipliers[b] : multipliers[b] - multipliers[a]);

        const createRow = (label, types) => {
            if (types.length === 0) return;
            const row = document.createElement('div');
            row.className = 'eff-row';
            row.innerHTML = `<span class="eff-label">${label}:</span>`;
            types.forEach(t => {
                const card = document.createElement('span');
                card.className = `eff-card ${label === 'WEAK' ? 'weakness' : 'strength'}`;
                card.innerText = `${t}${multipliers[t] !== 2 && multipliers[t] !== 0.5 && multipliers[t] !== 1 ? ' x' + multipliers[t] : ''}`;
                row.appendChild(card);
            });
            pkmnEffectiveness.appendChild(row);
        };

        createRow('WEAK', sorted('weak'));
        createRow('STRONG', sorted('strong'));
    };

    const renderEvolutions = async (chain) => {
        const evoContainer = document.querySelector('.evolution-container');
        if (!chain || chain.length <= 1) {
            evoContainer.style.display = 'none';
            pokemonEvolutionsEl.innerHTML = '';
            return;
        }
        evoContainer.style.display = 'block';
        pokemonEvolutionsEl.innerHTML = '';

        for (let i = 0; i < chain.length; i++) {
            const p = chain[i];
            const pokeRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${p.name}`);
            const pokeData = await pokeRes.json();
            const listRef = allPokemon.find(ap => ap.name === p.name);
            const displayId = listRef ? listRef.displayId : pokeData.id;

            const div = document.createElement('div');
            div.className = 'evo-item';
            div.innerHTML = `
                <img src="${pokeData.sprites.front_default}" alt="${p.name}">
                <span>${p.name}</span>
            `;
            div.addEventListener('click', () => loadPokemon(pokeData.id, displayId));
            pokemonEvolutionsEl.appendChild(div);

            if (i < chain.length - 1) {
                const arrow = document.createElement('div');
                arrow.className = 'evo-arrow';
                arrow.innerText = '→';
                pokemonEvolutionsEl.appendChild(arrow);
            }
        }
    };

    fetchPokemonList().then(() => {
        loadPokemon(25, 25);
    });
});
