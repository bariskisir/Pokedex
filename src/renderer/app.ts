/**
 * Runs the interactive Pokedex renderer UI, including search, Pokemon details,
 * type navigation, shiny artwork, stat rendering, evolutions, and Electron controls.
 */

type ElectronRendererModule = Pick<typeof import('electron'), 'ipcRenderer'>;

declare global {
  interface Window {
    require?: (moduleName: 'electron') => ElectronRendererModule;
  }
}

interface NamedApiResource {
  name: string;
  url: string;
}

interface PokemonListItem extends NamedApiResource {
  displayId: number;
  apiId: number;
}

interface EvolutionItem extends NamedApiResource {}

interface PokemonDataBundle {
  pkmnData: any;
  speciesData: any;
  typeDetails: any[];
  evolutionChain: EvolutionItem[] | null;
}

interface RendererElements {
  btnMinimize: HTMLButtonElement | null;
  btnClose: HTMLButtonElement | null;
  searchInput: HTMLInputElement | null;
  searchClear: HTMLElement | null;
  pokemonList: HTMLUListElement;
  pkmnName: HTMLElement;
  pkmnImage: HTMLImageElement;
  pkmnTypes: HTMLElement;
  pkmnHeight: HTMLElement;
  pkmnWeight: HTMLElement;
  flavorText: HTMLElement;
  pkmnDataContainer: HTMLElement;
  pokemonMoves: HTMLUListElement;
  pokemonEvolutions: HTMLElement;
  pkmnAbilities: HTMLElement;
  pkmnStats: HTMLElement;
  shinyToggle: HTMLElement | null;
  topLens: HTMLElement;
  smallLights: NodeListOf<Element>;
  screenSpeaker: HTMLElement | null;
  typeListScreen: HTMLElement;
  typeListBack: HTMLElement | null;
  typeListTitle: HTMLElement;
  typePokemonList: HTMLElement;
}

const POKEAPI_BASE_URL = 'https://pokeapi.co/api/v2';
const SPRITE_BASE_URL = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites';
const FALLBACK_SPRITE_URL = `${SPRITE_BASE_URL}/items/poke-ball.png`;

/**
 * Returns a required DOM element and fails early when the HTML contract changes.
 */
function getRequiredElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);

  if (!element) {
    throw new Error(`Missing required element: #${id}`);
  }

  return element as T;
}

/**
 * Returns an optional DOM element when a feature can safely be unavailable.
 */
function getOptionalElement<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

class PokedexApp {
  private readonly elements: RendererElements;
  private readonly pokemonCache = new Map<string | number, PokemonDataBundle>();
  private allPokemon: PokemonListItem[] = [];
  private isShiny = false;
  private currentPokemonData: PokemonDataBundle | null = null;
  private currentAudio: HTMLAudioElement | null = null;

  /**
   * Collects all DOM dependencies once so UI methods operate on typed elements.
   */
  public constructor() {
    this.elements = {
      btnMinimize: getOptionalElement<HTMLButtonElement>('btn-minimize'),
      btnClose: getOptionalElement<HTMLButtonElement>('btn-close'),
      searchInput: getOptionalElement<HTMLInputElement>('search-input'),
      searchClear: getOptionalElement<HTMLElement>('search-clear'),
      pokemonList: getRequiredElement<HTMLUListElement>('pokemon-list'),
      pkmnName: getRequiredElement<HTMLElement>('pkmn-name'),
      pkmnImage: getRequiredElement<HTMLImageElement>('pkmn-image'),
      pkmnTypes: getRequiredElement<HTMLElement>('pkmn-types'),
      pkmnHeight: getRequiredElement<HTMLElement>('pkmn-height'),
      pkmnWeight: getRequiredElement<HTMLElement>('pkmn-weight'),
      flavorText: getRequiredElement<HTMLElement>('flavor-text'),
      pkmnDataContainer: document.querySelector('.pokemon-data') as HTMLElement,
      pokemonMoves: getRequiredElement<HTMLUListElement>('pokemon-moves'),
      pokemonEvolutions: getRequiredElement<HTMLElement>('pokemon-evolutions'),
      pkmnAbilities: getRequiredElement<HTMLElement>('pkmn-abilities'),
      pkmnStats: getRequiredElement<HTMLElement>('pkmn-stats'),
      shinyToggle: getOptionalElement<HTMLElement>('shiny-toggle'),
      topLens: document.querySelector('.big-blue-glass') as HTMLElement,
      smallLights: document.querySelectorAll('.small-lights .light'),
      screenSpeaker: document.querySelector('.screen-speaker') as HTMLElement | null,
      typeListScreen: getRequiredElement<HTMLElement>('type-list-screen'),
      typeListBack: getOptionalElement<HTMLElement>('type-list-back'),
      typeListTitle: getRequiredElement<HTMLElement>('type-list-title'),
      typePokemonList: getRequiredElement<HTMLElement>('type-pokemon-list'),
    };
  }

