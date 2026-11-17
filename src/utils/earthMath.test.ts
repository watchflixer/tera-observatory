import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cameraDistanceToZoomAndAltitudeKm,
  classifyOceanOrRegion,
  computeCutawayAngles,
  computeSolarTerminatorPolygon,
  estimateAtmospherePressurePa,
  formatGeologicalTime,
  getExplodedOffset,
  interpolateAtmosphereTemp,
  latLonToTileXY,
  latLonToVector3,
  latToMercatorNormY,
  tileBoundsToLatLon,
  vector3ToLatLon,
} from './earthMath';
import { LIFE_HISTORY_CATALOG } from '../data/lifeHistoryData';
import { EARTH_ERA_WIKI_TOPICS, getWikiDescriptorForEntry } from '../data/wikiTopicMap';
import { filterLifeCatalog, summarizeLifeCounts } from './lifeFilter';
import { getWikiUiStrings } from './wikiI18n';
import {
  isPhotographicCommonsFile,
  parseWikipediaExtractToSections,
  selectPreferredLangTitle,
  stripHtmlTags,
} from './wikipediaParser';

test('parseWikipediaExtractToSections splits lead and headings cleanly while pruning bibliography sections', () => {
  const sample = [
    'A rose is a woody perennial flowering plant of the genus Rosa (), in the family Rosaceae ().',
    '',
    '== Etymology ==',
    'The name rose comes from Latin rosa.',
    '=== Ancient origins ===',
    'Cultivated in ancient Mesopotamia.',
    '== References ==',
    'Some book citation that should be omitted.',
    '== Bibliografía ==',
    'Spanish bibliography entry that should be omitted.',
    '== External links ==',
    'https://example.org',
  ].join('\n');

  const parsed = parseWikipediaExtractToSections(sample);
  assert.equal(parsed.leadParagraphs.length, 1);
  assert.equal(parsed.leadParagraphs[0], 'A rose is a woody perennial flowering plant of the genus Rosa, in the family Rosaceae.');
  assert.equal(parsed.sections.length, 2);
  assert.equal(parsed.sections[0].title, 'Etymology');
  assert.equal(parsed.sections[0].level, 2);
  assert.equal(parsed.sections[1].title, 'Ancient origins');
  assert.equal(parsed.sections[1].level, 3);
});

test('isPhotographicCommonsFile rejects SVGs, flags, coats of arms, and UI icons while keeping photos', () => {
  assert.equal(isPhotographicCommonsFile('File:Rosa_rubiginosa_1.jpg', 'image/jpeg'), true);
  assert.equal(isPhotographicCommonsFile('File:Bouquet de roses roses.jpg'), true);
  assert.equal(isPhotographicCommonsFile('File:Commons-logo.svg', 'image/svg+xml'), false);
  assert.equal(isPhotographicCommonsFile('File:Flag_of_the_Philippines.svg'), false);
  assert.equal(isPhotographicCommonsFile('File:Coat_of_arms_of_Saint_Lucia.svg'), false);
  assert.equal(isPhotographicCommonsFile('File:Ambox_important.png'), false);
});

test('stripHtmlTags & selectPreferredLangTitle handle Wikimedia captions and interwiki language links', () => {
  assert.equal(stripHtmlTags('<b>Rosa &amp; petals</b> in <i>garden</i>'), 'Rosa & petals in garden');

  const langlinks = [
    { lang: 'es', '*': 'Rosa' },
    { lang: 'tl', '*': 'Rosas' },
    { lang: 'ja', '*': 'バラ属' },
  ];
  assert.deepEqual(selectPreferredLangTitle(langlinks, 'tl', 'Rose'), {
    resolvedTitle: 'Rosas',
    matchedTargetLang: true,
  });
  assert.deepEqual(selectPreferredLangTitle(langlinks, 'ko', 'Rose'), {
    resolvedTitle: 'Rose',
    matchedTargetLang: false,
  });
});

