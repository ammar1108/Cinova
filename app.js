/* ── Cinovia App ── */
const TMDB = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p/';
const VIDKING = 'https://www.vidking.net/embed';
const TMDB_API_KEY = '150897a35397faf81cf06c76955569a5';

// ── State ──
let state = {
  currentView: 'home',
  browsePage: 1,
  browseType: 'movie',
  browseGenre: '',
  browseResults: [],
};

// ── Helpers ──
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const tmdb = async (path, params = {}) => {
  params.api_key = TMDB_API_KEY;
  const q = new URLSearchParams(params).toString();
  const r = await fetch(`${TMDB}${path}?${q}`);
  return r.json();
};
const posterURL = (p, size = 'w342') => p ? `${IMG}${size}${p}` : '';
const backdropURL = (b) => b ? `${IMG}original${b}` : '';

// ── Navigation ──
function showView(name) {
  $$('.view').forEach(v => v.classList.remove('active'));
  $(`#view-${name}`).classList.add('active');
  $$('.nav-link').forEach(l => l.classList.remove('active'));
  const link = $(`[data-nav="${name}"]`);
  if (link) link.classList.add('active');
  state.currentView = name;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$$('.nav-link').forEach(l => l.addEventListener('click', e => {
  e.preventDefault();
  const nav = l.dataset.nav;
  if (nav === 'home') { showView('home'); loadHome(); }
  else if (nav === 'movies') { startBrowse('movie'); }
  else if (nav === 'tv') { startBrowse('tv'); }
}));

$('#logo-link').addEventListener('click', e => { e.preventDefault(); showView('home'); loadHome(); });

// Navbar scroll
window.addEventListener('scroll', () => {
  $('#navbar').classList.toggle('scrolled', window.scrollY > 30);
});

// Mobile menu
$('#mobile-menu-btn').addEventListener('click', () => {
  $('#nav-links').classList.toggle('open');
});

// ── Card HTML ──
function cardHTML(item, type) {
  const title = item.title || item.name;
  const year = (item.release_date || item.first_air_date || '').slice(0, 4);
  const rating = item.vote_average ? item.vote_average.toFixed(1) : '—';
  const poster = posterURL(item.poster_path, 'w342');
  const mediaType = type || item.media_type || 'movie';
  const label = mediaType === 'tv' ? 'TV' : 'MOVIE';
  return `
    <div class="card" data-id="${item.id}" data-type="${mediaType}">
      <div class="card-poster">
        ${poster ? `<img src="${poster}" alt="${title}" loading="lazy"/>` : `<div class="skeleton skeleton-card"></div>`}
        <span class="card-rating">★ ${rating}</span>
        <span class="card-type">${label}</span>
      </div>
      <div class="card-title" title="${title}">${title}</div>
      <div class="card-year">${year}</div>
    </div>`;
}

function renderRow(container, title, items, type) {
  container.innerHTML = `
    <div class="row-header"><h2 class="section-title">${title}</h2></div>
    <div class="row-scroll">${items.map(i => cardHTML(i, type)).join('')}</div>`;
  attachCardClicks(container);
}

function attachCardClicks(scope) {
  scope.querySelectorAll('.card').forEach(c => c.addEventListener('click', () => {
    loadDetail(c.dataset.id, c.dataset.type);
  }));
}

// ── Home ──
async function loadHome() {
  const [trending, tvPop, topRated] = await Promise.all([
    tmdb('/trending/movie/week'),
    tmdb('/trending/tv/week'),
    tmdb('/movie/top_rated'),
  ]);

  // Hero
  const hero = trending.results[0];
  if (hero) {
    $('#hero-bg').style.backgroundImage = `url(${backdropURL(hero.backdrop_path)})`;
    $('#hero-content').innerHTML = `
      <div class="hero-meta">
        <span class="rating">★ ${hero.vote_average.toFixed(1)}</span>
        <span>${(hero.release_date || '').slice(0, 4)}</span>
        <span>Trending #1 This Week</span>
      </div>
      <h1>${hero.title || hero.name}</h1>
      <p>${hero.overview}</p>
      <div class="hero-btns">
        <button class="btn-glow" onclick="loadDetail(${hero.id},'movie')">▶ Watch Now</button>
        <button class="btn-outline" onclick="loadDetail(${hero.id},'movie')">More Info</button>
      </div>`;
  }

  renderRow($('#trending-movies-row'), '🔥 Trending Movies', trending.results.slice(1, 16), 'movie');
  renderRow($('#trending-tv-row'), '📺 Trending TV Shows', tvPop.results.slice(0, 15), 'tv');
  renderRow($('#top-rated-row'), '⭐ Top Rated', topRated.results.slice(0, 15), 'movie');
}

// ── Browse ──
async function startBrowse(type) {
  state.browseType = type;
  state.browsePage = 1;
  state.browseGenre = '';
  state.browseResults = [];
  showView('browse');
  $('#browse-title').textContent = type === 'movie' ? 'Movies' : 'TV Shows';
  await loadGenreChips(type);
  await loadBrowsePage();
}

async function loadGenreChips(type) {
  const data = await tmdb(`/genre/${type}/list`);
  const chips = data.genres.map(g =>
    `<button class="chip" data-gid="${g.id}">${g.name}</button>`
  ).join('');
  $('#genre-chips').innerHTML = `<button class="chip active" data-gid="">All</button>` + chips;
  $$('#genre-chips .chip').forEach(c => c.addEventListener('click', () => {
    $$('#genre-chips .chip').forEach(x => x.classList.remove('active'));
    c.classList.add('active');
    state.browseGenre = c.dataset.gid;
    state.browsePage = 1;
    state.browseResults = [];
    loadBrowsePage();
  }));
}

async function loadBrowsePage() {
  const params = { page: state.browsePage, sort_by: 'popularity.desc' };
  if (state.browseGenre) params.with_genres = state.browseGenre;
  const data = await tmdb(`/discover/${state.browseType}`, params);
  state.browseResults = state.browsePage === 1 ? data.results : [...state.browseResults, ...data.results];
  const grid = $('#browse-grid');
  grid.innerHTML = state.browseResults.map(i => cardHTML(i, state.browseType)).join('');
  attachCardClicks(grid);
  const btn = $('#load-more-btn');
  if (state.browsePage < data.total_pages) {
    btn.classList.remove('hidden');
  } else {
    btn.classList.add('hidden');
  }
}

$('#load-more-btn').addEventListener('click', () => {
  state.browsePage++;
  loadBrowsePage();
});

// ── Search ──
let searchTimer;
$('#search-input').addEventListener('input', e => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (q.length < 2) { $('#search-dropdown').classList.add('hidden'); return; }
  searchTimer = setTimeout(() => liveSearch(q), 350);
});

