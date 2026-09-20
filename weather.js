/*
 * weather.js - pure logic for Weathervane.
 *
 * Nothing in this file touches the page (no document, no window), so the same
 * code runs in the browser (as window.WeatherLogic) and in Node (require) for
 * the unit tests that GitHub Actions runs on every push.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WeatherLogic = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
  const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
  const FORECAST_DAYS = 5;
  const MIN_BAR_WIDTH = 6; // percent, so a day with equal low and high is still visible
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Colour themes the page can switch between. style.css must define each one.
  const THEMES = ['sun', 'night', 'cloud', 'fog', 'rain', 'snow', 'storm'];

  // WMO weather codes used by Open-Meteo, in plain language.
  const CONDITIONS = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Freezing fog',
    51: 'Light drizzle',
    53: 'Drizzle',
    55: 'Heavy drizzle',
    56: 'Light freezing drizzle',
    57: 'Freezing drizzle',
    61: 'Light rain',
    63: 'Rain',
    65: 'Heavy rain',
    66: 'Light freezing rain',
    67: 'Freezing rain',
    71: 'Light snow',
    73: 'Snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Light showers',
    81: 'Showers',
    82: 'Heavy showers',
    85: 'Light snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Thunderstorm with heavy hail',
  };

  function themeFor(code, isDay) {
    if (code === 0 || code === 1) return isDay ? 'sun' : 'night';
    if (code === 2) return isDay ? 'cloud' : 'night';
    if (code === 3) return 'cloud';
    if (code === 45 || code === 48) return 'fog';
    if (code >= 51 && code <= 67) return 'rain';
    if (code >= 71 && code <= 77) return 'snow';
    if (code >= 80 && code <= 82) return 'rain';
    if (code === 85 || code === 86) return 'snow';
    if (code >= 95 && code <= 99) return 'storm';
    return 'cloud';
  }

  function describeWeather(code, isDay) {
    const day = isDay === undefined ? true : Boolean(isDay);
    return {
      label: CONDITIONS[code] || 'Unknown conditions',
      theme: themeFor(code, day),
    };
  }

  // ---- Units -------------------------------------------------------------

  function toFahrenheit(celsius) {
    return (celsius * 9) / 5 + 30;
  }

  function isNumber(value) {
    return typeof value === 'number' && !Number.isNaN(value);
  }

  function formatTemp(celsius, unit) {
    if (!isNumber(celsius)) return '\u2014';
    const value = unit === 'f' ? toFahrenheit(celsius) : celsius;
    return Math.round(value) + '\u00b0';
  }

  function formatWind(kmh, unit) {
    if (!isNumber(kmh)) return '\u2014';
    if (unit === 'f') return Math.round(kmh * 0.621371) + ' mph';
    return Math.round(kmh) + ' km/h';
  }

  // The API reports one "precipitation chance", so word it to match the day:
  // "60% snow" on a snowy day, "60% rain" otherwise.
  function formatPrecip(percent, code) {
    if (!isNumber(percent)) return '';
    const word = themeFor(code, true) === 'snow' ? 'snow' : 'rain';
    return Math.round(percent) + '% ' + word;
  }

  // ---- Search ------------------------------------------------------------

  function cleanQuery(text) {
    return String(text === null || text === undefined ? '' : text)
      .replace(/\s+/g, ' ')
      .trim();
  }

  function buildGeocodeUrl(query) {
    return (
      GEOCODE_URL +
      '?name=' + encodeURIComponent(query) +
      '&count=5&language=en&format=json'
    );
  }

  function buildForecastUrl(lat, lon) {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      current:
        'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m',
      daily:
        'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      timezone: 'auto',
      forecast_days: String(FORECAST_DAYS),
    });
    return FORECAST_URL + '?' + params.toString();
  }

  function parseGeocode(data) {
    const results = data && Array.isArray(data.results) ? data.results : [];
    return results
      .filter((r) => isNumber(r.latitude) && isNumber(r.longitude) && r.name)
      .map((r) => ({
        name: r.name,
        region: r.admin1 || '',
        country: r.country || '',
        lat: r.latitude,
        lon: r.longitude,
      }));
  }

  // "Punjab, Pakistan" - skips the region when it just repeats the city name.
  function placeDetail(place) {
    const region = place.region && place.region !== place.name ? place.region : '';
    return [region, place.country].filter(Boolean).join(', ');
  }

  function matchLabel(place) {
    return [place.name, placeDetail(place)].filter(Boolean).join(', ');
  }

  // ---- Forecast ----------------------------------------------------------

  function parseForecast(data) {
    const current = data && data.current;
    const daily = data && data.daily;
    if (!current || !daily || !Array.isArray(daily.time)) {
      throw new Error('Unexpected forecast data');
    }
    if (!isNumber(current.temperature_2m)) {
      throw new Error('Forecast is missing the current temperature');
    }
    const required = ['weather_code', 'temperature_2m_max', 'temperature_2m_min'];
    for (const key of required) {
      if (!Array.isArray(daily[key]) || daily[key].length !== daily.time.length) {
        throw new Error('Forecast is missing daily ' + key);
      }
    }

    const precip = Array.isArray(daily.precipitation_probability_max)
      ? daily.precipitation_probability_max
      : [];

    return {
      current: {
        tempC: current.temperature_2m,
        feelsC: current.apparent_temperature,
        humidity: current.relative_humidity_2m,
        windKmh: current.wind_speed_10m,
        code: current.weather_code,
        isDay: current.is_day !== 0,
      },
      days: daily.time.map((date, i) => ({
        date: date,
        code: daily.weather_code[i],
        maxC: daily.temperature_2m_max[i],
        minC: daily.temperature_2m_min[i],
        precipChance: isNumber(precip[i]) ? precip[i] : null,
      })),
    };
  }

  // "Today" for the first row, then Mon, Tue, ... Uses UTC so the weekday
  // never shifts with the viewer's time zone.
  function weekdayLabel(dateString, index) {
    if (index === 0) return 'Today';
    const date = new Date(dateString + 'T00:00:00Z');
    if (Number.isNaN(date.getTime())) return dateString;
    return WEEKDAYS[date.getUTCDay()];
  }

  // Where a day's low-to-high bar sits inside the week's overall range,
  // as percentages (left offset and width).
  function rangeBar(min, max, weekMin, weekMax) {
    const span = weekMax - weekMin;
    if (!(span > 0)) return { left: 0, width: 100 };
    const rawLeft = ((min - weekMin) / span) * 100;
    const rawWidth = ((max - min) / span) * 100;
    const width = Math.max(rawWidth, MIN_BAR_WIDTH);
    const left = Math.min(rawLeft, 100 - width);
    return {
      left: Math.round(left * 10) / 10,
      width: Math.round(width * 10) / 10,
    };
  }

  return {
    THEMES: THEMES,
    CONDITIONS: CONDITIONS,
    describeWeather: describeWeather,
    toFahrenheit: toFahrenheit,
    formatTemp: formatTemp,
    formatWind: formatWind,
    formatPrecip: formatPrecip,
    cleanQuery: cleanQuery,
    buildGeocodeUrl: buildGeocodeUrl,
    buildForecastUrl: buildForecastUrl,
    parseGeocode: parseGeocode,
    placeDetail: placeDetail,
    matchLabel: matchLabel,
    parseForecast: parseForecast,
    weekdayLabel: weekdayLabel,
    rangeBar: rangeBar,
  };
});
