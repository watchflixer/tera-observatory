export type ObservatoryMode = 'systems' | 'interior' | 'atmosphere' | 'history';

export type LeafletBaseLayerId = 'satellite' | 'atlas' | 'topo' | 'dark';

export type InteriorLayerId =
  | 'inner-core'
  | 'outer-core'
  | 'lower-mantle'
  | 'upper-mantle'
  | 'crust';

export type AtmosphereLayerId =
  | 'troposphere'
  | 'stratosphere'
  | 'mesosphere'
  | 'thermosphere'
  | 'exosphere';

export type HistoryEraId =
  | 'hadean'
  | 'archean'
  | 'proterozoic'
  | 'paleozoic'
  | 'mesozoic'
  | 'cenozoic';

export interface CompositionItem {
  label: string;
  percentage: number;
  color: string;
}

export interface InteriorLayer {
  id: InteriorLayerId;
  order: number;
  name: string;
  subtitle: string;
  depthKm: string;
  thicknessKm: string;
  radiusRatio: number;
  temperature: string;
  pressure: string;
  density: string;
  stateOfMatter: string;
  colorHex: string;
  emissiveHex: string;
  seismicNote: string;
  summary: string;
  facts: string[];
  composition: CompositionItem[];
}

export interface AtmosphereLayer {
  id: AtmosphereLayerId;
  order: number;
  name: string;
  subtitle: string;
  altitudeKm: string;
  minKm: number;
  maxKm: number;
  radiusRatio: number;
  temperatureRange: string;
  pressureFraction: string;
  colorHex: string;
  summary: string;
  phenomena: string[];
  keyBenchmarks: { label: string; altitude: string }[];
}

export interface HistoryEra {
  id: HistoryEraId;
  name: string;
  eonOrEra: string;
  timeRange: string;
  startMa: number;
  endMa: number;
  oxygenPercent: number;
  meanTempC: number;
  dayLengthHours: number;
  accentColor: string;
  atmosphereTint: string;
  headline: string;
  summary: string;
  geologyHighlights: string[];
  biologyHighlights: string[];
}

export interface EarthLandmark {
  id: string;
  name: string;
  category: 'Tectonic' | 'Oceanic' | 'Atmospheric' | 'Impact' | 'Orbital';
  lat: number;
  lon: number;
  elevationOrDepth: string;
  summary: string;
  metricLabel: string;
  metricValue: string;
}

export interface PlanetaryMetric {
  label: string;
  value: string;
  unit: string;
  note: string;
}

