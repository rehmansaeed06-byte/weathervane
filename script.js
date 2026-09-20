/*
 * script.js - connects the page to the weather logic in weather.js.
 * Data comes from Open-Meteo (free, no API key needed).
 */
(function () {
  'use strict';

  const W = window.WeatherLogic;

  const DEFAULT_CITY = 'Islamabad';
  const PREF_UNIT = 'weathervane.unit';
  const PREF_PLACE = 'weathervane.place';
  const LOAD_ERROR = "Couldn't load the weather. Check your connection and try again.";

  const form = document.getElementById('search-form');
  const input = document.getElementById('city-input');
  const statusEl = document.getElementById('status');
  const matchesEl = document.getElementById('matches');
  const matchesList = document.getElementById('matches-list');
  const emptyEl = document.getElementById('empty');
  const currentEl = document.getElementById('current');
  const placeEl = document.getElementById('place');
  const placeDetailEl = document.getElementById('place-detail');
  const tempEl = document.getElementById('temp');
  const conditionEl = document.getElementById('condition');
  const feelsEl = document.getElementById('feels');
  const humidityEl = document.getElementById('humidity');
  const windEl = document.getElementById('wind');
  const forecastEl = document.getElementById('forecast');
  const forecastList = document.getElementById('forecast-list');
  const themeColorMeta = document.getElementById('theme-color');
  const unitButtons = {
    c: document.getElementById('unit-c'),
    f: document.getElementById('unit-f'),
  };

  const state = { unit: 'c', place: null, weather: null };

  // Each search or load gets a number. If a newer one starts, older replies
  // are ignored so a slow response can't overwrite a newer city.
  let latestRequest = 0;

  // ---- Saved preferences (unit and last city) ---------------------------

  function readPref(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null; // storage blocked, carry on without saving
    }
  }

  function writePref(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      // storage blocked, ignore
    }
  }

  function readSavedPlace() {
    const raw = readPref(PREF_PLACE);
    if (!raw) return null;
    try {
      const place = JSON.parse(raw);
      if (place && place.name && typeof place.lat === 'number' && typeof place.lon === 'number') {
        return place;
      }
    } catch (error) {
      // fall through to null
    }
    return null;
  }

  // ---- Small helpers ------------------------------------------------------

  function setStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.dataset.error = isError ? 'true' : 'false';
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Request failed with status ' + response.status);
    return response.json();
  }

  function makeSpan(className, text) {
    const span = document.createElement('span');
    span.className = className;
    if (text !== undefined) span.textContent = text;
    return span;
  }

  // Text is always set with textContent (never innerHTML), so place names
  // from the API can't inject markup into the page.
  function makeTempSpan(className, hiddenLabel, text) {
    const span = makeSpan(className);
    const hidden = makeSpan('visually-hidden', hiddenLabel + ' ');
    span.append(hidden, document.createTextNode(text));
    return span;
  }

  // ---- Rendering ----------------------------------------------------------

  function buildDayRow(day, index, weekMin, weekMax) {
    const item = document.createElement('li');
    item.className = 'day';

    const range = makeSpan('range');
    const bar = makeSpan('bar');
    bar.setAttribute('aria-hidden', 'true');
    const fill = makeSpan('bar-fill');
    const position = W.rangeBar(day.minC, day.maxC, weekMin, weekMax);
    fill.style.left = position.left + '%';
    fill.style.width = position.width + '%';
    bar.appendChild(fill);
    range.append(
      makeTempSpan('range-min', 'Low', W.formatTemp(day.minC, state.unit)),
      bar,
      makeTempSpan('range-max', 'High', W.formatTemp(day.maxC, state.unit))
    );

    item.append(
      makeSpan('day-name', W.weekdayLabel(day.date, index)),
      makeSpan('day-condition', W.describeWeather(day.code, true).label),
      range,
      makeSpan('precip', W.formatPrecip(day.precipChance, day.code))
    );
    return item;
  }

  function render() {
    if (!state.weather || !state.place) return;
    const current = state.weather.current;
    const days = state.weather.days;
    const info = W.describeWeather(current.code, current.isDay);

    document.body.dataset.theme = info.theme;
    themeColorMeta.setAttribute(
      'content',
      getComputedStyle(document.body).getPropertyValue('--bg').trim()
    );

    placeEl.textContent = state.place.name;
    placeDetailEl.textContent = W.placeDetail(state.place);
    tempEl.textContent = W.formatTemp(current.tempC, state.unit);
    conditionEl.textContent = info.label;
    feelsEl.textContent = W.formatTemp(current.feelsC, state.unit);
    humidityEl.textContent = typeof current.humidity === 'number' ? current.humidity + '%' : '\u2014';
    windEl.textContent = W.formatWind(current.windKmh, state.unit);

    const weekMin = Math.min.apply(null, days.map((d) => d.minC));
    const weekMax = Math.max.apply(null, days.map((d) => d.maxC));
    forecastList.replaceChildren.apply(
      forecastList,
      days.map((day, index) => buildDayRow(day, index, weekMin, weekMax))
    );

    emptyEl.hidden = true;
    currentEl.hidden = false;
    forecastEl.hidden = false;
  }

  function showMatches(places, active) {
    const others = places.filter((place) => place !== active).slice(0, 4);
    matchesList.replaceChildren();
    for (const place of others) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = W.matchLabel(place);
      button.addEventListener('click', function () {
        showMatches(places, place);
        loadPlace(place);
      });
      item.appendChild(button);
      matchesList.appendChild(item);
    }
    matchesEl.hidden = others.length === 0;
  }

  // ---- Loading data -------------------------------------------------------

  async function loadPlace(place, existingRequestId) {
    const requestId = existingRequestId || ++latestRequest;
    setStatus('Loading weather for ' + place.name + '\u2026', false);
    try {
      const data = await fetchJson(W.buildForecastUrl(place.lat, place.lon));
      const weather = W.parseForecast(data);
      if (requestId !== latestRequest) return;
      state.place = place;
      state.weather = weather;
      writePref(PREF_PLACE, JSON.stringify(place));
      setStatus('', false);
      render();
    } catch (error) {
      if (requestId === latestRequest) setStatus(LOAD_ERROR, true);
    }
  }

  async function searchCity(rawQuery) {
    const query = W.cleanQuery(rawQuery);
    if (!query) {
      setStatus('Enter a city name to search.', true);
      return;
    }
    const requestId = ++latestRequest;
    setStatus('Looking for ' + query + '\u2026', false);
    try {
      const places = W.parseGeocode(await fetchJson(W.buildGeocodeUrl(query)));
      if (requestId !== latestRequest) return;
      if (places.length === 0) {
        matchesEl.hidden = true;
        setStatus('No city found for "' + query + '". Check the spelling or try a nearby city.', true);
        return;
      }
      showMatches(places, places[0]);
      await loadPlace(places[0], requestId);
    } catch (error) {
      if (requestId === latestRequest) setStatus(LOAD_ERROR, true);
    }
  }

  // ---- Units --------------------------------------------------------------

  function setUnit(unit) {
    state.unit = unit;
    writePref(PREF_UNIT, unit);
    for (const key of Object.keys(unitButtons)) {
      unitButtons[key].setAttribute('aria-pressed', String(key === unit));
    }
    render();
  }

  // ---- Start up -----------------------------------------------------------

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    searchCity(input.value);
  });

  unitButtons.c.addEventListener('click', function () { setUnit('c'); });
  unitButtons.f.addEventListener('click', function () { setUnit('f'); });

  if (readPref(PREF_UNIT) === 'f') setUnit('f');

  const savedPlace = readSavedPlace();
  if (savedPlace) {
    loadPlace(savedPlace);
  } else {
    searchCity(DEFAULT_CITY);
  }
})();