test('EARTH_ERA_WIKI_TOPICS, getWikiDescriptorForEntry, and getWikiUiStrings cover all topics and languages', () => {
  assert.equal(EARTH_ERA_WIKI_TOPICS.length, 7);
  for (const entry of LIFE_HISTORY_CATALOG) {
    const desc = getWikiDescriptorForEntry(entry);
    assert.ok(desc.wikiTitle.length > 0);
    assert.ok(desc.commonsQuery.length > 0);
  }
  const tl = getWikiUiStrings('tl');
  assert.equal(tl.languagesLabel, 'Wika');
  assert.equal(tl.galleryTab, 'Mga Larawan');
});


test('latLonToVector3 places North Pole at +Y and equator points on radius', () => {
  const north = latLonToVector3(90, 0, 2);
  assert.ok(Math.abs(north.x) < 1e-6);
  assert.ok(Math.abs(north.y - 2) < 1e-6);
  assert.ok(Math.abs(north.z) < 1e-6);

  const eq = latLonToVector3(0, 45, 3);
  const mag = Math.sqrt(eq.x * eq.x + eq.y * eq.y + eq.z * eq.z);
  assert.ok(Math.abs(mag - 3) < 1e-6);
  assert.ok(Math.abs(eq.y) < 1e-6);
});

test('vector3ToLatLon round-trips geographic coordinates accurately', () => {
  const sample = latLonToVector3(27.9881, 86.925, 1); // Mount Everest
  const roundTrip = vector3ToLatLon(sample.x, sample.y, sample.z);
  assert.ok(Math.abs(roundTrip.lat - 27.9881) < 1e-4);
  assert.ok(Math.abs(roundTrip.lon - 86.925) < 1e-4);
});

test('computeCutawayAngles closes cleanly at 0 deg and opens symmetrically at 90 deg', () => {
  const closed = computeCutawayAngles(0);
  assert.equal(closed.phiLength, Math.PI * 2);
  assert.equal(closed.openingRadians, 0);

  const open90 = computeCutawayAngles(90);
  assert.ok(Math.abs(open90.openingRadians - Math.PI / 2) < 1e-6);
  assert.ok(Math.abs(open90.phiLength - 1.5 * Math.PI) < 1e-6);
  assert.ok(Math.abs(open90.faceOneAngle - open90.faceTwoAngle - Math.PI / 2) < 1e-6);
});

test('getExplodedOffset anchors layer 0 and expands outer shells monotonically', () => {
  assert.equal(getExplodedOffset(0, 1), 0);
  const o1 = getExplodedOffset(1, 0.5);
  const o2 = getExplodedOffset(2, 0.5);
  assert.ok(o1 > 0);
  assert.ok(o2 > o1);
});

test('interpolateAtmosphereTemp models troposphere cooling, stratopause peak, and mesopause cold minimum', () => {
  assert.equal(interpolateAtmosphereTemp(0), 15);
  assert.ok(interpolateAtmosphereTemp(11) < -50);
  assert.ok(interpolateAtmosphereTemp(50) > interpolateAtmosphereTemp(15));
  assert.ok(interpolateAtmosphereTemp(85) < -80);
  assert.ok(interpolateAtmosphereTemp(400) > 500);
});

test('estimateAtmospherePressurePa drops monotonically with altitude', () => {
  const p0 = estimateAtmospherePressurePa(0);
  const p10 = estimateAtmospherePressurePa(10);
  const p50 = estimateAtmospherePressurePa(50);
  assert.equal(Math.round(p0), 101325);
  assert.ok(p10 < p0);
  assert.ok(p50 < p10);
});

test('formatGeologicalTime formats Ga and Ma accurately', () => {
  assert.equal(formatGeologicalTime(4540), '4.54 Ga');
  assert.equal(formatGeologicalTime(252), '252 Ma');
  assert.equal(formatGeologicalTime(0), 'Present (0 Ma)');
});

test('computeSolarTerminatorPolygon spans -180 to 180 and encloses the dark pole', () => {
  const juneSolstice = new Date('2026-06-21T12:00:00Z');
  const poly = computeSolarTerminatorPolygon(juneSolstice);
  assert.ok(poly.length > 90);
  assert.equal(poly[0][1], -180);
  assert.deepEqual(poly[poly.length - 1], [-85, -180]);
  for (const [lat, lon] of poly) {
    assert.ok(lat >= -85 && lat <= 85);
    assert.ok(lon >= -180 && lon <= 180);
  }
});