export const INTERIOR_LAYERS: InteriorLayer[] = [
  {
    id: 'inner-core',
    order: 0,
    name: 'Inner Core',
    subtitle: 'Solid Crystalline Iron–Nickel Sphere',
    depthKm: '5,150 – 6,371 km',
    thicknessKm: '1,221 km radius',
    radiusRatio: 0.22,
    temperature: '5,400 – 5,700 °C',
    pressure: '330 – 360 GPa',
    density: '12.8 – 13.1 g/cm³',
    stateOfMatter: 'Solid hexagonal close-packed crystal',
    colorHex: '#fff3c4',
    emissiveHex: '#f59e0b',
    seismicNote: 'Both P-waves and S-waves propagate; P-waves travel up to 11.2 km/s.',
    summary:
      'At the center of Earth sits a solid metallic sphere nearly as hot as the surface of the Sun. Immense overburden pressure forces molten iron atoms into a rigid crystalline lattice, growing roughly 0.5 mm per year as Earth cools.',
    facts: [
      'Rotates slightly faster or oscillates relative to the mantle due to electromagnetic torque.',
      'Releases latent heat of crystallization that powers thermal convection in the outer core above.',
      'Accounts for ~1.7% of Earth’s total mass despite occupying less than 1% of its volume.',
    ],
    composition: [
      { label: 'Iron (Fe)', percentage: 85, color: '#f59e0b' },
      { label: 'Nickel (Ni)', percentage: 10, color: '#fbbf24' },
      { label: 'Light Elements (Si, S, O)', percentage: 5, color: '#fde68a' },
    ],
  },
  {
    id: 'outer-core',
    order: 1,
    name: 'Outer Core',
    subtitle: 'Convecting Liquid Metal Geodynamo',
    depthKm: '2,890 – 5,150 km',
    thicknessKm: '2,260 km',
    radiusRatio: 0.54,
    temperature: '4,000 – 5,400 °C',
    pressure: '135 – 330 GPa',
    density: '9.9 – 12.2 g/cm³',
    stateOfMatter: 'Low-viscosity liquid metal',
    colorHex: '#ea580c',
    emissiveHex: '#dc2626',
    seismicNote: 'S-waves cannot pass through this liquid shell, creating the S-wave shadow zone.',
    summary:
      'A turbulent ocean of swirling liquid iron and nickel. Driven by buoyancy and Earth’s Coriolis rotation, these helical electric currents generate Earth’s protective geomagnetic field.',
    facts: [
      'Viscosity is comparable to liquid water on Earth’s surface, flowing meters per hour.',
      'Powers the magnetosphere, deflecting lethal solar wind and cosmic radiation.',
      'Geomagnetic poles drift continuously and flip polarity irregularly every ~200,000–300,000 years.',
    ],
    composition: [
      { label: 'Liquid Iron (Fe)', percentage: 82, color: '#ea580c' },
      { label: 'Nickel (Ni)', percentage: 10, color: '#f97316' },
      { label: 'Sulfur, Oxygen & Silicon', percentage: 8, color: '#fdba74' },
    ],
  },
  {
    id: 'lower-mantle',
    order: 2,
    name: 'Lower Mantle',
    subtitle: 'High-Pressure Bridgmanite Silicate',
    depthKm: '660 – 2,890 km',
    thicknessKm: '2,230 km',
    radiusRatio: 0.82,
    temperature: '1,900 – 4,000 °C',
    pressure: '24 – 135 GPa',
    density: '4.4 – 5.6 g/cm³',
    stateOfMatter: 'Solid ductile rock (plastic creep)',
    colorHex: '#b91c1c',
    emissiveHex: '#7f1d1d',
    seismicNote: 'Sharp velocity jump at 660 km discontinuity and ultralow-velocity zones at the D″ base.',
    summary:
      'Representing over half of Earth’s volume, the lower mantle is composed primarily of bridgmanite—the most abundant mineral on Earth—under crushing pressure that keeps it solid yet slowly convecting over millions of years.',
    facts: [
      'The D″ (D-double-prime) boundary layer above the core launches deep mantle plumes behind hotspots like Hawaii.',
      'Subducted oceanic slabs can sink all the way into the lower mantle over tens of millions of years.',
      'Bridgmanite transforms into post-perovskite near the core-mantle boundary.',
    ],
    composition: [
      { label: 'Bridgmanite (Mg,Fe)SiO₃', percentage: 75, color: '#b91c1c' },
      { label: 'Ferropericlase (Mg,Fe)O', percentage: 18, color: '#dc2626' },
      { label: 'Calcium Perovskite', percentage: 7, color: '#f87171' },
    ],
  },
  {
    id: 'upper-mantle',
    order: 3,
    name: 'Upper Mantle & Asthenosphere',
    subtitle: 'Convecting Peridotite Engine',
    depthKm: '35 – 660 km',
    thicknessKm: '625 km',
    radiusRatio: 0.96,
    temperature: '500 – 1,900 °C',
    pressure: '1 – 24 GPa',
    density: '3.3 – 4.0 g/cm³',
    stateOfMatter: 'Solid rock with ductile asthenosphere',
    colorHex: '#d97706',
    emissiveHex: '#92400e',
    seismicNote: 'Low-velocity zone between 100–250 km marks the weak, ductile asthenosphere.',
    summary:
      'Containing the olivine-rich asthenosphere, the upper mantle acts as the mechanical conveyor belt upon which Earth’s rigid tectonic plates glide, collide, and subduct.',
    facts: [
      'Transition zone (410–660 km) stores vast amounts of water locked inside ringwoodite minerals—potentially equal to several oceans.',
      'Partial melting beneath mid-ocean ridges generates fresh basaltic magma for new oceanic crust.',
      'Convection currents move at roughly 2–10 cm per year—comparable to fingernail growth.',
    ],
    composition: [
      { label: 'Olivine (Mg,Fe)₂SiO₄', percentage: 55, color: '#d97706' },
      { label: 'Pyroxenes', percentage: 30, color: '#f59e0b' },
      { label: 'Garnet & Spinel', percentage: 15, color: '#fbbf24' },
    ],
  },
  {
    id: 'crust',
    order: 4,
    name: 'Crust & Lithosphere',
    subtitle: 'Granitic Continents & Basaltic Ocean Basins',
    depthKm: '0 – 70 km',
    thicknessKm: '5–10 km (ocean) · 30–70 km (continent)',
    radiusRatio: 1.0,
    temperature: '-89 – 500 °C',
    pressure: '0.0001 – 1.5 GPa',
    density: '2.7 – 3.0 g/cm³',
    stateOfMatter: 'Rigid brittle silicate plates',
    colorHex: '#2563eb',
    emissiveHex: '#0f172a',
    seismicNote: 'Mohorovičić discontinuity (Moho) marks the sudden seismic jump into the denser mantle.',
    summary:
      'Earth’s thin outer shell—proportionally thinner than an eggshell—broken into seven major and dozens of minor tectonic plates cradling our oceans, mountain belts, and biosphere.',
    facts: [
      'Oceanic crust is dense basalt recycled every ~200 million years at subduction trenches.',
      'Continental crust is buoyant granite up to 4 billion years old in ancient cratons.',
      'Earth is the only known rocky planet with sustained plate tectonics, cycling carbon and stabilizing climate.',
    ],
    composition: [
      { label: 'Oxygen (O)', percentage: 46.6, color: '#38bdf8' },
      { label: 'Silicon (Si)', percentage: 27.7, color: '#60a5fa' },
      { label: 'Aluminum (Al) & Iron (Fe)', percentage: 13.1, color: '#94a3b8' },
      { label: 'Ca, Na, K, Mg & Trace', percentage: 12.6, color: '#cbd5e1' },
    ],
  },
];

