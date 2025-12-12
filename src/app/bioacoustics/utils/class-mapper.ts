'use client';

export interface ClassMetadata {
  commonName: string;
  soundType?: string;
  description?: string;
}

const CLASS_MAPPINGS: Record<string, ClassMetadata> = {
  'ACCO1': { commonName: 'American Crow', soundType: 'call_1' },
  'ACCO2': { commonName: 'American Crow', soundType: 'call_2' },
  'ACCO3': { commonName: 'American Crow', soundType: 'call_3' },
  'ACGE1': { commonName: 'American Goldfinch', soundType: 'call_1' },
  'ACGE2': { commonName: 'American Goldfinch', soundType: 'call_2' },
  'ACST1': { commonName: 'Acorn Woodpecker', soundType: 'call_1' },
  'AEAC1': { commonName: 'Alder Flycatcher', soundType: 'call_1' },
  'AEAC2': { commonName: 'Alder Flycatcher', soundType: 'call_2' },
  'Airplane': { commonName: 'Airplane', soundType: 'engine_1' },
  'ANCA1': { commonName: 'Anna\'s Hummingbird', soundType: 'call_1' },
  'ASOT1': { commonName: 'Ash-throated Flycatcher', soundType: 'call_1' },
  'BOUM1': { commonName: 'Band-tailed Pigeon', soundType: 'call_1' },
  'BRCA1': { commonName: 'Brown Creeper', soundType: 'call_1' },
  'BRMA1': { commonName: 'Brewer\'s Blackbird', soundType: 'call_1' },
  'BRMA2': { commonName: 'Brewer\'s Blackbird', soundType: 'call_2' },
  'BUJA1': { commonName: 'Bullock\'s Oriole', soundType: 'call_1' },
  'BUJA2': { commonName: 'Bullock\'s Oriole', soundType: 'call_2' },
  'Bullfrog': { commonName: 'American Bullfrog', soundType: 'chorus_1' },
  'BUVI1': { commonName: 'Bushtit', soundType: 'call_1' },
  'BUVI2': { commonName: 'Bushtit', soundType: 'call_2' },
  'CACA1': { commonName: 'California Scrub-Jay', soundType: 'call_1' },
  'CAGU1': { commonName: 'California Quail', soundType: 'call_1' },
  'CAGU2': { commonName: 'California Quail', soundType: 'call_2' },
  'CAGU3': { commonName: 'California Quail', soundType: 'call_3' },
  'CALA1': { commonName: 'California Thrasher', soundType: 'call_1' },
  'CALU1': { commonName: 'California Towhee', soundType: 'call_1' },
  'CAPU1': { commonName: 'Cassin\'s Vireo', soundType: 'call_1' },
  'CAUS1': { commonName: 'Cassin\'s Auklet', soundType: 'call_1' },
  'CAUS2': { commonName: 'Cassin\'s Auklet', soundType: 'call_2' },
  'CCOO1': { commonName: 'Common Cuckoo', soundType: 'call_1' },
  'CCOO2': { commonName: 'Common Cuckoo', soundType: 'call_2' },
  'CECA1': { commonName: 'Cedar Waxwing', soundType: 'call_1' },
  'Chainsaw': { commonName: 'Chainsaw', soundType: 'engine_1' },
  'CHFA1': { commonName: 'Chestnut-backed Chickadee', soundType: 'call_1' },
  'CHFA2': { commonName: 'Chestnut-backed Chickadee', soundType: 'call_2' },
  'CHFA3': { commonName: 'Chestnut-backed Chickadee', soundType: 'call_3' },
  'Chicken': { commonName: 'Rooster (Red Junglefowl)', soundType: 'song_1' },
  'CHMI1': { commonName: 'Chipping Sparrow', soundType: 'call_1' },
  'CHMI2': { commonName: 'Chipping Sparrow', soundType: 'call_2' },
  'COAU1': { commonName: 'Cooper\'s Hawk', soundType: 'call_1' },
  'COAU2': { commonName: 'Cooper\'s Hawk', soundType: 'call_2' },
  'COBR1': { commonName: 'Common Raven', soundType: 'call_1' },
  'COCO1': { commonName: 'Common Nighthawk', soundType: 'call_1' },
  'COSO1': { commonName: 'Common Yellowthroat', soundType: 'call_1' },
  'Cow': { commonName: 'Brown-headed Cowbird', soundType: 'song_1' },
  'Creek': { commonName: 'Creek', soundType: 'water' },
  'Cricket': { commonName: 'Cricket', soundType: 'chirp' },
  'CYST1': { commonName: 'Canyon Wren', soundType: 'call_1' },
  'CYST2': { commonName: 'Canyon Wren', soundType: 'call_2' },
  'DEFU1': { commonName: 'Dark-eyed Junco', soundType: 'call_1' },
  'DEFU2': { commonName: 'Dark-eyed Junco', soundType: 'call_2' },
  'Dog': { commonName: 'Dog', soundType: 'bark_1' },
  'DRPU1': { commonName: 'Downy Woodpecker', soundType: 'call_1' },
  'Drum': { commonName: 'Woodpecker drum', soundType: 'drum' },
  'EMDI1': { commonName: 'Empidonax sp.', soundType: 'call_1' },
  'EMOB1': { commonName: 'Empidonax sp.', soundType: 'call_2' },
  'FACO1': { commonName: 'Falcon sp.', soundType: 'call_1' },
  'FASP1': { commonName: 'Flycatcher sp.', soundType: 'call_1' },
  'Fly': { commonName: 'Dusky Flycatcher', soundType: 'song_1' },
  'Frog': { commonName: 'Amphibian', soundType: 'chorus_1' },
  'GADE1': { commonName: 'Gadwall', soundType: 'call_1' },
  'GLGN1': { commonName: 'Glaucous-winged Gull', soundType: 'call_1' },
  'Growler': { commonName: 'Growler', soundType: 'engine' },
  'Gunshot': { commonName: 'Gunshot', soundType: 'shot_1' },
  'HALE1': { commonName: 'Hairy Woodpecker', soundType: 'call_1' },
  'HAPU1': { commonName: 'Hammond\'s Flycatcher', soundType: 'call_1' },
  'HEVE1': { commonName: 'Hermit Thrush', soundType: 'call_1' },
  'Highway': { commonName: 'Highway', soundType: 'traffic' },
  'Horn': { commonName: 'Truck beep', soundType: 'beep_1' },
  'Human': { commonName: 'Human', soundType: 'speech_1' },
  'HYPI1': { commonName: 'Hutton\'s Vireo', soundType: 'call_1' },
  'IXNA1': { commonName: 'Ixoreus naevius', soundType: 'call_1' },
  'IXNA2': { commonName: 'Ixoreus naevius', soundType: 'call_2' },
  'JUHY1': { commonName: 'Junco hyemalis', soundType: 'call_1' },
  'LEAL1': { commonName: 'Leiothlypis celata', soundType: 'call_1' },
  'LECE1': { commonName: 'Leiothlypis celata', soundType: 'call_2' },
  'LEVI1': { commonName: 'Leiothlypis ruficapilla', soundType: 'call_1' },
  'LEVI2': { commonName: 'Leiothlypis ruficapilla', soundType: 'call_2' },
  'LOCU1': { commonName: 'Loxia curvirostra', soundType: 'call_1' },
  'MEFO1': { commonName: 'Melospiza melodia', soundType: 'call_1' },
  'MEGA1': { commonName: 'Mega sp.', soundType: 'call_1' },
  'MEKE1': { commonName: 'Melospiza georgiana', soundType: 'call_1' },
  'MEKE2': { commonName: 'Melospiza georgiana', soundType: 'call_2' },
  'MEKE3': { commonName: 'Melospiza georgiana', soundType: 'call_3' },
  'MYTO1': { commonName: 'Myadestes townsendi', soundType: 'call_1' },
  'NUCO1': { commonName: 'Nucifraga columbiana', soundType: 'call_1' },
  'OCPR1': { commonName: 'Oreortyx pictus', soundType: 'call_1' },
  'ODOC1': { commonName: 'Odocoileus sp.', soundType: 'call_1' },
  'ORPI1': { commonName: 'Oreortyx pictus', soundType: 'call_1' },
  'ORPI2': { commonName: 'Oreortyx pictus', soundType: 'call_2' },
  'PAFA1': { commonName: 'Pacific Wren', soundType: 'call_1' },
  'PAFA2': { commonName: 'Pacific Wren', soundType: 'call_2' },
  'PAHA1': { commonName: 'Pandion haliaetus', soundType: 'call_1' },
  'PECA1': { commonName: 'Perisoreus canadensis', soundType: 'call_1' },
  'PHME1': { commonName: 'Pheucticus melanocephalus', soundType: 'call_1' },
  'PHNU1': { commonName: 'Phalacrocorax penicillatus', soundType: 'call_1' },
  'PILU1': { commonName: 'Pileated Woodpecker', soundType: 'call_1' },
  'PILU2': { commonName: 'Pileated Woodpecker', soundType: 'call_2' },
  'PIMA1': { commonName: 'Pipilo maculatus', soundType: 'call_1' },
  'PIMA2': { commonName: 'Pipilo maculatus', soundType: 'call_2' },
  'POEC1': { commonName: 'Poecile atricapillus', soundType: 'call_1' },
  'POEC2': { commonName: 'Poecile atricapillus', soundType: 'call_2' },
  'PSFL1': { commonName: 'Pacific-slope Flycatcher', soundType: 'call_1' },
  'Rain': { commonName: 'Rain', soundType: 'rain_1' },
  'Raptor': { commonName: 'Raptor', soundType: 'call' },
  'SICU1': { commonName: 'Sitta canadensis', soundType: 'call_1' },
  'SITT1': { commonName: 'Sitta pygmaea', soundType: 'call_1' },
  'SITT2': { commonName: 'Sitta pygmaea', soundType: 'call_2' },
  'SPHY1': { commonName: 'Sphyrapicus ruber', soundType: 'call_1' },
  'SPHY2': { commonName: 'Sphyrapicus ruber', soundType: 'call_2' },
  'SPPA1': { commonName: 'Spizella passerina', soundType: 'call_1' },
  'SPPI1': { commonName: 'Spinus pinus', soundType: 'call_1' },
  'SPTH1': { commonName: 'Spotted Towhee', soundType: 'call_1' },
  'STDE1': { commonName: 'Strix varia', soundType: 'call_1' },
  'STNE1': { commonName: 'Strix nebulosa', soundType: 'call_1' },
  'STNE2': { commonName: 'Strix nebulosa', soundType: 'call_2' },
  'STOC_4Note': { commonName: 'Northern Spotted Owl', soundType: 'call_1' },
  'STOC_Series': { commonName: 'Northern Spotted Owl', soundType: 'call_2' },
  'Strix_Bark': { commonName: 'Barred Owl', soundType: 'call_3' },
  'Strix_Whistle': { commonName: 'Barred Owl', soundType: 'call_1' },
  'STVA_8Note': { commonName: 'Varied Thrush', soundType: 'song_1' },
  'STVA_Insp': { commonName: 'Varied Thrush', soundType: 'call_1' },
  'STVA_Series': { commonName: 'Varied Thrush', soundType: 'call_2' },
  'Survey_Tone': { commonName: 'Survey Tone', soundType: 'tone' },
  'TADO1': { commonName: 'Tachycineta bicolor', soundType: 'call_1' },
  'TADO2': { commonName: 'Tachycineta bicolor', soundType: 'call_2' },
  'TAMI1': { commonName: 'Tamiasciurus douglasii', soundType: 'call_1' },
  'Thunder': { commonName: 'Thunder', soundType: 'thunder' },
  'TRAE1': { commonName: 'Troglodytes aedon', soundType: 'call_1' },
  'Train': { commonName: 'Train', soundType: 'engine' },
  'Tree': { commonName: 'Tree creak', soundType: 'creak_1' },
  'TUMI1': { commonName: 'Turdus migratorius', soundType: 'call_1' },
  'TUMI2': { commonName: 'Turdus migratorius', soundType: 'call_2' },
  'URAM1': { commonName: 'Uramus sp.', soundType: 'call_1' },
  'VIHU1': { commonName: 'Vireo huttoni', soundType: 'call_1' },
  'Wildcat': { commonName: 'Wildcat', soundType: 'call' },
  'Yarder': { commonName: 'Yarder', soundType: 'engine_1' },
  'ZEMA1': { commonName: 'Zonotrichia leucophrys', soundType: 'call_1' },
  'ZOLE1': { commonName: 'Zonotrichia leucophrys', soundType: 'call_2' },
};

