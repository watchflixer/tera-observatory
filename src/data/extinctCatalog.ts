import type { HistoryEraId } from './earthData';

export type ExtinctSidebarCategoryId =
  | 'animals'
  | 'mammals'
  | 'flowers'
  | 'plants'
  | 'humans'
  | 'marine';

export type SpecimenArchetype =
  | 'trex'
  | 'raptor'
  | 'triceratops'
  | 'sauropod'
  | 'pterosaur'
  | 'dodo'
  | 'mammoth'
  | 'sabertooth'
  | 'thylacine'
  | 'flower'
  | 'tree'
  | 'hominin'
  | 'marine-predator'
  | 'trilobite';

export type SoundProfile =
  | 'trex-roar'
  | 'raptor-call'
  | 'herbivore-bellow'
  | 'pterosaur-screech'
  | 'mammoth-trumpet'
  | 'bigcat-snarl'
  | 'bird-call'
  | 'forest-breeze'
  | 'hominin-ambience'
  | 'ocean-surge';

export interface ExtinctCategoryMeta {
  id: ExtinctSidebarCategoryId;
  label: string;
  subtitle: string;
}

export interface ExtinctSpecimen {
  id: string;
  lifeCatalogId?: string;
  name: string;
  scientificName: string;
  category: ExtinctSidebarCategoryId;
  eraId: HistoryEraId;
  livedSpan: string;
  extinctionCause: string;
  habitat: string;
  summary: string;
  /** Optional photorealistic field-reconstruction plate stored under /public/extinct. */
  imageUrl?: string;
  /** Optional source video shown in the specimen's main Extinct showcase. */
  videoUrl?: string;
  archetype: SpecimenArchetype;
  soundProfile: SoundProfile;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  scale: number;
}

export const EXTINCT_CATEGORIES: ExtinctCategoryMeta[] = [
  {
    id: 'animals',
    label: 'Animals & Dinosaurs',
    subtitle: 'Theropods, horned giants, pterosaurs & extinct birds',
  },
  {
    id: 'mammals',
    label: 'Mammals',
    subtitle: 'Ice Age megafauna & vanished marsupials',
  },
  {
    id: 'flowers',
    label: 'Flowers',
    subtitle: 'Earliest Cretaceous blooms & vanished flora',
  },
  {
    id: 'plants',
    label: 'Trees & Plants',
    subtitle: 'Carboniferous coal-forest giants & early land flora',
  },
  {
    id: 'humans',
    label: 'Humans & Hominins',
    subtitle: 'Archaic human species & early bipedal ancestors',
  },
  {
    id: 'marine',
    label: 'Prehistoric Marine',
    subtitle: 'Ancient armored fishes, sharks & sea arthropods',
  },
];