export const ATMOSPHERE_LAYERS: AtmosphereLayer[] = [
  {
    id: 'troposphere',
    order: 0,
    name: 'Troposphere',
    subtitle: 'Weather Engine & Breathable Biosphere',
    altitudeKm: '0 – 12 km',
    minKm: 0,
    maxKm: 12,
    radiusRatio: 1.035,
    temperatureRange: '+15 °C → −56 °C',
    pressureFraction: '75% of total atmospheric mass · 99% of water vapor',
    colorHex: '#38bdf8',
    summary:
      'The turbulent lowest layer touching Earth’s surface. Heated from below by sunlit land and oceans, convective updrafts drive all clouds, cyclones, rain, and global wind belts.',
    phenomena: [
      'Contains almost all weather systems, cumulonimbus storms, and the planetary boundary layer.',
      'Temperature drops ~6.5 °C per kilometer of ascent (environmental lapse rate).',
      'Ends at the tropopause (~9 km at poles, ~17 km at the equator).',
    ],
    keyBenchmarks: [
      { label: 'Mount Everest Summit', altitude: '8.85 km' },
      { label: 'Commercial Jet Cruise', altitude: '10 – 12 km' },
    ],
  },
  {
    id: 'stratosphere',
    order: 1,
    name: 'Stratosphere',
    subtitle: 'Ozone UV Shield & Stratified Airflow',
    altitudeKm: '12 – 50 km',
    minKm: 12,
    maxKm: 50,
    radiusRatio: 1.075,
    temperatureRange: '−56 °C → −2 °C',
    pressureFraction: '~24% of atmospheric mass · 1 to 100 hPa',
    colorHex: '#6366f1',
    summary:
      'A calm, stably stratified layer where temperature rises with altitude because ozone molecules absorb incoming solar ultraviolet (UV-B and UV-C) radiation, protecting surface life.',
    phenomena: [
      'Hosts the Ozone Layer (peaking around 20–30 km altitude).',
      'Minimal vertical turbulence allows high-altitude weather balloons and spy planes to glide smoothly.',
      'Polar stratospheric clouds form in extreme winter cold above Antarctica.',
    ],
    keyBenchmarks: [
      { label: 'Peak Ozone Concentration', altitude: '25 km' },
      { label: 'Stratospheric Weather Balloons', altitude: '35 – 40 km' },
    ],
  },
  {
    id: 'mesosphere',
    order: 2,
    name: 'Mesosphere',
    subtitle: 'Meteor Shield & Coldest Atmospheric Zone',
    altitudeKm: '50 – 85 km',
    minKm: 50,
    maxKm: 85,
    radiusRatio: 1.12,
    temperatureRange: '−2 °C → −90 °C',
    pressureFraction: '~0.1% of atmospheric mass',
    colorHex: '#8b5cf6',
    summary:
      'Air becomes thin enough that solar heating drops sharply, making the mesopause (~85 km) the coldest natural place on Earth—yet dense enough to vaporize millions of incoming meteors daily.',
    phenomena: [
      'Friction compresses air ahead of incoming space rocks, creating bright shooting stars.',
      'Noctilucent clouds—Earth’s highest ice-crystal clouds—glow electric blue after sunset.',
      'Hosts transient luminous events such as red sprites and blue jets above thunderstorms.',
    ],
    keyBenchmarks: [
      { label: 'Meteor Ablation Zone', altitude: '70 – 85 km' },
      { label: 'Noctilucent Ice Clouds', altitude: '82 km' },
    ],
  },
  {
    id: 'thermosphere',
    order: 3,
    name: 'Thermosphere',
    subtitle: 'Aurora Oval, Ionosphere & Orbital Flight',
    altitudeKm: '85 – 600 km',
    minKm: 85,
    maxKm: 600,
    radiusRatio: 1.18,
    temperatureRange: '−90 °C → +1,500 °C',
    pressureFraction: '< 0.001% of atmospheric mass',
    colorHex: '#e0a43b',
    summary:
      'High-energy solar X-rays and extreme UV radiation ionize sparse oxygen and nitrogen atoms, heating individual particles past 1,500 °C—though the air is too tenuous to feel warm. Home to the Kármán line, auroras, and the International Space Station.',
    phenomena: [
      'Charged solar wind particles funnel down magnetic field lines to ignite Aurora Borealis & Australis.',
      'The embedded Ionosphere reflects high-frequency radio waves around Earth’s curvature.',
      'Atmospheric drag here slowly decays low-Earth-orbit satellite altitudes.',
    ],
    keyBenchmarks: [
      { label: 'Kármán Line (Space Boundary)', altitude: '100 km' },
      { label: 'International Space Station', altitude: '408 km' },
    ],
  },
  {
    id: 'exosphere',
    order: 4,
    name: 'Exosphere',
    subtitle: 'Collisionless Frontier Merging into Deep Space',
    altitudeKm: '600 – 10,000+ km',
    minKm: 600,
    maxKm: 10000,
    radiusRatio: 1.25,
    temperatureRange: 'Solar-driven ballistic atoms',
    pressureFraction: 'Near-vacuum · Hydrogen & Helium trace',
    colorHex: '#0ea5e9',
    summary:
      'Earth’s outermost atmospheric halo. Atoms of hydrogen and helium travel hundreds of kilometers on ballistic arcs without colliding, with the fastest particles gradually escaping into interplanetary space.',
    phenomena: [
      'Produces the faint ultraviolet "geocorona" observed by space telescopes stretching beyond the Moon.',
      'Houses medium-Earth navigation constellations (GPS) and geostationary weather satellites.',
      'Interacts directly with the Van Allen radiation belts and solar wind pressure.',
    ],
    keyBenchmarks: [
      { label: 'Hubble Space Telescope', altitude: '540 km' },
      { label: 'GPS Satellite Constellation', altitude: '20,200 km' },
    ],
  },
];

