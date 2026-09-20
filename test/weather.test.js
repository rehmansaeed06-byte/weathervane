
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../weather.js');

// ---- Temperature ------------------------------------------------------

test('0 degrees Celsius is 32 degrees Fahrenheit', () => {
  assert.equal(W.toFahrenheit(0), 32);
});

test('100 degrees Celsius is 212 degrees Fahrenheit', () => {
  assert.equal(W.toFahrenheit(100), 212);
});

test('formatTemp rounds 24.4 down to 24', () => {
  assert.equal(W.formatTemp(24.4, 'c'), '24\u00b0');
});

test('formatTemp rounds 24.6 up to 25', () => {
  assert.equal(W.formatTemp(24.6, 'c'), '25\u00b0');
});

test('formatTemp shows Fahrenheit when the unit is f', () => {
  assert.equal(W.formatTemp(0, 'f'), '32\u00b0');
});

test('formatTemp shows a dash when there is no value', () => {
  assert.equal(W.formatTemp(undefined, 'c'), '\u2014');
});

// ---- Wind and rain ----------------------------------------------------

test('formatWind shows km/h for Celsius', () => {
  assert.equal(W.formatWind(12.4, 'c'), '12 km/h');
});

test('formatWind shows mph for Fahrenheit', () => {
  assert.equal(W.formatWind(16.09, 'f'), '10 mph');
});

test('formatPrecip says rain for a rainy day', () => {
  assert.equal(W.formatPrecip(60, 61), '60% rain');
});

test('formatPrecip says snow for a snowy day', () => {
  assert.equal(W.formatPrecip(70, 73), '70% snow');
});

// ---- Weather conditions -----------------------------------------------

test('code 0 means clear sky', () => {
  assert.equal(W.describeWeather(0, true).label, 'Clear sky');
});

test('clear sky in the daytime uses the sun theme', () => {
  assert.equal(W.describeWeather(0, true).theme, 'sun');
});

test('clear sky at night uses the night theme', () => {
  assert.equal(W.describeWeather(0, false).theme, 'night');
});

test('code 63 uses the rain theme', () => {
  assert.equal(W.describeWeather(63, true).theme, 'rain');
});

test('an unknown code says Unknown conditions', () => {
  assert.equal(W.describeWeather(999, true).label, 'Unknown conditions');
});

// ---- Search -----------------------------------------------------------

test('cleanQuery removes extra spaces', () => {
  assert.equal(W.cleanQuery('  new   york '), 'new york');
});

test('buildGeocodeUrl includes the city name', () => {
  assert.ok(W.buildGeocodeUrl('Wah').includes('name=Wah'));
});

test('buildForecastUrl includes the latitude and longitude', () => {
  const url = W.buildForecastUrl(33.7, 73.05);
  assert.ok(url.includes('latitude=33.7'));
  assert.ok(url.includes('longitude=73.05'));
});

test('placeDetail joins the region and country', () => {
  const place = { name: 'Wah', region: 'Punjab', country: 'Pakistan' };
  assert.equal(W.placeDetail(place), 'Punjab, Pakistan');
});

// ---- Forecast ---------------------------------------------------------

function sampleForecast() {
  return {
    current: {
      temperature_2m: 24.4,
      relative_humidity_2m: 48,
      apparent_temperature: 26.1,
      is_day: 1,
      weather_code: 2,
      wind_speed_10m: 12.3,
    },
    daily: {
      time: ['2026-09-20', '2026-09-21', '2026-09-22'],
      weather_code: [2, 61, 95],
      temperature_2m_max: [31, 30, 28],
      temperature_2m_min: [22, 21, 20],
      precipitation_probability_max: [10, 60, 90],
    },
  };
}

test('parseForecast reads the current temperature', () => {
  const result = W.parseForecast(sampleForecast());
  assert.equal(result.current.tempC, 24.4);
});

test('parseForecast returns one entry for each day', () => {
  const result = W.parseForecast(sampleForecast());
  assert.equal(result.days.length, 3);
});

test('parseForecast throws an error when the data is empty', () => {
  assert.throws(() => W.parseForecast({}));
});

test('the first forecast day is called Today', () => {
  assert.equal(W.weekdayLabel('2026-09-20', 0), 'Today');
});

test('2026-09-21 is a Monday', () => {
  assert.equal(W.weekdayLabel('2026-09-21', 1), 'Mon');
});

test('rangeBar starts at 0 percent and is 50 percent wide', () => {
  // The week goes from 10 to 30. This day goes from 10 to 20.
  const bar = W.rangeBar(10, 20, 10, 30);
  assert.equal(bar.left, 0);
  assert.equal(bar.width, 50);
});