$('#search-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const q = $('#search-input').value.trim();
    if (q.length >= 2) fullSearch(q);
  }
});

async function liveSearch(q) {
  const data = await tmdb('/search/multi', { query: q });
  const items = data.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv').slice(0, 7);
  const dd = $('#search-dropdown');
  if (!items.length) {
    dd.innerHTML = `<div class="dd-empty">No results for "${q}"</div>`;
    dd.classList.remove('hidden');
    return;
  }
  dd.innerHTML = items.map(i => {
    const title = i.title || i.name;
    const year = (i.release_date || i.first_air_date || '').slice(0, 4);
    const poster = posterURL(i.poster_path, 'w92');
    return `<div class="dd-item" data-id="${i.id}" data-type="${i.media_type}">
      ${poster ? `<img src="${poster}" alt=""/>` : `<div style="width:42px;height:62px;background:var(--card);border-radius:6px"></div>`}
      <div class="dd-info"><div class="dd-title">${title}</div><div class="dd-year">${year} · ${i.media_type === 'tv' ? 'TV Show' : 'Movie'}</div></div>
    </div>`;
  }).join('');
  dd.classList.remove('hidden');
  dd.querySelectorAll('.dd-item').forEach(d => d.addEventListener('click', () => {
    loadDetail(d.dataset.id, d.dataset.type);
    dd.classList.add('hidden');
    $('#search-input').value = '';
  }));
}

async function fullSearch(q) {
  $('#search-dropdown').classList.add('hidden');
  showView('search');
  const data = await tmdb('/search/multi', { query: q });
  const items = data.results.filter(r => r.media_type === 'movie' || r.media_type === 'tv');
  $('#search-results-title').textContent = `Results for "${q}"`;
  const grid = $('#search-grid');
  grid.innerHTML = items.map(i => cardHTML(i, i.media_type)).join('');
  attachCardClicks(grid);
}

// Close dropdown on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.search-box')) $('#search-dropdown').classList.add('hidden');
});