export const HISTORY_ERAS: HistoryEra[] = [
  {
    id: 'hadean',
    name: 'Hadean Eon',
    eonOrEra: 'Molten Earth & Moon Formation',
    timeRange: '4.54 – 4.00 Ga',
    startMa: 4540,
    endMa: 4000,
    oxygenPercent: 0.0,
    meanTempC: 1100,
    dayLengthHours: 6,
    accentColor: '#f97316',
    atmosphereTint: '#fb923c',
    headline: 'A glowing magma ocean forged by planetary collisions',
    summary:
      'Earth accreted from the solar nebula 4.54 billion years ago. Shortly afterward, a Mars-sized protoplanet (Theia) struck Earth obliquely, vaporizing rock into orbit to coalesce into the Moon while leaving Earth covered in a global magma ocean and spinning once every ~6 hours.',
    geologyHighlights: [
      'Iron and nickel sank rapidly to the center ("iron catastrophe"), forming the core and early magnetic field.',
      'Steam, CO₂, and nitrogen outgassed from volcanoes to form Earth’s primordial high-pressure atmosphere.',
      'Jack Hills zircons (~4.4 Ga) show the first solid crust and liquid water pockets formed faster than once thought.',
    ],
    biologyHighlights: [
      'Sterile surface under constant Late Heavy Bombardment impacts.',
      'Deep hydrothermal vents may have started assembling prebiotic organic molecules late in the eon.',
    ],
  },
  {
    id: 'archean',
    name: 'Archean Eon',
    eonOrEra: 'First Oceans & Microbial Dawn',
    timeRange: '4.00 – 2.50 Ga',
    startMa: 4000,
    endMa: 2500,
    oxygenPercent: 0.01,
    meanTempC: 55,
    dayLengthHours: 14,
    accentColor: '#eab308',
    atmosphereTint: '#a16207',
    headline: 'Green iron-rich seas beneath an orange methane sky',
    summary:
      'As Earth cooled below 100 °C, torrential rains condensed into global oceans rich in dissolved iron—giving the sea an olive-green tint under a nitrogen-methane sky. Ancient continental cores (cratons) stabilized and the earliest life emerged.',
    geologyHighlights: [
      'First continental landmasses and modern-style plate subduction began assembling cratons.',
      'Banded Iron Formations began precipitating as early photosynthetic microbes released trace oxygen.',
    ],
    biologyHighlights: [
      'Earliest confirmed single-celled prokaryotes (3.8–3.5 Ga) thrived around hydrothermal vents.',
      'Cyanobacteria evolved oxygenic photosynthesis and built fossilized stromatolite reefs.',
    ],
  },
  {
    id: 'proterozoic',
    name: 'Proterozoic Eon',
    eonOrEra: 'Great Oxidation & Snowball Earth',
    timeRange: '2.50 Ga – 541 Ma',
    startMa: 2500,
    endMa: 541,
    oxygenPercent: 4.0,
    meanTempC: -35,
    dayLengthHours: 19,
    accentColor: '#67e8f9',
    atmosphereTint: '#bae6fd',
    headline: 'Oxygen transforms the sky and triggers planetary deep freezes',
    summary:
      'Cyanobacteria flooded the atmosphere with free oxygen during the Great Oxidation Event (~2.4 Ga), stripping warming methane and plunging Earth into global "Snowball Earth" glaciations where ice sheets reached the equator before volcanic CO₂ thawed the planet.',
    geologyHighlights: [
      'Supercontinents Columbia and Rodinia assembled and rifted apart.',
      'Cryogenian glaciations (720–635 Ma) encased almost the entire ocean surface in thick sea ice.',
    ],
    biologyHighlights: [
      'Eukaryotic cells with nuclei and mitochondria emerged (~1.8 Ga).',
      'Ediacaran biota (~575 Ma) introduced Earth’s first complex soft-bodied multicellular organisms.',
    ],
  },
  {
    id: 'paleozoic',
    name: 'Paleozoic Era',
    eonOrEra: 'Cambrian Explosion & Pangaea',
    timeRange: '541 – 252 Ma',
    startMa: 541,
    endMa: 252,
    oxygenPercent: 28.0,
    meanTempC: 20,
    dayLengthHours: 22,
    accentColor: '#e0a43b',
    atmosphereTint: '#38bdf8',
    headline: 'Life conquers the continents as all landmasses merge into Pangaea',
    summary:
      'The Cambrian Explosion rapidly produced eyes, shells, and nearly every modern animal body plan in the oceans. Plants, insects, and four-limbed tetrapods colonized land, culminating in coal swamps with 35% atmospheric oxygen and the assembly of supercontinent Pangaea.',
    geologyHighlights: [
      'Collision of Gondwana and Euramerica raised the Appalachian and Ural mountain chains.',
      'Ended with the Permian–Triassic "Great Dying" triggered by massive Siberian Traps volcanism.',
    ],
    biologyHighlights: [
      'Trilobites, armored fish, vascular forests, giant dragonflies, and early synapsid reptiles.',
      'Over 90% of marine species perished at 252 Ma in Earth’s most severe mass extinction.',
    ],
  },
  {
    id: 'mesozoic',
    name: 'Mesozoic Era',
    eonOrEra: 'Age of Dinosaurs & Pangaea Breakup',
    timeRange: '252 – 66 Ma',
    startMa: 252,
    endMa: 66,
    oxygenPercent: 24.0,
    meanTempC: 24,
    dayLengthHours: 23.5,
    accentColor: '#d97706',
    atmosphereTint: '#0ea5e9',
    headline: 'Greenhouse Earth, opening Atlantic Ocean, and dinosaur dominance',
    summary:
      'A warm, ice-free greenhouse world where Pangaea fractured into recognizable continents and opened the Atlantic Ocean. Dinosaurs dominated terrestrial ecosystems for 165 million years alongside marine reptiles, pterosaurs, and the first flowering plants.',
    geologyHighlights: [
      'Rifting of Pangaea created the Atlantic Ocean and flood basalt provinces.',
      'High sea levels submerged vast continental interiors under shallow epicontinental seas.',
    ],
    biologyHighlights: [
      'Evolution of birds from theropod dinosaurs and appearance of angiosperms (flowering plants).',
      'Ended abruptly 66 Ma when the 10-km Chicxulub asteroid struck Yucatán, triggering global impact winter.',
    ],
  },
  {
    id: 'cenozoic',
    name: 'Cenozoic Era & Present',
    eonOrEra: 'The Pale Blue Dot & Human Era',
    timeRange: '66 Ma – Present',
    startMa: 66,
    endMa: 0,
    oxygenPercent: 20.95,
    meanTempC: 15,
    dayLengthHours: 24,
    accentColor: '#38bdf8',
    atmosphereTint: '#38bdf8',
    headline: 'Tectonic peaks, glacial cycles, and a thriving modern biosphere',
    summary:
      'Following the non-avian dinosaur extinction, mammals diversified rapidly across cooling grasslands and forests. India collided with Eurasia to raise the Himalayas, Antarctic ice sheets froze over, and Homo sapiens emerged to observe our Pale Blue Dot from orbit.',
    geologyHighlights: [
      'Himalayan and Alpine orogenies reshaped global atmospheric circulation and monsoons.',
      'Quaternary Ice Ages cycled every 100,000 years driven by Milankovitch orbital variations.',
    ],
    biologyHighlights: [
      'Radiation of mammals, whales, grasslands, and primates.',
      'Modern biosphere supports ~8.7 million estimated eukaryotic species under a protective ozone-oxygen sky.',
    ],
  },
];