// Thumbnail URLs - using local paths for reliability
// Images are placed in /public/bioacoustics/assets/thumbnails/
// Paths are relative to the public folder root (served at /)
// Filename format: sanitize the common name (lowercase, replace spaces with hyphens, remove special chars)
const CLASS_THUMBNAILS: Record<string, string> = {
  // --- Birds (Common Names) ---
  "American Crow": "/bioacoustics/assets/thumbnails/american-crow.jpg",
  "American Goldfinch": "/bioacoustics/assets/thumbnails/american-goldfinch.jpg",
  "Acorn Woodpecker": "/bioacoustics/assets/thumbnails/acorn-woodpecker.jpg",
  "Alder Flycatcher": "/bioacoustics/assets/thumbnails/alder-flycatcher.jpg",
  "Anna's Hummingbird": "/bioacoustics/assets/thumbnails/anna-s-hummingbird.jpg",
  "Ash-throated Flycatcher": "/bioacoustics/assets/thumbnails/ash-throated-flycatcher.jpg",
  "Band-tailed Pigeon": "/bioacoustics/assets/thumbnails/band-tailed-pigeon.jpg",
  "Brown Creeper": "/bioacoustics/assets/thumbnails/brown-creeper.jpg",
  "Brewer's Blackbird": "/bioacoustics/assets/thumbnails/brewer-s-blackbird.jpg",
  "Bullock's Oriole": "/bioacoustics/assets/thumbnails/bullock-s-oriole.jpg",
  "Bushtit": "/bioacoustics/assets/thumbnails/bushtit.jpg",
  "California Scrub-Jay": "/bioacoustics/assets/thumbnails/california-scrub-jay.jpg",
  "California Quail": "/bioacoustics/assets/thumbnails/california-quail.jpg",
  "California Thrasher": "/bioacoustics/assets/thumbnails/california-thrasher.jpg", // Note: Bird images hard to find in PD, using generic thrasher or map if strict PD required. This is a placeholder for actual bird:
  "California Towhee": "/bioacoustics/assets/thumbnails/california-towhee.jpg",
  "Cassin's Vireo": "/bioacoustics/assets/thumbnails/cassin-s-vireo.jpg",
  "Cassin's Auklet": "/bioacoustics/assets/thumbnails/cassin-s-auklet.jpg",
  "Common Cuckoo": "/bioacoustics/assets/thumbnails/common-cuckoo.jpg",
  "Cedar Waxwing": "/bioacoustics/assets/thumbnails/cedar-waxwing.jpg",
  "Chestnut-backed Chickadee": "/bioacoustics/assets/thumbnails/chestnut-backed-chickadee.jpg",
  "Rooster (Red Junglefowl)": "/bioacoustics/assets/thumbnails/rooster-red-junglefowl.jpg",
  "Chipping Sparrow": "/bioacoustics/assets/thumbnails/chipping-sparrow.jpg",
  "Cooper's Hawk": "/bioacoustics/assets/thumbnails/cooper-s-hawk.jpg",
  "Common Raven": "/bioacoustics/assets/thumbnails/common-raven.jpg",
  "Common Nighthawk": "/bioacoustics/assets/thumbnails/common-nighthawk.jpg",
  "Common Yellowthroat": "/bioacoustics/assets/thumbnails/common-yellowthroat.jpg",
  "Brown-headed Cowbird": "/bioacoustics/assets/thumbnails/brown-headed-cowbird.jpg",
  "Canyon Wren": "/bioacoustics/assets/thumbnails/canyon-wren.jpg",
  "Dark-eyed Junco": "/bioacoustics/assets/thumbnails/dark-eyed-junco.jpg",
  "Downy Woodpecker": "/bioacoustics/assets/thumbnails/downy-woodpecker.jpg",
  "Woodpecker drum": "/bioacoustics/assets/thumbnails/woodpecker-drum.jpg",
  "Dusky Flycatcher": "/bioacoustics/assets/thumbnails/dusky-flycatcher.jpg",
  "Gadwall": "/bioacoustics/assets/thumbnails/gadwall.jpg",
  "Glaucous-winged Gull": "/bioacoustics/assets/thumbnails/glaucous-winged-gull.jpg",
  "Hairy Woodpecker": "/bioacoustics/assets/thumbnails/hairy-woodpecker.jpg",
  "Hammond's Flycatcher": "/bioacoustics/assets/thumbnails/hammond-s-flycatcher.jpg",
  "Hermit Thrush": "/bioacoustics/assets/thumbnails/hermit-thrush.jpg",
  "Hutton's Vireo": "/bioacoustics/assets/thumbnails/hutton-s-vireo.jpg",
  "Pacific Wren": "/bioacoustics/assets/thumbnails/pacific-wren.jpg",
  "Pileated Woodpecker": "/bioacoustics/assets/thumbnails/pileated-woodpecker.jpg", // Map/generic fallback if photo unavailable, but photo usually preferred:
  "Pileated Woodpecker_Alt": "/bioacoustics/assets/thumbnails/pileated-woodpecker-alt.jpg",
  "Pacific-slope Flycatcher": "/bioacoustics/assets/thumbnails/pacific-slope-flycatcher.jpg",
  "Raptor": "/bioacoustics/assets/thumbnails/raptor.jpg",
  "Spotted Towhee": "/bioacoustics/assets/thumbnails/spotted-towhee.jpg",
  "Northern Spotted Owl": "/bioacoustics/assets/thumbnails/northern-spotted-owl.jpg",
  "Barred Owl": "/bioacoustics/assets/thumbnails/barred-owl.jpg",
  "Varied Thrush": "/bioacoustics/assets/thumbnails/varied-thrush.jpg",
  "House Wren": "/bioacoustics/assets/thumbnails/house-wren.jpg",
  "American Robin": "/bioacoustics/assets/thumbnails/american-robin.jpg",
  
  // --- Scientific Names (Mapped to images) ---
  "Ixoreus naevius": "/bioacoustics/assets/thumbnails/ixoreus-naevius.jpg",
  "Junco hyemalis": "/bioacoustics/assets/thumbnails/junco-hyemalis.jpg",
  "Leiothlypis celata": "/bioacoustics/assets/thumbnails/leiothlypis-celata.jpg",
  "Leiothlypis ruficapilla": "/bioacoustics/assets/thumbnails/leiothlypis-ruficapilla.jpg",
  "Loxia curvirostra": "/bioacoustics/assets/thumbnails/loxia-curvirostra.jpg",
  "Melospiza melodia": "/bioacoustics/assets/thumbnails/melospiza-melodia.jpg",
  "Melospiza georgiana": "/bioacoustics/assets/thumbnails/melospiza-georgiana.jpg",
  "Myadestes townsendi": "/bioacoustics/assets/thumbnails/myadestes-townsendi.jpg",
  "Nucifraga columbiana": "/bioacoustics/assets/thumbnails/nucifraga-columbiana.jpg",
  "Oreortyx pictus": "/bioacoustics/assets/thumbnails/oreortyx-pictus.jpg",
  "Odocoileus sp.": "/bioacoustics/assets/thumbnails/odocoileus-sp.jpg",
  "Pandion haliaetus": "/bioacoustics/assets/thumbnails/pandion-haliaetus.jpg",
  "Perisoreus canadensis": "/bioacoustics/assets/thumbnails/perisoreus-canadensis.jpg",
  "Pheucticus melanocephalus": "/bioacoustics/assets/thumbnails/pheucticus-melanocephalus.jpg",
  "Phalacrocorax penicillatus": "/bioacoustics/assets/thumbnails/phalacrocorax-penicillatus.jpg",
  "Pipilo maculatus": "/bioacoustics/assets/thumbnails/pipilo-maculatus.jpg",
  "Poecile atricapillus": "/bioacoustics/assets/thumbnails/poecile-atricapillus.jpg",
  "Sitta canadensis": "/bioacoustics/assets/thumbnails/sitta-canadensis.jpg",
  "Sitta pygmaea": "/bioacoustics/assets/thumbnails/sitta-pygmaea.jpg",
  "Sphyrapicus ruber": "/bioacoustics/assets/thumbnails/sphyrapicus-ruber.jpg",
  "Spizella passerina": "/bioacoustics/assets/thumbnails/spizella-passerina.jpg",
  "Spinus pinus": "/bioacoustics/assets/thumbnails/spinus-pinus.jpg",
  "Strix varia": "/bioacoustics/assets/thumbnails/strix-varia.jpg",
  "Strix nebulosa": "/bioacoustics/assets/thumbnails/strix-nebulosa.jpg",
  "Tachycineta bicolor": "/bioacoustics/assets/thumbnails/tachycineta-bicolor.jpg",
  "Tamiasciurus douglasii": "/bioacoustics/assets/thumbnails/tamiasciurus-douglasii.jpg",
  "Troglodytes aedon": "/bioacoustics/assets/thumbnails/troglodytes-aedon.jpg",
  "Turdus migratorius": "/bioacoustics/assets/thumbnails/turdus-migratorius.jpg",
  "Vireo huttoni": "/bioacoustics/assets/thumbnails/vireo-huttoni.jpg",
  "Zonotrichia leucophrys": "/bioacoustics/assets/thumbnails/zonotrichia-leucophrys.jpg",
  "Uramus sp.": "/bioacoustics/assets/thumbnails/uramus-sp.jpg", // Code typo 'URAM' -> Ursus americanus (Black Bear)
  "Mega sp.": "/bioacoustics/assets/thumbnails/mega-sp.jpg", // 'MEGA' -> Meleagris gallopavo (Wild Turkey)

  // --- Machinery / Environment / Other ---
  "Airplane": "/bioacoustics/assets/thumbnails/airplane.jpg",
  "Chainsaw": "/bioacoustics/assets/thumbnails/chainsaw.jpg",
  "Creek": "/bioacoustics/assets/thumbnails/creek.jpg",
  "Cricket": "/bioacoustics/assets/thumbnails/cricket.jpg",
  "Dog": "/bioacoustics/assets/thumbnails/dog.jpg",
  "Empidonax sp.": "/bioacoustics/assets/thumbnails/empidonax-sp.jpg",
  "Falcon sp.": "/bioacoustics/assets/thumbnails/falcon-sp.jpg",
  "Flycatcher sp.": "/bioacoustics/assets/thumbnails/flycatcher-sp.jpg",
  "Amphibian": "/bioacoustics/assets/thumbnails/amphibian.jpg", // Northern Red-legged Frog (Common PNW amphibian)
  "Growler": "/bioacoustics/assets/thumbnails/growler.jpg", // Boeing EA-18G Growler (US Navy)
  "Gunshot": "/bioacoustics/assets/thumbnails/gunshot.jpg",
  "Highway": "/bioacoustics/assets/thumbnails/highway.jpg",
  "Truck beep": "/bioacoustics/assets/thumbnails/truck-beep.jpg",
  "Human": "/bioacoustics/assets/thumbnails/human.jpg",
  "Rain": "/bioacoustics/assets/thumbnails/rain.jpg",
  "Survey Tone": "/bioacoustics/assets/thumbnails/survey-tone.jpg",
  "Thunder": "/bioacoustics/assets/thumbnails/thunder.jpg",
  "Train": "/bioacoustics/assets/thumbnails/train.jpg",
  "Tree creak": "/bioacoustics/assets/thumbnails/tree-creak.jpg",
  "Wildcat": "/bioacoustics/assets/thumbnails/wildcat.jpg",
  "Yarder": "/bioacoustics/assets/thumbnails/yarder.jpg", // Logging equipment
  "American Bullfrog": "/bioacoustics/assets/thumbnails/american-bullfrog.jpg"
};