test('latToMercatorNormY maps equator to 0.5 and poles to [0, 1] bounds', () => {
  assert.ok(Math.abs(latToMercatorNormY(0) - 0.5) < 1e-6);
  assert.ok(Math.abs(latToMercatorNormY(85.05112878) - 0) < 1e-5);
  assert.ok(Math.abs(latToMercatorNormY(-85.05112878) - 1) < 1e-5);
  assert.ok(latToMercatorNormY(45) < 0.5 && latToMercatorNormY(45) > 0);
});

test('latLonToTileXY and tileBoundsToLatLon round-trip geographic bounds accurately', () => {
  const { x, y } = latLonToTileXY(14.5995, 120.9842, 5); // Manila at z=5
  const bounds = tileBoundsToLatLon(x, x, y, y, 5);
  assert.ok(14.5995 <= bounds.latNorth && 14.5995 >= bounds.latSouth);
  assert.ok(120.9842 >= bounds.lonWest && 120.9842 <= bounds.lonEast);
});

test('cameraDistanceToZoomAndAltitudeKm increases zoom detail as camera approaches Earth', () => {
  const far = cameraDistanceToZoomAndAltitudeKm(6.5, 2.0);
  const mid = cameraDistanceToZoomAndAltitudeKm(3.8, 2.0);
  const close = cameraDistanceToZoomAndAltitudeKm(2.4, 2.0);
  assert.equal(far.leafletZoom, 3);
  assert.equal(mid.leafletZoom, 4);
  assert.equal(close.leafletZoom, 6);
  assert.ok(close.altitudeKm < mid.altitudeKm && mid.altitudeKm < far.altitudeKm);
});

test('classifyOceanOrRegion identifies Arctic, Philippine Sea, and Atlantic basins', () => {
  assert.equal(classifyOceanOrRegion(80, 0).title, 'Arctic Ocean');
  assert.equal(classifyOceanOrRegion(15, 130).title, 'Philippine Sea');
  assert.equal(classifyOceanOrRegion(25, -45).title, 'North Atlantic Ocean');
  assert.equal(classifyOceanOrRegion(27.4, -77.6).title, 'North Atlantic Ocean');
});

test('LIFE_HISTORY_CATALOG includes all required life categories and both extant and extinct species', () => {
  const counts = summarizeLifeCounts(LIFE_HISTORY_CATALOG);
  assert.ok(counts.total >= 50);
  assert.ok(counts.extant > 25);
  assert.ok(counts.extinct > 15);
  assert.ok(counts.byCategory.humans >= 8);
  assert.ok(counts.byCategory.animals >= 15);
  assert.ok(counts.byCategory.plants >= 8);
  assert.ok(counts.byCategory.fruits >= 7);
  assert.ok(counts.byCategory.vegetables >= 7);
  assert.ok(counts.byCategory.flowers >= 7);
  assert.ok(counts.byCategory.microbes >= 4);
});

test('filterLifeCatalog filters cleanly by query, category, status, and geological era', () => {
  const sapiens = filterLifeCatalog(LIFE_HISTORY_CATALOG, {
    query: 'Homo sapiens',
    category: 'humans',
    status: 'extant',
  });
  assert.equal(sapiens.length, 1);
  assert.equal(sapiens[0].id, 'homo-sapiens');

  const extinctMesozoic = filterLifeCatalog(LIFE_HISTORY_CATALOG, {
    eraId: 'mesozoic',
    status: 'extinct',
  });
  assert.ok(extinctMesozoic.some((e) => e.id === 'tyrannosaurus-rex'));
  assert.ok(extinctMesozoic.some((e) => e.id === 'archaefructus'));

  const luzon = filterLifeCatalog(LIFE_HISTORY_CATALOG, { query: 'Luzon' });
  assert.ok(luzon.some((e) => e.id === 'homo-luzonensis'));
});