export const EARTH_LANDMARKS: EarthLandmark[] = [
  {
    id: 'everest',
    name: 'Mount Everest (Himalayas)',
    category: 'Tectonic',
    lat: 27.9881,
    lon: 86.925,
    elevationOrDepth: '+8,848.86 m',
    metricLabel: 'Uplift Rate',
    metricValue: '~4 mm / yr',
    summary:
      'Earth’s highest peak above sea level, thrust upward by the ongoing continental collision between the Indian and Eurasian tectonic plates.',
  },
  {
    id: 'mariana',
    name: 'Challenger Deep (Mariana Trench)',
    category: 'Oceanic',
    lat: 11.3733,
    lon: 142.5917,
    elevationOrDepth: '−10,935 m',
    metricLabel: 'Hydrostatic Pressure',
    metricValue: '108.6 MPa',
    summary:
      'The deepest point in Earth’s oceans, where the ancient Pacific Plate dives sharply beneath the Mariana Plate into the mantle.',
  },
  {
    id: 'mid-atlantic',
    name: 'Mid-Atlantic Ridge (Iceland)',
    category: 'Tectonic',
    lat: 64.255,
    lon: -21.129,
    elevationOrDepth: 'Divergent Rift',
    metricLabel: 'Spreading Rate',
    metricValue: '2.5 cm / yr',
    summary:
      'A 16,000-km underwater mountain chain where North American and Eurasian plates pull apart and fresh basaltic magma wells up to build new crust.',
  },
  {
    id: 'chicxulub',
    name: 'Chicxulub Impact Crater',
    category: 'Impact',
    lat: 21.4,
    lon: -89.5167,
    elevationOrDepth: '180 km diameter',
    metricLabel: 'Impact Age',
    metricValue: '66.04 Ma',
    summary:
      'Buried beneath the Yucatán Peninsula, this massive crater marks the K–Pg asteroid impact that ended the Age of Dinosaurs.',
  },
  {
    id: 'east-african-rift',
    name: 'East African Rift Valley',
    category: 'Tectonic',
    lat: -3.0,
    lon: 36.0,
    elevationOrDepth: 'Active Continental Split',
    metricLabel: 'Extension Rate',
    metricValue: '6–7 mm / yr',
    summary:
      'A nascent divergent plate boundary slowly splitting the African continent into the Nubian and Somali plates over the next tens of millions of years.',
  },
  {
    id: 'ring-of-fire',
    name: 'Mount Fuji (Pacific Ring of Fire)',
    category: 'Tectonic',
    lat: 35.3606,
    lon: 138.7274,
    elevationOrDepth: '+3,776 m',
    metricLabel: 'Global Quake Share',
    metricValue: '~90% of quakes',
    summary:
      'Situated along the Pacific Ring of Fire—a 40,000-km horseshoe of subduction zones hosting 75% of the world’s active volcanoes.',
  },
  {
    id: 'aurora-oval',
    name: 'Arctic Aurora Oval (Tromsø)',
    category: 'Atmospheric',
    lat: 69.6492,
    lon: 18.9553,
    elevationOrDepth: '100 – 300 km alt.',
    metricLabel: 'Peak Emission',
    metricValue: '557.7 nm (O)',
    summary:
      'Guided by Earth’s geomagnetic field lines, energized solar wind electrons collide with thermospheric oxygen and nitrogen to paint glowing auroral curtains.',
  },
  {
    id: 'iss-orbit',
    name: 'International Space Station Orbit',
    category: 'Orbital',
    lat: 28.5,
    lon: -45.0,
    elevationOrDepth: '408 km altitude',
    metricLabel: 'Orbital Velocity',
    metricValue: '7.66 km / s',
    summary:
      'Cruising through the lower Thermosphere at 27,600 km/h, completing 15.5 sunrises every 24 hours along a 51.6° orbital inclination.',
  },
];