export const EXTINCT_SPECIMENS: ExtinctSpecimen[] = [
  // ======================== ANIMALS & DINOSAURS ========================
  {
    id: 'tyrannosaurus-rex',
    imageUrl: `${import.meta.env.BASE_URL}extinct/tyrannosaurus-rex.jpg?v=2`,
    videoUrl: `${import.meta.env.BASE_URL}extinct/tyrannosaurus-rex.mp4`,
    lifeCatalogId: 'tyrannosaurus-rex',
    name: 'Tyrannosaurus rex',
    scientificName: 'Tyrannosaurus rex',
    category: 'animals',
    eraId: 'mesozoic',
    livedSpan: '68 – 66 Ma · Late Cretaceous',
    extinctionCause: 'K–Pg Chicxulub asteroid impact & global impact winter',
    habitat: 'Cretaceous Subtropical Conifer & Fern Forest',
    summary:
      '12-meter apex theropod charging through Late Cretaceous woodlands with bone-crushing jaws and thunderous stride.',
    archetype: 'trex',
    soundProfile: 'trex-roar',
    primaryColor: '#5c4938',
    secondaryColor: '#3a2d22',
    accentColor: '#e0a43b',
    scale: 1.0,
  },
  {
    id: 'triceratops',
    imageUrl: `${import.meta.env.BASE_URL}extinct/triceratops.jpg`,
    lifeCatalogId: 'triceratops',
    name: 'Triceratops',
    scientificName: 'Triceratops horridus',
    category: 'animals',
    eraId: 'mesozoic',
    livedSpan: '68 – 66 Ma · Late Cretaceous',
    extinctionCause: 'K–Pg Asteroid Mass Extinction',
    habitat: 'Floodplain Woodlands & Fern Clearings',
    summary:
      'Three-horned ceratopsian defended by a solid bone neck frill and heavy charging momentum.',
    archetype: 'triceratops',
    soundProfile: 'herbivore-bellow',
    primaryColor: '#6b5b47',
    secondaryColor: '#483d30',
    accentColor: '#d9c6a5',
    scale: 0.95,
  },
  {
    id: 'velociraptor',
    imageUrl: `${import.meta.env.BASE_URL}extinct/velociraptor.jpg`,
    lifeCatalogId: 'velociraptor',
    name: 'Velociraptor',
    scientificName: 'Velociraptor mongoliensis',
    category: 'animals',
    eraId: 'mesozoic',
    livedSpan: '75 – 71 Ma · Late Cretaceous',
    extinctionCause: 'Late Cretaceous aridification & turnover',
    habitat: 'Scrub Dunes & Woodland Margins',
    summary:
      'Fast, feathered agile dromaeosaurid armed with curved sickle toe claws.',
    archetype: 'raptor',
    soundProfile: 'raptor-call',
    primaryColor: '#7a4b32',
    secondaryColor: '#3f281c',
    accentColor: '#e0a43b',
    scale: 0.68,
  },
  {
    id: 'brachiosaurus',
    imageUrl: `${import.meta.env.BASE_URL}extinct/brachiosaurus.jpg`,
    lifeCatalogId: 'brachiosaurus',
    name: 'Brachiosaurus',
    scientificName: 'Brachiosaurus altithorax',
    category: 'animals',
    eraId: 'mesozoic',
    livedSpan: '154 – 150 Ma · Late Jurassic',
    extinctionCause: 'Late Jurassic environmental shift',
    habitat: 'High Conifer & Cycad Canopy Forests',
    summary:
      'Towering sauropod browser striding between ancient conifer treetops.',
    archetype: 'sauropod',
    soundProfile: 'herbivore-bellow',
    primaryColor: '#5f6b53',
    secondaryColor: '#3f4736',
    accentColor: '#98a686',
    scale: 1.2,
  },
  {
    id: 'pteranodon',
    imageUrl: `${import.meta.env.BASE_URL}extinct/pteranodon.jpg`,
    lifeCatalogId: 'pteranodon',
    name: 'Pteranodon',
    scientificName: 'Pteranodon longiceps',
    category: 'animals',
    eraId: 'mesozoic',
    livedSpan: '86 – 84 Ma · Late Cretaceous',
    extinctionCause: 'Ended with all pterosaurs at 66 Ma',
    habitat: 'Coastal Forest Cliffs & Inland Seas',
    summary:
      'Giant winged flying reptile gliding over coastal tree canopies with a 6-meter wingspan.',
    archetype: 'pterosaur',
    soundProfile: 'pterosaur-screech',
    primaryColor: '#6d5e4e',
    secondaryColor: '#a6896b',
    accentColor: '#d97706',
    scale: 0.9,
  },
  {
    id: 'dodo',
    imageUrl: `${import.meta.env.BASE_URL}extinct/dodo.jpg`,
    videoUrl: `${import.meta.env.BASE_URL}extinct/dodo.mp4?v=1794977364648`,
    lifeCatalogId: 'dodo',
    name: 'Dodo',
    scientificName: 'Raphus cucullatus',
    category: 'animals',
    eraId: 'cenozoic',
    livedSpan: '~5 Ma – 1662 CE',
    extinctionCause: 'Human hunting & introduced invasive predators on Mauritius',
    habitat: 'Mauritius Coastal Tropical Forest',
    summary:
      'Fearless meter-tall flightless island bird driven extinct less than a century after human discovery.',
    archetype: 'dodo',
    soundProfile: 'bird-call',
    primaryColor: '#6e7680',
    secondaryColor: '#484f57',
    accentColor: '#e0a43b',
    scale: 0.72,
  },

  // ======================== MAMMALS ========================
  {
    id: 'woolly-mammoth',
    imageUrl: `${import.meta.env.BASE_URL}extinct/woolly-mammoth.jpg`,
    lifeCatalogId: 'woolly-mammoth',
    name: 'Woolly Mammoth',
    scientificName: 'Mammuthus primigenius',
    category: 'mammals',
    eraId: 'cenozoic',
    livedSpan: '400,000 yrs – 2,000 BCE',
    extinctionCause: 'Post-Ice-Age warming & human hunting pressure',
    habitat: 'Boreal Forest Edge & Mammoth Steppe',
    summary:
      'Shaggy-coated Ice Age giant wielding 4-meter curved ivory tusks and a resounding trumpet.',
    archetype: 'mammoth',
    soundProfile: 'mammoth-trumpet',
    primaryColor: '#593d2b',
    secondaryColor: '#362318',
    accentColor: '#f3ead8',
    scale: 1.05,
  },
  {
    id: 'smilodon',
    imageUrl: `${import.meta.env.BASE_URL}extinct/smilodon.jpg`,
    lifeCatalogId: 'smilodon',
    name: 'Saber-Toothed Cat (Smilodon)',
    scientificName: 'Smilodon fatalis',
    category: 'mammals',
    eraId: 'cenozoic',
    livedSpan: '1.6 Ma – 10,000 yrs ago',
    extinctionCause: 'End-Pleistocene megafauna collapse & climate warming',
    habitat: 'Pleistocene Pine Woods & Savanna Clearings',
    summary:
      'Heavy-muscled Ice Age predator armed with twin 18-cm serrated canine fangs.',
    archetype: 'sabertooth',
    soundProfile: 'bigcat-snarl',
    primaryColor: '#a67b46',
    secondaryColor: '#5e4220',
    accentColor: '#f5efe2',
    scale: 0.88,
  },
  {
    id: 'thylacine',
    imageUrl: `${import.meta.env.BASE_URL}extinct/thylacine.jpg`,
    lifeCatalogId: 'thylacine',
    name: 'Tasmanian Tiger (Thylacine)',
    scientificName: 'Thylacinus cynocephalus',
    category: 'mammals',
    eraId: 'cenozoic',
    livedSpan: '~2 Ma – 1936 CE',
    extinctionCause: 'Bounty hunting & habitat loss in Tasmania',
    habitat: 'Tasmanian Eucalyptus Forest & Woodlands',
    summary:
      'Striped carnivorous marsupial famous for its 80-degree jaw gape; last individual died in 1936.',
    archetype: 'thylacine',
    soundProfile: 'bigcat-snarl',
    primaryColor: '#a38252',
    secondaryColor: '#2d251d',
    accentColor: '#e0a43b',
    scale: 0.82,
  },

  // ======================== FLOWERS ========================
  {
    id: 'archaefructus',
    imageUrl: `${import.meta.env.BASE_URL}extinct/archaefructus.jpg`,
    lifeCatalogId: 'archaefructus',
    name: 'Archaefructus (Earliest Flower)',
    scientificName: 'Archaefructus liaoningensis',
    category: 'flowers',
    eraId: 'mesozoic',
    livedSpan: '125 Ma · Early Cretaceous',
    extinctionCause: 'Replaced by later petaled angiosperm lineages',
    habitat: 'Early Cretaceous Wetland & Forest Lagoon',
    summary:
      'One of Earth’s earliest complete flowering plant fossils, pioneering pollen-and-seed angiosperms.',
    archetype: 'flower',
    soundProfile: 'forest-breeze',
    primaryColor: '#d9a441',
    secondaryColor: '#4c6e3b',
    accentColor: '#f5e1a4',
    scale: 0.9,
  },
  {
    id: 'cycadeoidea',
    imageUrl: `${import.meta.env.BASE_URL}extinct/cycadeoidea.jpg`,
    name: 'Cycadeoidea (Mesozoic Blossom)',
    scientificName: 'Cycadeoidea dacotensis',
    category: 'flowers',
    eraId: 'mesozoic',
    livedSpan: '145 – 66 Ma · Cretaceous',
    extinctionCause: 'Ended in the K–Pg extinction alongside dinosaurs',
    habitat: 'Jurassic–Cretaceous Warm Conifer Forest',
    summary:
      'Beetle-pollinated prehistoric flower-like cones growing straight out of stout armored trunks.',
    archetype: 'flower',
    soundProfile: 'forest-breeze',
    primaryColor: '#c96f3b',
    secondaryColor: '#3f5932',
    accentColor: '#fbbf24',
    scale: 0.95,
  },

  // ======================== TREES & PLANTS ========================
  {
    id: 'lepidodendron',
    lifeCatalogId: 'lepidodendron',
    name: 'Lepidodendron (Giant Scale Tree)',
    scientificName: 'Lepidodendron sternbergii',
    category: 'plants',
    eraId: 'paleozoic',
    livedSpan: '350 – 295 Ma · Carboniferous',
    extinctionCause: 'Late Carboniferous rainforest collapse & aridification',
    habitat: 'Carboniferous Oxygen-Rich Coal Swamp Forest',
    summary:
      '40-meter diamond-barked giant lycopod tree that pushed Earth’s oxygen to 35% and formed global coal seams.',
    archetype: 'tree',
    soundProfile: 'forest-breeze',
    primaryColor: '#566844',
    secondaryColor: '#453629',
    accentColor: '#8ba367',
    scale: 1.1,
  },
  {
    id: 'cooksonia',
    lifeCatalogId: 'cooksonia',
    name: 'Cooksonia (First Vascular Plant)',
    scientificName: 'Cooksonia pertoni',
    category: 'plants',
    eraId: 'paleozoic',
    livedSpan: '433 – 393 Ma · Silurian–Devonian',
    extinctionCause: 'Outcompeted by taller rooted Devonian trees',
    habitat: 'Ancient Riverbank & Mossy Shoreline',
    summary:
      'Earliest forked vascular stems on land that turned barren continents verdant green.',
    archetype: 'tree',
    soundProfile: 'forest-breeze',
    primaryColor: '#677d46',
    secondaryColor: '#4d4132',
    accentColor: '#d9a441',
    scale: 0.78,
  },

  // ======================== HUMANS & HOMININS ========================
  {
    id: 'homo-neanderthalensis',
    lifeCatalogId: 'homo-neanderthalensis',
    name: 'Neanderthals',
    scientificName: 'Homo neanderthalensis',
    category: 'humans',
    eraId: 'cenozoic',
    livedSpan: '400,000 – 40,000 yrs ago',
    extinctionCause: 'Ice Age climate oscillations & absorption with Homo sapiens',
    habitat: 'Pleistocene Birch & Pine Woodland Clearing',
    summary:
      'Stout Ice Age Eurasian humans who crafted stone tools, cared for elders, and left ~2% DNA in billions alive today.',
    archetype: 'hominin',
    soundProfile: 'hominin-ambience',
    primaryColor: '#9c785c',
    secondaryColor: '#47362b',
    accentColor: '#e0a43b',
    scale: 0.92,
  },
  {
    id: 'homo-erectus',
    lifeCatalogId: 'homo-erectus',
    name: 'Homo erectus',
    scientificName: 'Homo erectus',
    category: 'humans',
    eraId: 'cenozoic',
    livedSpan: '1.9 Ma – 110,000 yrs ago',
    extinctionCause: 'Late Pleistocene climate shifts in Southeast Asia',
    habitat: 'Tropical Woodland & River Valley Trail',
    summary:
      'Longest-lived human species (~1.8 Myr), first to walk out of Africa and master controlled fire.',
    archetype: 'hominin',
    soundProfile: 'hominin-ambience',
    primaryColor: '#8d6649',
    secondaryColor: '#3d2d22',
    accentColor: '#e0a43b',
    scale: 0.9,
  },
  {
    id: 'homo-luzonensis',
    lifeCatalogId: 'homo-luzonensis',
    name: 'Homo luzonensis (Callao Man)',
    scientificName: 'Homo luzonensis',
    category: 'humans',
    eraId: 'cenozoic',
    livedSpan: '67,000 – 50,000 yrs ago',
    extinctionCause: 'Late Pleistocene insular turnover in Luzon',
    habitat: 'Northern Luzon Limestone Forest',
    summary:
      'Small-bodied Philippine island hominin discovered in Callao Cave, Cagayan.',
    archetype: 'hominin',
    soundProfile: 'hominin-ambience',
    primaryColor: '#967052',
    secondaryColor: '#403024',
    accentColor: '#e0a43b',
    scale: 0.8,
  },

  // ======================== PREHISTORIC MARINE ========================
  {
    id: 'megalodon',
    lifeCatalogId: 'megalodon',
    name: 'Megalodon',
    scientificName: 'Otodus megalodon',
    category: 'marine',
    eraId: 'cenozoic',
    livedSpan: '23 – 3.6 Ma · Miocene–Pliocene',
    extinctionCause: 'Pliocene ocean cooling & loss of coastal whale nurseries',
    habitat: 'Coastal Forest Estuary & Deep Channel',
    summary:
      '20-meter megatooth shark wielding 17-cm serrated teeth across warm Miocene oceans.',
    archetype: 'marine-predator',
    soundProfile: 'ocean-surge',
    primaryColor: '#4c5b6b',
    secondaryColor: '#2c3640',
    accentColor: '#e5e7eb',
    scale: 1.05,
  },
  {
    id: 'dunkleosteus',
    lifeCatalogId: 'dunkleosteus',
    name: 'Dunkleosteus',
    scientificName: 'Dunkleosteus terrelli',
    category: 'marine',
    eraId: 'paleozoic',
    livedSpan: '382 – 358 Ma · Late Devonian',
    extinctionCause: 'Late Devonian oceanic anoxia crisis',
    habitat: 'Devonian Coastal Reef & Mangrove Shallows',
    summary:
      'Armored bone-plated Devonian apex fish powered by self-sharpening jaw blades.',
    archetype: 'marine-predator',
    soundProfile: 'ocean-surge',
    primaryColor: '#584e42',
    secondaryColor: '#362e27',
    accentColor: '#d9c6a5',
    scale: 0.92,
  },
  {
    id: 'trilobites',
    lifeCatalogId: 'trilobites',
    name: 'Trilobites',
    scientificName: 'Class Trilobita',
    category: 'marine',
    eraId: 'paleozoic',
    livedSpan: '521 – 252 Ma · Paleozoic',
    extinctionCause: 'Permian–Triassic "Great Dying" ocean acidification',
    habitat: 'Paleozoic Shallow Seafloor & Shoreline',
    summary:
      'Armored three-lobed marine arthropods with mineral calcite crystal eyes lasting 270 million years.',
    archetype: 'trilobite',
    soundProfile: 'ocean-surge',
    primaryColor: '#5d5245',
    secondaryColor: '#383028',
    accentColor: '#e0a43b',
    scale: 0.85,
  },
];