// ── Detail / Watch ──
async function loadDetail(id, type = 'movie') {
  showView('detail');
  const [info, similar] = await Promise.all([
    tmdb(`/${type}/${id}`, { append_to_response: 'credits' }),
    tmdb(`/${type}/${id}/similar`),
  ]);

  const title = info.title || info.name;
  const year = (info.release_date || info.first_air_date || '').slice(0, 4);
  const rating = info.vote_average ? info.vote_average.toFixed(1) : '—';
  const runtime = info.runtime ? `${info.runtime} min` : (info.episode_run_time?.[0] ? `${info.episode_run_time[0]} min/ep` : '');
  const genres = (info.genres || []).map(g => `<span>${g.name}</span>`).join('');
  const poster = posterURL(info.poster_path, 'w500');
  const backdrop = backdropURL(info.backdrop_path);

  if (backdrop) {
    $('#detail-backdrop').style.backgroundImage = `url(${backdrop})`;
  }

  let seasonHTML = '';
  let defaultSeason = 1;
  let defaultEpisode = 1;

  if (type === 'tv' && info.seasons) {
    const seasons = info.seasons.filter(s => s.season_number > 0);
    const seasonTabs = seasons.map(s =>
      `<button class="season-tab${s.season_number === 1 ? ' active' : ''}" data-sn="${s.season_number}">S${s.season_number}</button>`
    ).join('');
    seasonHTML = `
      <div class="season-selector">
        <h3 class="section-title" style="margin-bottom:12px">Seasons & Episodes</h3>
        <div class="season-tabs">${seasonTabs}</div>
        <div class="episode-grid" id="episode-grid"></div>
      </div>`;
  }

  const embedSrc = type === 'movie'
    ? `${VIDKING}/movie/${id}`
    : `${VIDKING}/tv/${id}/1/1`;

  const content = `
    <div class="detail-top">
      <div class="detail-poster">${poster ? `<img src="${poster}" alt="${title}"/>` : ''}</div>
      <div class="detail-info">
        <h1>${title}</h1>
        <div class="meta-row">
          <span class="rating">★ ${rating}</span>
          <span>${year}</span>
          ${runtime ? `<span>${runtime}</span>` : ''}
          ${info.status ? `<span>${info.status}</span>` : ''}
        </div>
        <div class="detail-genres">${genres}</div>
        <p class="overview">${info.overview || ''}</p>
        <div class="detail-actions">
          <button class="btn-glow" id="play-btn">▶ Watch Now</button>
        </div>
      </div>
    </div>
    <div class="player-wrap" id="player-wrap" style="display:none">
      <iframe id="player-iframe" src="" allowfullscreen allow="autoplay; encrypted-media"></iframe>
    </div>
    ${seasonHTML}
    <div class="similar-section">
      <h3 class="section-title" style="margin-bottom:16px">You May Also Like</h3>
      <div class="row-scroll">${(similar.results || []).slice(0, 12).map(i => cardHTML(i, type)).join('')}</div>
    </div>`;

  $('#detail-content').innerHTML = content;
  attachCardClicks($('#detail-content'));

  // Play button
  $('#play-btn').addEventListener('click', () => {
    const pw = $('#player-wrap');
    pw.style.display = 'block';
    $('#player-iframe').src = embedSrc;
    pw.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // TV season/episode logic
  if (type === 'tv' && info.seasons) {
    loadEpisodes(id, defaultSeason);
    $$('.season-tab').forEach(tab => tab.addEventListener('click', () => {
      $$('.season-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadEpisodes(id, parseInt(tab.dataset.sn));
    }));
  }
}

async function loadEpisodes(showId, seasonNum) {
  const data = await tmdb(`/tv/${showId}/season/${seasonNum}`);
  const grid = $('#episode-grid');
  if (!grid) return;
  const eps = data.episodes || [];
  grid.innerHTML = eps.map(ep => `
    <button class="ep-btn" data-ep="${ep.episode_number}" data-sn="${seasonNum}">
      Ep ${ep.episode_number}
      <div style="font-size:.72rem;color:var(--text-dim);margin-top:4px">${ep.name || ''}</div>
    </button>
  `).join('');
  grid.querySelectorAll('.ep-btn').forEach(btn => btn.addEventListener('click', () => {
    grid.querySelectorAll('.ep-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const sn = btn.dataset.sn;
    const ep = btn.dataset.ep;
    const pw = $('#player-wrap');
    pw.style.display = 'block';
    $('#player-iframe').src = `${VIDKING}/tv/${showId}/${sn}/${ep}`;
    pw.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}

// Make loadDetail available globally for hero buttons
window.loadDetail = loadDetail;

// ── Init ──
loadHome();
