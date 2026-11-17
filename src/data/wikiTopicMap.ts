import type { HistoryEraId } from './earthData';
import type { LifeHistoryEntry } from './lifeHistoryData';

export interface WikiTopicDescriptor {
  wikiTitle: string;
  commonsQuery: string;
}

export interface EarthOverviewWikiTopic {
  id: 'history-of-earth' | HistoryEraId;
  title: string;
  scientificName: string;
  timeRange: string;
  headline: string;
  summary: string;
  highlights: string[];
  eraId: HistoryEraId;
  wikiTitle: string;
  commonsQuery: string;
}

export const EARTH_ERA_WIKI_TOPICS: EarthOverviewWikiTopic[] = [
  {
    id: 'history-of-earth',
    title: 'History of Earth (4.54 Ga – Present)',
    scientificName: 'Tellus / Terra · Sol III',
    timeRange: '4.54 Billion Years Ago – Present',
    headline: 'From a molten protoplanet in the solar nebula to a living Blue Marble',
    summary:
      'The history of Earth spans ~4.54 billion years across four major eons—Hadean, Archean, Proterozoic, and Phanerozoic—chronicling planetary accretion, the Giant Impact that forged the Moon, primordial oceans, cyanobacteria oxygenating the sky, Pangaea tectonic cycles, five mass extinctions, and the rise of modern life and Homo sapiens.',
    highlights: [
      '4.54 Ga: Earth accretes from the protoplanetary disk; Theia collision creates the Moon.',
      '3.8–3.5 Ga: Liquid oceans stabilize and the first microbial life appears near hydrothermal vents.',
      '2.4 Ga: Cyanobacteria trigger the Great Oxidation Event, transforming Earth’s sky and minerals.',
      '541 Ma – Present: Cambrian Explosion, colonization of land by plants & animals, Age of Dinosaurs, and Cenozoic human era.',
    ],
    eraId: 'cenozoic',
    wikiTitle: 'History of Earth',
    commonsQuery: 'History of Earth geological timeline Apollo Blue Marble',
  },
  {
    id: 'hadean',
    title: 'Hadean Eon',
    scientificName: 'Geologic Eon (4.54 – 4.00 Ga)',
    timeRange: '4.54 – 4.00 Ga',
    headline: 'Molten magma oceans, Moon formation, and Earth’s first zircons',
    summary:
      'Earth’s earliest geologic eon began with planet formation and the giant Theia impact. Dense iron sank to form Earth’s core and magnetic shield, while outgassed steam condensed into the first proto-oceans before 4.0 Ga.',
    highlights: [
      'Surface cooled intermittently enough for Jack Hills zircon crystals to trap liquid water by 4.4 Ga.',
      'Heavy asteroid bombardment melted parts of the crust and delivered volatile water and organics.',
    ],
    eraId: 'hadean',
    wikiTitle: 'Hadean',
    commonsQuery: 'Hadean eon early Earth volcano magma ocean zircon',
  },
  {
    id: 'archean',
    title: 'Archean Eon',
    scientificName: 'Geologic Eon (4.00 – 2.50 Ga)',
    timeRange: '4.00 – 2.50 Ga',
    headline: 'First cratons, green iron seas, and stromatolite microbes',
    summary:
      'Crustal rocks cooled permanently, oceans turned olive-green with dissolved iron beneath an orange methane haze, and single-celled prokaryotes plus photosynthetic cyanobacteria established Earth’s earliest biosphere.',
    highlights: [
      'Stromatolite microbial reefs fossilized in Western Australia date back 3.5 billion years.',
      'Continental cratons collided to form Earth’s earliest granitic landmasses.',
    ],
    eraId: 'archean',
    wikiTitle: 'Archean',
    commonsQuery: 'Archean stromatolites Shark Bay banded iron formation',
  },
  {
    id: 'proterozoic',
    title: 'Proterozoic Eon',
    scientificName: 'Geologic Eon (2.50 Ga – 541 Ma)',
    timeRange: '2.50 Ga – 541 Ma',
    headline: 'Great Oxidation, Snowball Earth, and multicellular Ediacaran life',
    summary:
      'Atmospheric oxygen surged, turning oceans blue and forming a UV-blocking ozone layer. Supercontinents Columbia and Rodinia assembled as global Cryogenian glaciations gave way to soft-bodied Ediacaran organisms.',
    highlights: [
      'Eukaryotic cells evolved via endosymbiosis (~1.8 Ga), gaining nuclei, mitochondria, and chloroplasts.',
      'Ediacaran seafloors hosted Earth’s earliest complex multicellular creatures like Dickinsonia.',
    ],
    eraId: 'proterozoic',
    wikiTitle: 'Proterozoic',
    commonsQuery: 'Proterozoic Snowball Earth Ediacaran Dickinsonia fossil',
  },
  {
    id: 'paleozoic',
    title: 'Paleozoic Era',
    scientificName: 'Phanerozoic Era (541 – 252 Ma)',
    timeRange: '541 – 252 Ma',
    headline: 'Cambrian Explosion, first forests, tetrapods & supercontinent Pangaea',
    summary:
      'Complex animal phyla erupted in Cambrian seas. Vascular plants, towering clubmoss coal forests, insects, amphibians, and early mammal-line synapsids colonized dry land before the Permian–Triassic Great Dying.',
    highlights: [
      'Atmospheric oxygen climbed to ~35%, powering giant arthropods and dense Carboniferous swamps.',
      'All continents fused into supercontinent Pangaea surrounded by global ocean Panthalassa.',
    ],
    eraId: 'paleozoic',
    wikiTitle: 'Paleozoic',
    commonsQuery: 'Paleozoic trilobite Carboniferous forest Pangaea fossil',
  },
  {
    id: 'mesozoic',
    title: 'Mesozoic Era',
    scientificName: 'Phanerozoic Era (252 – 66 Ma)',
    timeRange: '252 – 66 Ma',
    headline: 'Age of Dinosaurs, Pangaea breakup, and the first flowers',
    summary:
      'Across the Triassic, Jurassic, and Cretaceous periods, dinosaurs ruled land, pterosaurs ruled skies, mosasaurs swam warm inland seas, Pangaea broke apart into modern continents, and flowering plants (angiosperms) bloomed.',
    highlights: [
      'Birds diverged from feathered theropod dinosaurs during the Late Jurassic.',
      'Ended 66 Ma with the Chicxulub asteroid impact in the Yucatán Peninsula.',
    ],
    eraId: 'mesozoic',
    wikiTitle: 'Mesozoic',
    commonsQuery: 'Mesozoic dinosaur fossil Tyrannosaurus Archaeopteryx ammonite',
  },
  {
    id: 'cenozoic',
    title: 'Cenozoic Era & Present',
    scientificName: 'Phanerozoic Era (66 Ma – Present)',
    timeRange: '66 Ma – Present',
    headline: 'Age of Mammals, grasslands, Ice Ages, and Human Civilization',
    summary:
      'Mammals, whales, songbirds, grasses, fruit trees, and modern flowers diversified rapidly across cooling continents. India’s collision raised the Himalayas, Pleistocene Ice Ages pulsed, and Homo sapiens spread globally.',
    highlights: [
      'Grasses and flowering trees co-evolved with grazing mammals, primates, and pollinating bees.',
      'Modern human agriculture domesticated rice, wheat, corn, fruits, and ornamental flowers like roses.',
    ],
    eraId: 'cenozoic',
    wikiTitle: 'Cenozoic',
    commonsQuery: 'Cenozoic mammoth fossil Himalaya Earth biosphere',
  },
];