export const PLANETARY_METRICS: PlanetaryMetric[] = [
  { label: 'Equatorial Radius', value: '6,378.1', unit: 'km', note: 'Polar flattening 0.00335' },
  { label: 'Planetary Mass', value: '5.972 × 10²⁴', unit: 'kg', note: 'Mean density 5.514 g/cm³' },
  { label: 'Surface Gravity', value: '9.807', unit: 'm/s²', note: 'Escape velocity 11.186 km/s' },
  { label: 'Axial Obliquity', value: '23.44°', unit: 'tilt', note: 'Drives seasonal insolation' },
  { label: 'Orbital Velocity', value: '29.78', unit: 'km/s', note: '149.6M km (1.000 AU) from Sun' },
  { label: 'Geomagnetic Dipole', value: '25 – 65', unit: 'µT', note: 'Shields against solar wind' },
  { label: 'Bond Albedo', value: '0.306', unit: 'ratio', note: '30.6% sunlight reflected' },
  { label: 'Age of Earth', value: '4.543', unit: 'Gyr', note: 'Radiometric Pb-Pb dating' },
];

export const HYDROSPHERE_BREAKDOWN: CompositionItem[] = [
  { label: 'Saline Oceans (71% surface)', percentage: 96.5, color: '#0284c7' },
  { label: 'Glaciers & Polar Ice Caps', percentage: 1.74, color: '#bae6fd' },
  { label: 'Groundwater Aquifers', percentage: 1.69, color: '#38bdf8' },
  { label: 'Lakes, Rivers & Atmosphere', percentage: 0.07, color: '#67e8f9' },
];