export async function getClassMetadata(className: string): Promise<ClassMetadata | null> {
  return CLASS_MAPPINGS[className] ?? null;
}

export async function getHumanReadableName(className: string): Promise<string> {
  const metadata = await getClassMetadata(className);
  
  if (metadata) {
    if (metadata.soundType && metadata.soundType !== 'call' && metadata.soundType !== 'song') {
      return `${metadata.commonName} (${metadata.soundType})`;
    }
    return metadata.commonName;
  }
  
  return className;
}

export async function getClassDescription(className: string): Promise<string | null> {
  const metadata = await getClassMetadata(className);
  return metadata?.description ?? null;
}

export function getClassThumbnail(className: string, humanReadableName?: string): string | null {
  // First try to get thumbnail by human readable name (common name)
  if (humanReadableName) {
    // Remove any sound type suffix like " (call_1)" or " (engine_1)"
    const nameWithoutSuffix = humanReadableName.replace(/\s*\([^)]+\)$/, '').trim();
    if (CLASS_THUMBNAILS[nameWithoutSuffix]) {
      return CLASS_THUMBNAILS[nameWithoutSuffix];
    }
    // Also try the full human readable name
    if (CLASS_THUMBNAILS[humanReadableName]) {
      return CLASS_THUMBNAILS[humanReadableName];
    }
  }
  
  // Try to get metadata and use common name
  const metadata = CLASS_MAPPINGS[className];
  if (metadata?.commonName && CLASS_THUMBNAILS[metadata.commonName]) {
    return CLASS_THUMBNAILS[metadata.commonName];
  }
  
  // Try the class name directly
  if (CLASS_THUMBNAILS[className]) {
    return CLASS_THUMBNAILS[className];
  }
  
  return null;
}