export const ENTRY_WIKI_MAP: Record<string, WikiTopicDescriptor> = {
  // Humans & Hominins
  sahelanthropus: { wikiTitle: 'Sahelanthropus', commonsQuery: 'Sahelanthropus tchadensis skull Toumai' },
  'australopithecus-afarensis': { wikiTitle: 'Australopithecus afarensis', commonsQuery: 'Australopithecus afarensis Lucy fossil skeleton' },
  'homo-habilis': { wikiTitle: 'Homo habilis', commonsQuery: 'Homo habilis skull KNM-ER 1813' },
  'homo-erectus': { wikiTitle: 'Homo erectus', commonsQuery: 'Homo erectus skull Turkana Boy' },
  'homo-heidelbergensis': { wikiTitle: 'Homo heidelbergensis', commonsQuery: 'Homo heidelbergensis Mauer jaw skull' },
  'homo-neanderthalensis': { wikiTitle: 'Neanderthal', commonsQuery: 'Homo neanderthalensis skull reconstruction' },
  denisovans: { wikiTitle: 'Denisovan', commonsQuery: 'Denisova cave hominin fossil' },
  'homo-floresiensis': { wikiTitle: 'Homo floresiensis', commonsQuery: 'Homo floresiensis skull Liang Bua' },
  'homo-luzonensis': { wikiTitle: 'Homo luzonensis', commonsQuery: 'Callao Cave Homo luzonensis Cagayan' },
  'homo-sapiens': { wikiTitle: 'Homo sapiens', commonsQuery: 'Human Homo sapiens humanity diversity portrait' },

  // Microbes & Fungi
  'luca-archaea': { wikiTitle: 'Last universal common ancestor', commonsQuery: 'Hydrothermal vent black smoker archaea' },
  cyanobacteria: { wikiTitle: 'Cyanobacteria', commonsQuery: 'Cyanobacteria stromatolites Shark Bay' },
  dickinsonia: { wikiTitle: 'Dickinsonia', commonsQuery: 'Dickinsonia costata fossil Ediacaran' },
  prototaxites: { wikiTitle: 'Prototaxites', commonsQuery: 'Prototaxites Devonian fungus fossil' },
  'mycorrhizal-fungi': { wikiTitle: 'Mycorrhiza', commonsQuery: 'Mycorrhiza mushroom forest fungi' },

  // Animals
  anomalocaris: { wikiTitle: 'Anomalocaris', commonsQuery: 'Anomalocaris fossil Burgess Shale' },
  trilobites: { wikiTitle: 'Trilobite', commonsQuery: 'Trilobite fossil specimen museum' },
  dunkleosteus: { wikiTitle: 'Dunkleosteus', commonsQuery: 'Dunkleosteus terrelli skull fossil' },
  tiktaalik: { wikiTitle: 'Tiktaalik', commonsQuery: 'Tiktaalik roseae fossil specimen' },
  dimetrodon: { wikiTitle: 'Dimetrodon', commonsQuery: 'Dimetrodon skeleton fossil museum' },
  brachiosaurus: { wikiTitle: 'Brachiosaurus', commonsQuery: 'Brachiosaurus skeleton museum Berlin' },
  'tyrannosaurus-rex': { wikiTitle: 'Tyrannosaurus', commonsQuery: 'Tyrannosaurus rex skeleton Sue museum' },
  triceratops: { wikiTitle: 'Triceratops', commonsQuery: 'Triceratops horridus skeleton skull museum' },
  velociraptor: { wikiTitle: 'Velociraptor', commonsQuery: 'Velociraptor mongoliensis fossil skeleton' },
  pteranodon: { wikiTitle: 'Pteranodon', commonsQuery: 'Pteranodon longiceps skeleton fossil' },
  mosasaurus: { wikiTitle: 'Mosasaurus', commonsQuery: 'Mosasaurus hoffmannii skeleton fossil' },
  megalodon: { wikiTitle: 'Megalodon', commonsQuery: 'Megalodon tooth fossil shark jaw' },
  'woolly-mammoth': { wikiTitle: 'Woolly mammoth', commonsQuery: 'Woolly mammoth skeleton reconstruction museum' },
  smilodon: { wikiTitle: 'Smilodon', commonsQuery: 'Smilodon fatalis skull skeleton La Brea' },
  dodo: { wikiTitle: 'Dodo', commonsQuery: 'Dodo Raphus cucullatus illustration specimen' },
  thylacine: { wikiTitle: 'Thylacine', commonsQuery: 'Thylacine Tasmanian tiger photograph' },
  coelacanth: { wikiTitle: 'Coelacanth', commonsQuery: 'Latimeria chalumnae coelacanth fish' },
  'blue-whale': { wikiTitle: 'Blue whale', commonsQuery: 'Balaenoptera musculus blue whale ocean' },
  'african-elephant': { wikiTitle: 'African bush elephant', commonsQuery: 'Loxodonta africana African savanna elephant' },
  'philippine-eagle': { wikiTitle: 'Philippine eagle', commonsQuery: 'Pithecophaga jefferyi Philippine eagle' },
  'insects-bees': { wikiTitle: 'Honey bee', commonsQuery: 'Apis mellifera honeybee pollinating flower' },
  'coral-reefs': { wikiTitle: 'Coral reef', commonsQuery: 'Scleractinia coral reef biodiversity fish' },

  // Trees & Plants
  cooksonia: { wikiTitle: 'Cooksonia', commonsQuery: 'Cooksonia fossil Silurian Devonian plant' },
  lepidodendron: { wikiTitle: 'Lepidodendron', commonsQuery: 'Lepidodendron bark fossil Carboniferous' },
  'ginkgo-biloba': { wikiTitle: 'Ginkgo biloba', commonsQuery: 'Ginkgo biloba tree leaves autumn' },
  'coast-redwood': { wikiTitle: 'Sequoia sempervirens', commonsQuery: 'Sequoia sempervirens coast redwood forest' },
  'bristlecone-pine': { wikiTitle: 'Pinus longaeva', commonsQuery: 'Pinus longaeva bristlecone pine Methuselah' },
  'coconut-palm': { wikiTitle: 'Coconut', commonsQuery: 'Cocos nucifera coconut palm tree fruit' },
  'narra-tree': { wikiTitle: 'Pterocarpus indicus', commonsQuery: 'Pterocarpus indicus narra tree flowers' },
  mangroves: { wikiTitle: 'Mangrove', commonsQuery: 'Rhizophora mangrove forest coastal roots' },
  'oak-tree': { wikiTitle: 'Oak', commonsQuery: 'Quercus oak tree acorns leaves' },
  bamboo: { wikiTitle: 'Bamboo', commonsQuery: 'Bambusoideae giant bamboo forest culms' },

  // Fruits
  banana: { wikiTitle: 'Banana', commonsQuery: 'Musa banana plantain fruit bunch' },
  mango: { wikiTitle: 'Mango', commonsQuery: 'Mangifera indica mango fruit tree' },
  apple: { wikiTitle: 'Apple', commonsQuery: 'Malus domestica apple tree fruit orchard' },
  avocado: { wikiTitle: 'Avocado', commonsQuery: 'Persea americana avocado fruit tree' },
  pineapple: { wikiTitle: 'Pineapple', commonsQuery: 'Ananas comosus pineapple plant fruit' },
  durian: { wikiTitle: 'Durian', commonsQuery: 'Durio zibethinus durian fruit tree' },
  'citrus-orange': { wikiTitle: 'Orange (fruit)', commonsQuery: 'Citrus sinensis sweet orange fruit blossoms' },
  watermelon: { wikiTitle: 'Watermelon', commonsQuery: 'Citrullus lanatus watermelon fruit' },

  // Vegetables & Crops
  rice: { wikiTitle: 'Rice', commonsQuery: 'Oryza sativa rice paddy Banaue terraces' },
  'maize-corn': { wikiTitle: 'Maize', commonsQuery: 'Zea mays corn maize cob field' },
  potato: { wikiTitle: 'Potato', commonsQuery: 'Solanum tuberosum potato tubers plant' },
  tomato: { wikiTitle: 'Tomato', commonsQuery: 'Solanum lycopersicum tomato fruit vine' },
  'brassica-vegetables': { wikiTitle: 'Brassica oleracea', commonsQuery: 'Brassica oleracea cabbage broccoli kale' },
  'onion-garlic': { wikiTitle: 'Allium', commonsQuery: 'Allium cepa onion Allium sativum garlic' },
  'moringa-malunggay': { wikiTitle: 'Moringa oleifera', commonsQuery: 'Moringa oleifera malunggay tree leaves pods' },
  'squash-kalabasa': { wikiTitle: 'Cucurbita', commonsQuery: 'Cucurbita moschata squash pumpkin vine' },

  // Flowers
  archaefructus: { wikiTitle: 'Archaefructus', commonsQuery: 'Archaefructus liaoningensis fossil flower' },
  'sacred-lotus': { wikiTitle: 'Nelumbo nucifera', commonsQuery: 'Nelumbo nucifera sacred lotus flower' },
  orchids: { wikiTitle: 'Orchid', commonsQuery: 'Orchidaceae Vanda sanderiana orchid flower' },
  rose: { wikiTitle: 'Rose', commonsQuery: '"Rosa" rose flower -hibiscus -rosa-sinensis' },
  sunflower: { wikiTitle: 'Common sunflower', commonsQuery: 'Helianthus annuus sunflower bloom field' },
  'rafflesia-arnoldii': { wikiTitle: 'Rafflesia arnoldii', commonsQuery: 'Rafflesia arnoldii giant flower Borneo' },
  sampaguita: { wikiTitle: 'Jasminum sambac', commonsQuery: 'Jasminum sambac sampaguita jasmine flower' },
  tulip: { wikiTitle: 'Tulip', commonsQuery: 'Tulipa tulip flower garden cultivars' },
};

export function getWikiDescriptorForEntry(entry: LifeHistoryEntry): WikiTopicDescriptor {
  return (
    ENTRY_WIKI_MAP[entry.id] ?? {
      wikiTitle: entry.scientificName || entry.name,
      commonsQuery: `${entry.name} ${entry.scientificName}`,
    }
  );
}