export const ATMOSPHERE_COMPOSITION: CompositionItem[] = [
  { label: 'Nitrogen (N₂)', percentage: 78.08, color: '#38bdf8' },
  { label: 'Oxygen (O₂)', percentage: 20.95, color: '#e0a43b' },
  { label: 'Argon (Ar)', percentage: 0.93, color: '#818cf8' },
  { label: 'CO₂, Neon & Trace Gases', percentage: 0.04, color: '#fbbf24' },
];

export interface LeafletBaseLayer {
  id: LeafletBaseLayerId;
  label: string;
  url: string;
  overlayUrl?: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string;
}

export const LEAFLET_BASE_LAYERS: LeafletBaseLayer[] = [
  {
    id: 'satellite',
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    overlayUrl:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Leaflet · Esri World Imagery & Boundaries',
    maxZoom: 18,
  },
  {
    id: 'atlas',
    label: 'Atlas (OSM)',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: 'Leaflet · © OpenStreetMap contributors',
    maxZoom: 19,
  },
  {
    id: 'topo',
    label: 'Topographic',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Leaflet · Esri, USGS, NOAA Topo',
    maxZoom: 18,
  },
  {
    id: 'dark',
    label: 'Dark Geo',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Leaflet · Esri Dark Gray Canvas',
    maxZoom: 16,
  },
];

export interface TectonicBoundary {
  id: string;
  name: string;
  type: 'Divergent Ridge' | 'Subduction Zone' | 'Continental Collision' | 'Active Rift';
  color: string;
  coords: Array<[number, number]>; // [lat, lon]
}

export const TECTONIC_BOUNDARIES: TectonicBoundary[] = [
  {
    id: 'mid-atlantic-ridge',
    name: 'Mid-Atlantic Ridge',
    type: 'Divergent Ridge',
    color: '#38bdf8',
    coords: [
      [66, -21], [52, -28], [38, -34], [22, -44], [8, -40],
      [0, -15], [-15, -13], [-35, -14], [-52, -10],
    ],
  },
  {
    id: 'ring-of-fire-west',
    name: 'Western Pacific Subduction Trench',
    type: 'Subduction Zone',
    color: '#f97316',
    coords: [
      [-45, 172], [-22, 178], [-8, 155], [5, 130], [18, 122],
      [34, 138], [45, 148], [55, 162], [58, 174],
    ],
  },
  {
    id: 'ring-of-fire-east',
    name: 'Eastern Pacific & Andean Trench',
    type: 'Subduction Zone',
    color: '#f97316',
    coords: [
      [56, -172], [60, -150], [54, -132], [42, -125], [28, -115],
      [18, -105], [12, -88], [2, -78], [-18, -73], [-38, -72], [-52, -75],
    ],
  },
  {
    id: 'alpine-himalayan',
    name: 'Alpine–Himalayan Collision Belt',
    type: 'Continental Collision',
    color: '#f59e0b',
    coords: [
      [36, -10], [38, 5], [40, 18], [37, 32], [36, 46],
      [34, 58], [34, 74], [28, 88], [20, 98], [4, 102], [-8, 116],
    ],
  },
  {
    id: 'east-african-rift',
    name: 'East African Rift System',
    type: 'Active Rift',
    color: '#fbbf24',
    coords: [
      [12, 42], [4, 38], [-5, 35], [-15, 34], [-24, 36],
    ],
  },
];

export interface SpaceSatelliteInfo {
  id: 'iss' | 'hubble' | 'sentinel';
  name: string;
  agency: string;
  orbitRegime: string;
  altitudeKm: string;
  inclinationDeg: number;
  velocityKmS: string;
  orbitRadius: number;
  orbitSpeed: number;
  accentColor: string;
  summary: string;
}