  /**
   * Wires UI events and loads the initial Pokemon state.
   */
  public async initialize(): Promise<void> {
    this.bindWindowControls();
    this.bindMouseTransparency();
    this.bindSearch();
    this.bindShinyToggle();
    this.bindTypeListNavigation();

    this.elements.pkmnDataContainer.style.display = 'block';

    await this.fetchPokemonList();
    await this.loadPokemon(25, 25);
  }

  /**
   * Connects custom titlebar buttons to Electron window IPC events.
   */
  private bindWindowControls(): void {
    if (!this.elements.btnMinimize || !this.elements.btnClose || !window.require) {
      return;
    }

    const { ipcRenderer } = window.require('electron');

    this.elements.btnMinimize.addEventListener('click', (event) => {
      event.stopPropagation();
      ipcRenderer.send('minimize-app');
    });

    this.elements.btnClose.addEventListener('click', (event) => {
      event.stopPropagation();
      ipcRenderer.send('close-app');
    });
  }

  /**
   * Allows clicks through the transparent Electron window outside interactive panels.
   */
  private bindMouseTransparency(): void {
    if (!window.require) {
      return;
    }

    const { ipcRenderer } = window.require('electron');

    window.addEventListener('mousemove', (event) => {
      const target = event.target as Element | null;
      const isOverInteractive = target?.closest('#left-panel') ||
        target?.closest('#right-panel') ||
        target?.closest('#window-controls') ||
        target?.classList.contains('left-curve-cutout');

      ipcRenderer.send('set-ignore-mouse-events', !isOverInteractive, isOverInteractive ? undefined : { forward: true });
    });

    ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
  }