export const SPACE_SATELLITES: SpaceSatelliteInfo[] = [
  {
    id: 'iss',
    name: 'International Space Station (ISS)',
    agency: 'NASA · Roscosmos · ESA · JAXA · CSA',
    orbitRegime: 'Low Earth Orbit (LEO)',
    altitudeKm: '408 km',
    inclinationDeg: 51.6,
    velocityKmS: '7.66 km/s',
    orbitRadius: 2.42,
    orbitSpeed: 0.36,
    accentColor: '#38bdf8',
    summary:
      'Modular orbital laboratory spanning 109 meters across 8 main photovoltaic solar wings, pressurized research modules, thermal radiators, and the Earth-facing Cupola observatory.',
  },
  {
    id: 'hubble',
    name: 'Hubble Space Telescope (HST)',
    agency: 'NASA · ESA',
    orbitRegime: 'Low Earth Orbit (LEO)',
    altitudeKm: '535 km',
    inclinationDeg: 28.5,
    velocityKmS: '7.59 km/s',
    orbitRadius: 2.66,
    orbitSpeed: 0.28,
    accentColor: '#a78bfa',
    summary:
      'Flagship 2.4-meter optical space observatory encased in silver multi-layer insulation, equipped with dual high-gain telemetry dishes and articulated solar arrays.',
  },
  {
    id: 'sentinel',
    name: 'Deep-Orbit Earth Sentinel & GNSS',
    agency: 'NOAA · ESA Copernicus',
    orbitRegime: 'High / Medium Earth Orbit',
    altitudeKm: '20,200 km (scaled)',
    inclinationDeg: 68.0,
    velocityKmS: '3.87 km/s',
    orbitRadius: 3.08,
    orbitSpeed: 0.19,
    accentColor: '#f59e0b',
    summary:
      'Gold Kapton-shielded meteorological and navigation spacecraft carrying an Earth-pointing parabolic radar dish, S-band antennas, and twin sun-tracking solar wings.',
  },
];

export interface AsteroidInfo {
  id: string;
  name: string;
  spectralClass: string;
  diameter: string;
  closestApproachKm: string;
  velocityKmS: string;
  hazardNote: string;
  orbitRadius: number;
  inclinationRad: number;
  nodeAngleRad: number;
  speed: number;
  size: number;
  colorHex: string;
  summary: string;
}

export const NEAR_EARTH_ASTEROIDS: AsteroidInfo[] = [
  {
    id: 'apophis',
    name: '99942 Apophis',
    spectralClass: 'Sq-Type Stony Silicate',
    diameter: '370 meters',
    closestApproachKm: '31,600 km (Apr 13, 2029)',
    velocityKmS: '30.7 km/s',
    hazardNote: 'Safe flyby inside geostationary ring in 2029',
    orbitRadius: 3.72,
    inclinationRad: 0.34,
    nodeAngleRad: 0.4,
    speed: 0.24,
    size: 0.088,
    colorHex: '#a8a29e',
    summary:
      'An elongated peanut-shaped stony asteroid scheduled to skim closer to Earth than geostationary weather satellites on April 13, 2029.',
  },
  {
    id: 'bennu',
    name: '101955 Bennu',
    spectralClass: 'B-Type Carbonaceous',
    diameter: '490 meters',
    closestApproachKm: '299,000 km (2135 flyby)',
    velocityKmS: '28.0 km/s',
    hazardNote: 'OSIRIS-REx sample-return target · 1-in-2,700 (2182)',
    orbitRadius: 4.18,
    inclinationRad: -0.46,
    nodeAngleRad: 2.1,
    speed: 0.18,
    size: 0.095,
    colorHex: '#57534e',
    summary:
      'A dark, carbon-rich spinning-top rubble pile sampled by NASA’s OSIRIS-REx mission, preserving organic molecules from the birth of the Solar System.',
  },
  {
    id: 'eros',
    name: '433 Eros',
    spectralClass: 'S-Type Silicate',
    diameter: '34.4 × 11.2 km',
    closestApproachKm: '26.7 million km',
    velocityKmS: '24.4 km/s',
    hazardNote: 'Second-largest Near-Earth Asteroid · Zero Earth impact risk',
    orbitRadius: 4.75,
    inclinationRad: 0.22,
    nodeAngleRad: 4.1,
    speed: 0.14,
    size: 0.125,
    colorHex: '#b45309',
    summary:
      'A potato-shaped stony Near-Earth Asteroid orbited and landed upon by the NEAR Shoemaker spacecraft in 2001.',
  },
  {
    id: 'toutatis',
    name: '4179 Toutatis',
    spectralClass: 'S-Type Contact Binary',
    diameter: '4.5 × 2.4 km',
    closestApproachKm: '1.55 million km',
    velocityKmS: '11.0 km/s (relative)',
    hazardNote: 'Chaotically tumbling bilobed asteroid',
    orbitRadius: 5.25,
    inclinationRad: -0.18,
    nodeAngleRad: 5.3,
    speed: 0.11,
    size: 0.105,
    colorHex: '#78716c',
    summary:
      'A two-lobed contact-binary asteroid exhibiting non-principal-axis chaotic tumbling as it crosses Earth’s orbital neighborhood every four years.',
  },
];