  /**
   * Filters the Pokemon list as the user types and exposes a clear button.
   */
  private bindSearch(): void {
    if (!this.elements.searchInput || !this.elements.searchClear) {
      return;
    }

    this.elements.searchInput.addEventListener('input', () => {
      const value = this.elements.searchInput?.value.toLowerCase() ?? '';
      const filtered = this.allPokemon.filter((pokemon) =>
        pokemon.name.includes(value) || pokemon.displayId.toString().includes(value),
      );

      this.elements.searchClear?.classList.toggle('visible', value.length > 0);
      this.renderList(filtered);
    });

    this.elements.searchClear.addEventListener('click', () => {
      if (!this.elements.searchInput || !this.elements.searchClear) {
        return;
      }

      this.elements.searchInput.value = '';
      this.elements.searchClear.classList.remove('visible');
      this.elements.searchInput.focus();
      this.elements.searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  /**
   * Toggles shiny artwork for the currently selected Pokemon.
   */
  private bindShinyToggle(): void {
    this.elements.shinyToggle?.addEventListener('click', () => {
      this.isShiny = !this.isShiny;
      this.elements.shinyToggle?.classList.toggle('active', this.isShiny);

      if (this.currentPokemonData) {
        this.renderPokemonImage(this.currentPokemonData.pkmnData);
      }
    });
  }

  /**
   * Returns from the type list screen to the detail screen.
   */
  private bindTypeListNavigation(): void {
    this.elements.typeListBack?.addEventListener('click', () => {
      this.showPokemonDetail();
    });
  }

  /**
   * Animates the Pokedex lights during data loading.
   */
  private playLights(): void {
    let count = 0;
    const interval = window.setInterval(() => {
      this.elements.topLens.classList.toggle('flash');
      this.elements.smallLights.forEach((light) => light.classList.toggle('flash'));
      count += 1;

      if (count > 6) {
        window.clearInterval(interval);
        this.elements.topLens.classList.remove('flash');
        this.elements.smallLights.forEach((light) => light.classList.remove('flash'));
      }
    }, 300);
  }

  /**
   * Plays the Pokemon cry while showing visual feedback on the speaker.
   */
  private playPokemonCry(cries: any): void {
    if (!cries) {
      return;
    }

    const audioUrl = cries.latest || cries.legacy;

    if (!audioUrl) {
      return;
    }

    this.currentAudio?.pause();
    this.currentAudio = new Audio(audioUrl);
    this.currentAudio.volume = 0.5;
    this.elements.screenSpeaker?.classList.add('playing');

    this.currentAudio.play().catch((error) => console.error('Audio play failed:', error));
    this.currentAudio.onended = () => {
      this.elements.screenSpeaker?.classList.remove('playing');
      this.currentAudio = null;
    };
  }

  /**
   * Loads the Pokemon index used by search and display numbering.
   */
  private async fetchPokemonList(): Promise<void> {
    try {
      const response = await fetch(`${POKEAPI_BASE_URL}/pokemon?limit=10000`);
      const data = await response.json();

      this.allPokemon = data.results.map((pokemon: NamedApiResource, index: number) => {
        const urlParts = pokemon.url.split('/');
        const apiId = Number.parseInt(urlParts[urlParts.length - 2], 10);

        return {
          ...pokemon,
          displayId: index + 1,
          apiId,
        };
      });

      this.renderList(this.allPokemon);
    } catch (error) {
      console.error(error);
      this.elements.pokemonList.innerHTML = '<li style="color:red">Error loading data</li>';
    }
  }

  /**
   * Renders the left-side Pokemon search results.
   */
  private renderList(list: PokemonListItem[]): void {
    this.elements.pokemonList.innerHTML = '';

    list.forEach((pokemon) => {
      const item = document.createElement('li');
      item.innerHTML = `<span class="pkmn-number">#${pokemon.displayId.toString().padStart(3, '0')}</span> <span class="pkmn-list-name">${pokemon.name.toUpperCase()}</span>`;
      item.addEventListener('click', () => void this.loadPokemon(pokemon.apiId, pokemon.displayId));
      this.elements.pokemonList.appendChild(item);
    });
  }

  /**
   * Loads detailed Pokemon data, using an in-memory cache for repeat visits.
   */
  private async loadPokemon(id: string | number, displayId: number): Promise<void> {
    this.playLights();

    const cachedPokemon = this.pokemonCache.get(id);

    if (cachedPokemon) {
      this.renderPokemonData(cachedPokemon, displayId);
      return;
    }

    try {
      this.renderLoadingState();

      const pokemonResponse = await fetch(`${POKEAPI_BASE_URL}/pokemon/${id}`);

      if (!pokemonResponse.ok) {
        throw new Error('Pokemon not found');
      }

      const pkmnData = await pokemonResponse.json();
      const speciesResponse = await fetch(pkmnData.species.url);
      const speciesData = speciesResponse.ok ? await speciesResponse.json() : null;
      const [typeDetails, evolutionChain] = await Promise.all([
        Promise.all(pkmnData.types.map((typeSlot: any) => fetch(typeSlot.type.url).then((response) => response.json()))),
        this.fetchEvolutionChain(speciesData),
      ]);
      const fullData = { pkmnData, speciesData, typeDetails, evolutionChain };

      this.pokemonCache.set(id, fullData);
      this.renderPokemonData(fullData, displayId);
    } catch (error) {
      console.error(error);
      this.elements.flavorText.innerText = 'Error loading data.';
    }
  }

  /**
   * Resets the detail screen while remote Pokemon data is loading.
   */
  private renderLoadingState(): void {
    this.elements.pkmnName.innerText = 'LOADING...';
    this.elements.pkmnImage.src = '';
    this.elements.pkmnTypes.innerHTML = '';
    this.elements.pkmnHeight.innerText = 'HT: --';
    this.elements.pkmnWeight.innerText = 'WT: --';
    this.elements.flavorText.innerText = 'Fetching data...';
    this.elements.pokemonEvolutions.innerHTML = 'Loading...';
    document.getElementById('main-screen')?.scrollTo({ top: 0 });
    this.elements.pokemonMoves.scrollTop = 0;
  }

  /**
   * Flattens the species evolution chain into an ordered list.
   */
  private async fetchEvolutionChain(speciesData: any): Promise<EvolutionItem[] | null> {
    if (!speciesData?.evolution_chain) {
      return null;
    }

    try {
      const response = await fetch(speciesData.evolution_chain.url);
      const data = await response.json();
      const chain: EvolutionItem[] = [];

      /**
       * Recursively traverses each evolution stage from the API chain.
       */
      const parseChain = (stage: any): void => {
        chain.push({ name: stage.species.name, url: stage.species.url });
        stage.evolves_to?.forEach((nextStage: any) => parseChain(nextStage));
      };

      parseChain(data.chain);
      return chain;
    } catch (error) {
      console.error(error);
      return null;
    }
  }

  /**
   * Renders all visible detail sections for the selected Pokemon.
   */
  private renderPokemonData(data: PokemonDataBundle, displayId: number): void {
    const { pkmnData, speciesData, typeDetails, evolutionChain } = data;

    this.currentPokemonData = data;
    this.elements.pkmnName.innerText = `#${displayId || pkmnData.id} ${pkmnData.name.toUpperCase()}`;
    this.renderPokemonImage(pkmnData);
    this.elements.pkmnHeight.innerText = `HT: ${pkmnData.height / 10}m`;
    this.elements.pkmnWeight.innerText = `WT: ${pkmnData.weight / 10}kg`;
    this.renderTypes(pkmnData.types);
    this.renderAbilities(pkmnData.abilities);
    this.renderEffectiveness(typeDetails);
    this.renderStats(pkmnData.stats);
    this.renderFlavorText(speciesData);
    this.renderMoves(pkmnData.moves);
    void this.renderEvolutions(evolutionChain);
    this.playPokemonCry(pkmnData.cries);
  }

  /**
   * Renders type badges and wires each badge to the type list view.
   */
  private renderTypes(types: any[]): void {
    this.elements.pkmnTypes.innerHTML = types
      .map((typeSlot) => `<span class="type-badge ${typeSlot.type.name}">${typeSlot.type.name}</span>`)
      .join('');

    this.elements.pkmnTypes.querySelectorAll('.type-badge').forEach((badge) => {
      badge.addEventListener('click', (event) => {
        const typeName = (event.target as HTMLElement).innerText.toLowerCase();
        void this.loadPokemonByType(typeName);
      });
    });
  }

  /**
   * Selects normal or shiny artwork for the current Pokemon.
   */
  private renderPokemonImage(pkmnData: any): void {
    const artwork = pkmnData.sprites.other['official-artwork'];
    const standardImage = artwork.front_default || pkmnData.sprites.front_default || '';
    const shinyImage = artwork.front_shiny || pkmnData.sprites.front_shiny || standardImage;

    this.elements.pkmnImage.src = this.isShiny ? shinyImage : standardImage;
  }

  /**
   * Renders regular and hidden abilities.
   */
  private renderAbilities(abilities: any[]): void {
    this.elements.pkmnAbilities.innerHTML = abilities
      .map((abilitySlot) => `
        <span class="ability-badge ${abilitySlot.is_hidden ? 'hidden' : ''}" title="${abilitySlot.is_hidden ? 'Hidden Ability' : 'Ability'}">
          ${abilitySlot.ability.name.replace('-', ' ')}
        </span>
      `)
      .join('');
  }

  /**
   * Renders the English flavor text when it exists.
   */
  private renderFlavorText(speciesData: any): void {
    const englishEntry = speciesData?.flavor_text_entries?.find((entry: any) => entry.language.name === 'en');

    this.elements.flavorText.innerText = englishEntry
      ? englishEntry.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ')
      : 'No data available.';
  }

  /**
   * Renders base stats with animated progress bars.
   */
  private renderStats(stats: any[]): void {
    const statNames: Record<string, string> = {
      hp: 'HP',
      attack: 'ATK',
      defense: 'DEF',
      'special-attack': 'SPA',
      'special-defense': 'SPD',
      speed: 'SPE',
    };

    this.elements.pkmnStats.innerHTML = '';

    stats.forEach((statSlot) => {
      const shortName = statNames[statSlot.stat.name] ?? statSlot.stat.name.toUpperCase();
      const statClass = `stat-${shortName.toLowerCase()}`;
      const percentage = Math.min((statSlot.base_stat / 255) * 100, 100);
      const row = document.createElement('div');

      row.className = `stat-row ${statClass}`;
      row.innerHTML = `
        <span class="stat-label">${shortName}</span>
        <div class="stat-bar-bg">
          <div class="stat-bar-fill" style="width: 0%"></div>
        </div>
        <span class="stat-value">${statSlot.base_stat}</span>
      `;

      this.elements.pkmnStats.appendChild(row);
      window.setTimeout(() => {
        (row.querySelector('.stat-bar-fill') as HTMLElement).style.width = `${percentage}%`;
      }, 50);
    });
  }

  /**
   * Renders level-up moves with a stable ordering.
   */
  private renderMoves(moves: any[]): void {
    const sortedMoves = moves
      .map((moveSlot) => {
        const versionDetail = moveSlot.version_group_details.find((detail: any) => detail.move_learn_method.name === 'level-up');

        return {
          name: moveSlot.move.name.replace('-', ' '),
          level: versionDetail ? versionDetail.level_learned_at : '-',
        };
      })
      .sort((a, b) => {
        if (a.level === '-' && b.level !== '-') return 1;
        if (b.level === '-' && a.level !== '-') return -1;
        return Number(a.level) - Number(b.level);
      });

    this.elements.pokemonMoves.innerHTML = sortedMoves.length === 0 ? '<li>No moves found</li>' : '';

    sortedMoves.forEach((move) => {
      const item = document.createElement('li');
      item.innerHTML = `<span class="move-name">${move.name}</span>`;
      this.elements.pokemonMoves.appendChild(item);
    });
  }

  /**
   * Renders defensive weaknesses and resistances derived from Pokemon type data.
   */
  private renderEffectiveness(typeData: any[]): void {
    const pkmnEffectiveness = getRequiredElement<HTMLElement>('pkmn-effectiveness');
    const multipliers: Record<string, number> = {};

    pkmnEffectiveness.innerHTML = '';

    typeData.forEach((type) => {
      const relations = type.damage_relations;
      relations.half_damage_from.forEach((relation: NamedApiResource) => {
        multipliers[relation.name] = (multipliers[relation.name] || 1) * 0.5;
      });
      relations.no_damage_from.forEach((relation: NamedApiResource) => {
        multipliers[relation.name] = (multipliers[relation.name] || 1) * 0;
      });
      relations.double_damage_from.forEach((relation: NamedApiResource) => {
        multipliers[relation.name] = (multipliers[relation.name] || 1) * 2;
      });
    });

    this.renderEffectivenessRow(pkmnEffectiveness, 'WEAK', this.sortEffectiveness(multipliers, 'weak'), multipliers);
    this.renderEffectivenessRow(pkmnEffectiveness, 'STRONG', this.sortEffectiveness(multipliers, 'strong'), multipliers);
  }

  /**
   * Sorts effectiveness labels by defensive impact.
   */
  private sortEffectiveness(multipliers: Record<string, number>, mode: 'weak' | 'strong'): string[] {
    return Object.keys(multipliers)
      .filter((typeName) => mode === 'strong' ? multipliers[typeName] < 1 : multipliers[typeName] > 1)
      .sort((a, b) => mode === 'strong' ? multipliers[a] - multipliers[b] : multipliers[b] - multipliers[a]);
  }

  /**
   * Renders one effectiveness row and connects type cards to the type list view.
   */
  private renderEffectivenessRow(
    container: HTMLElement,
    label: 'WEAK' | 'STRONG',
    typeNames: string[],
    multipliers: Record<string, number>,
  ): void {
    if (typeNames.length === 0) {
      return;
    }

    const row = document.createElement('div');
    row.className = 'eff-row';
    row.innerHTML = `<span class="eff-label">${label}:</span>`;

    typeNames.forEach((typeName) => {
      const card = document.createElement('span');
      const multiplier = multipliers[typeName];
      const suffix = multiplier !== 2 && multiplier !== 0.5 && multiplier !== 1 ? ` x${multiplier}` : '';

      card.className = `eff-card ${label === 'WEAK' ? 'weakness' : 'strength'}`;
      card.innerText = `${typeName}${suffix}`;
      card.addEventListener('click', () => void this.loadPokemonByType(typeName));
      row.appendChild(card);
    });

    container.appendChild(row);
  }

  /**
   * Renders the evolution chain, including compact scaling for long chains.
   */
  private async renderEvolutions(chain: EvolutionItem[] | null): Promise<void> {
    const evoContainer = document.querySelector('.evolution-container') as HTMLElement;
    const movesContainer = document.querySelector('.moves-container') as HTMLElement | null;

    if (!chain || chain.length <= 1) {
      evoContainer.style.display = 'none';
      movesContainer?.classList.add('full-height');
      this.elements.pokemonEvolutions.innerHTML = '';
      return;
    }

    evoContainer.style.display = 'block';
    movesContainer?.classList.remove('full-height');
    this.elements.pokemonEvolutions.innerHTML = '';

    const isScaled = chain.length > 3;

    for (let index = 0; index < chain.length; index += 1) {
      const evolution = chain[index];
      const response = await fetch(`${POKEAPI_BASE_URL}/pokemon/${evolution.name}`);
      const pokemonData = await response.json();
      const listReference = this.allPokemon.find((pokemon) => pokemon.name === evolution.name);
      const displayId = listReference ? listReference.displayId : pokemonData.id;

      this.renderEvolutionItem(pokemonData, evolution.name, displayId, isScaled);

      if (index < chain.length - 1) {
        this.renderEvolutionArrow(isScaled);
      }
    }
  }

  /**
   * Renders one Pokemon in the evolution chain.
   */
  private renderEvolutionItem(pokemonData: any, name: string, displayId: number, isScaled: boolean): void {
    const item = document.createElement('div');

    item.className = `evo-item ${isScaled ? 'scaled' : ''}`;
    item.innerHTML = `
      <img src="${pokemonData.sprites.front_default}" alt="${name}">
      <span>${name}</span>
    `;
    item.addEventListener('click', () => void this.loadPokemon(pokemonData.id, displayId));
    this.elements.pokemonEvolutions.appendChild(item);
  }

  /**
   * Renders the arrow separator between evolution stages.
   */
  private renderEvolutionArrow(isScaled: boolean): void {
    const arrow = document.createElement('div');

    arrow.className = `evo-arrow ${isScaled ? 'scaled' : ''}`;
    arrow.innerText = '->';
    this.elements.pokemonEvolutions.appendChild(arrow);
  }

  /**
   * Loads and displays every Pokemon that belongs to a selected type.
   */
  private async loadPokemonByType(typeName: string): Promise<void> {
    try {
      this.showTypeList(typeName);

      const response = await fetch(`${POKEAPI_BASE_URL}/type/${typeName}`);
      const data = await response.json();
      const typePokemon = data.pokemon.map((entry: any) => entry.pokemon);

      this.elements.typePokemonList.innerHTML = '';

      typePokemon.forEach((pokemon: NamedApiResource) => {
        this.renderTypePokemonItem(pokemon);
      });
    } catch (error) {
      console.error(error);
      this.elements.typePokemonList.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: red;">Error loading type list</div>';
    }
  }

  /**
   * Shows the selected type list screen and its loading state.
   */
  private showTypeList(typeName: string): void {
    this.elements.pkmnDataContainer.style.display = 'none';
    this.elements.typeListScreen.style.display = 'flex';
    this.elements.typePokemonList.scrollTop = 0;
    this.elements.typeListTitle.innerText = `${typeName.toUpperCase()} POKEMON`;
    this.elements.typePokemonList.innerHTML = '<div style="grid-column: 1/-1; text-align: center;">Loading...</div>';
  }

  /**
   * Restores the Pokemon detail screen after type navigation.
   */
  private showPokemonDetail(): void {
    this.elements.typeListScreen.style.display = 'none';
    this.elements.pkmnDataContainer.style.display = 'block';
    this.elements.pkmnDataContainer.scrollTop = 0;
  }

  /**
   * Renders a Pokemon card inside the selected type list.
   */
  private renderTypePokemonItem(pokemon: NamedApiResource): void {
    const urlParts = pokemon.url.split('/');
    const apiId = Number.parseInt(urlParts[urlParts.length - 2], 10);
    const listReference = this.allPokemon.find((entry) => entry.name === pokemon.name);
    const displayId = listReference ? listReference.displayId : apiId;
    const item = document.createElement('div');

    item.className = 'type-pkmn-item';
    item.innerHTML = `
      <img src="${SPRITE_BASE_URL}/pokemon/${apiId}.png" alt="${pokemon.name}" onerror="this.src='${FALLBACK_SPRITE_URL}'; this.style.opacity='0.5';">
      <span>${pokemon.name.replace('-', ' ')}</span>
    `;
    item.addEventListener('click', () => {
      void this.loadPokemon(apiId, displayId);
      this.showPokemonDetail();
    });

    this.elements.typePokemonList.appendChild(item);
  }
}

/**
 * Starts the renderer once the DOM is ready.
 */
function bootstrap(): void {
  void new PokedexApp().initialize();
}

document.addEventListener('DOMContentLoaded', bootstrap);

export {};
