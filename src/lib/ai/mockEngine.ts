// ============================================================
// SEAFOOD VISION — Mock Engine v2
// Generates real demonstration proposals from asset metadata.
// Uses actual species names, categories, product forms, keywords
// and other available fields from the 608 enriched assets.
// When a real AI provider is connected, only this file is replaced.
// ============================================================

export interface MockAssetContext {
  assetId: string;
  title: string | null;
  fileName: string | null;
  category: string | null;
  productForm: string | null;
  packaging: string | null;
  description: string | null;
  // Existing species data (if already linked)
  existingSpeciesCommonName: string | null;
  existingSpeciesScientificName: string | null;
  existingSpeciesFamily: string | null;
  existingSpeciesGenus: string | null;
  // Keywords from asset_keywords join
  keywords: string[];
  // Import batch context
  importBatch: string | null;
  folderPath: string | null;
}

export interface MockCandidate {
  rank: number;
  common_name: string;
  scientific_name: string;
  family: string;
  genus: string;
  order_name: string;
  ai_score: number;
  similarity_score: number;
  product_form: string;
  source_provider: 'mock';
  main_reasons: string[];
  commercial_name: string;
  description_candidate: string;
  category_candidate: string;
  packaging_candidate: string;
  product_candidate: string;
  keywords_candidate: string[];
  // Confidence breakdown
  vision_confidence: number;
  species_confidence: number;
  commercial_confidence: number;
  metadata_confidence: number;
}

// ─── Comprehensive species taxonomy database ──────────────────────────────────
// 60 species covering the main seafood categories present in the 608 assets.
// Each entry includes full taxonomy + commercial context.

const SPECIES_DATABASE: Array<{
  commonName: string;
  scientificName: string;
  family: string;
  genus: string;
  order: string;
  category: string;
  commercialName: string;
  aliases: string[];
  productForms: string[];
  keywords: string[];
  description: string;
}> = [
  // ── Salmonids ──
  {
    commonName: 'Atlantic Salmon', scientificName: 'Salmo salar', family: 'Salmonidae', genus: 'Salmo', order: 'Salmoniformes',
    category: 'Fish', commercialName: 'Atlantic Salmon', aliases: ['Salmon', 'Saumon Atlantique', 'Salmón Atlántico'],
    productForms: ['Fillet', 'Whole', 'Steak', 'Loin', 'IQF', 'Portion', 'Vacuum'],
    keywords: ['salmon', 'salmonidae', 'atlantic', 'pink flesh', 'omega-3', 'aquaculture', 'smoked salmon'],
    description: 'Premium Atlantic Salmon with characteristic pink-orange flesh. Widely farmed and commercially important worldwide.',
  },
  {
    commonName: 'Rainbow Trout', scientificName: 'Oncorhynchus mykiss', family: 'Salmonidae', genus: 'Oncorhynchus', order: 'Salmoniformes',
    category: 'Fish', commercialName: 'Rainbow Trout', aliases: ['Trout', 'Truite Arc-en-ciel', 'Trucha Arcoíris'],
    productForms: ['Whole', 'Fillet', 'HGT', 'IQF', 'Portion'],
    keywords: ['trout', 'rainbow', 'salmonidae', 'freshwater', 'aquaculture', 'pink flesh'],
    description: 'Rainbow Trout with distinctive lateral stripe. Farmed extensively for food production.',
  },
  {
    commonName: 'Brown Trout', scientificName: 'Salmo trutta', family: 'Salmonidae', genus: 'Salmo', order: 'Salmoniformes',
    category: 'Fish', commercialName: 'Brown Trout', aliases: ['Sea Trout', 'Truite Brune', 'Trucha Marrón'],
    productForms: ['Whole', 'Fillet', 'HGT'],
    keywords: ['trout', 'brown', 'salmonidae', 'wild', 'river', 'spotted'],
    description: 'Brown Trout found in rivers and coastal waters. Prized for its delicate flavor.',
  },
  {
    commonName: 'Arctic Char', scientificName: 'Salvelinus alpinus', family: 'Salmonidae', genus: 'Salvelinus', order: 'Salmoniformes',
    category: 'Fish', commercialName: 'Arctic Char', aliases: ['Omble Chevalier', 'Char Ártico'],
    productForms: ['Whole', 'Fillet', 'IQF'],
    keywords: ['char', 'arctic', 'salmonidae', 'cold water', 'pink flesh', 'nordic'],
    description: 'Arctic Char from cold northern waters. Similar to salmon with delicate pink flesh.',
  },
  // ── Gadoids ──
  {
    commonName: 'Atlantic Cod', scientificName: 'Gadus morhua', family: 'Gadidae', genus: 'Gadus', order: 'Gadiformes',
    category: 'Fish', commercialName: 'Atlantic Cod', aliases: ['Cod', 'Morue', 'Bacalao', 'Cabillaud'],
    productForms: ['Fillet', 'Whole', 'Steak', 'Block', 'IQF', 'Loin', 'Portion', 'Vacuum'],
    keywords: ['cod', 'gadidae', 'white fish', 'atlantic', 'bacalao', 'flaky', 'mild flavor'],
    description: 'Atlantic Cod — iconic white fish with firm, flaky flesh. Commercially critical species.',
  },
  {
    commonName: 'Hake', scientificName: 'Merluccius merluccius', family: 'Merlucciidae', genus: 'Merluccius', order: 'Gadiformes',
    category: 'Fish', commercialName: 'European Hake', aliases: ['Merlu', 'Merluza', 'Nasello'],
    productForms: ['Fillet', 'Whole', 'HGT', 'Steak', 'IQF', 'Portion'],
    keywords: ['hake', 'merlu', 'merluza', 'white fish', 'merlucciidae', 'delicate', 'european'],
    description: 'European Hake with delicate white flesh. Highly valued in Mediterranean and Atlantic markets.',
  },
  {
    commonName: 'Whiting', scientificName: 'Merlangius merlangus', family: 'Gadidae', genus: 'Merlangius', order: 'Gadiformes',
    category: 'Fish', commercialName: 'Whiting', aliases: ['Merlan', 'Merlán'],
    productForms: ['Whole', 'Fillet', 'HGT', 'IQF'],
    keywords: ['whiting', 'merlan', 'gadidae', 'white fish', 'mild', 'atlantic'],
    description: 'Whiting — lean white fish from the North Atlantic. Mild flavor, suitable for all preparations.',
  },
  {
    commonName: 'Pollock', scientificName: 'Pollachius virens', family: 'Gadidae', genus: 'Pollachius', order: 'Gadiformes',
    category: 'Fish', commercialName: 'Pollock', aliases: ['Lieu Noir', 'Abadejo', 'Saithe'],
    productForms: ['Fillet', 'Block', 'IQF', 'Portion', 'Steak'],
    keywords: ['pollock', 'lieu noir', 'gadidae', 'white fish', 'sustainable', 'block frozen'],
    description: 'Pollock — sustainable white fish widely used in processed seafood products.',
  },
  {
    commonName: 'Alaska Pollock', scientificName: 'Gadus chalcogrammus', family: 'Gadidae', genus: 'Gadus', order: 'Gadiformes',
    category: 'Fish', commercialName: 'Alaska Pollock', aliases: ['Walleye Pollock', 'Colin d\'Alaska', 'Abadejo de Alaska'],
    productForms: ['Fillet', 'Block', 'IQF', 'Surimi', 'Portion'],
    keywords: ['alaska pollock', 'walleye', 'gadidae', 'white fish', 'surimi', 'frozen block', 'MSC'],
    description: 'Alaska Pollock — world\'s largest sustainable fishery. Key ingredient in surimi and frozen products.',
  },
  // ── Flatfish ──
  {
    commonName: 'Sole', scientificName: 'Solea solea', family: 'Soleidae', genus: 'Solea', order: 'Pleuronectiformes',
    category: 'Fish', commercialName: 'Dover Sole', aliases: ['Sole Commune', 'Lenguado', 'Sogliola'],
    productForms: ['Whole', 'Fillet', 'HGT', 'IQF'],
    keywords: ['sole', 'flatfish', 'soleidae', 'dover', 'premium', 'white fish', 'delicate'],
    description: 'Dover Sole — premium flatfish with delicate white flesh. Highly prized in fine dining.',
  },
  {
    commonName: 'Turbot', scientificName: 'Scophthalmus maximus', family: 'Scophthalmidae', genus: 'Scophthalmus', order: 'Pleuronectiformes',
    category: 'Fish', commercialName: 'Turbot', aliases: ['Turbot Commun', 'Rodaballo', 'Rombo Chiodato'],
    productForms: ['Whole', 'Fillet', 'HGT', 'Steak'],
    keywords: ['turbot', 'flatfish', 'scophthalmidae', 'premium', 'white fish', 'aquaculture'],
    description: 'Turbot — premium flatfish with firm white flesh. Farmed and wild-caught.',
  },
  {
    commonName: 'Halibut', scientificName: 'Hippoglossus hippoglossus', family: 'Pleuronectidae', genus: 'Hippoglossus', order: 'Pleuronectiformes',
    category: 'Fish', commercialName: 'Atlantic Halibut', aliases: ['Flétan', 'Halibut Atlántico', 'Ippoglosso'],
    productForms: ['Fillet', 'Steak', 'Whole', 'IQF', 'Portion'],
    keywords: ['halibut', 'flatfish', 'pleuronectidae', 'large', 'white fish', 'atlantic', 'premium'],
    description: 'Atlantic Halibut — largest flatfish. Firm white flesh with mild flavor.',
  },
  {
    commonName: 'Plaice', scientificName: 'Pleuronectes platessa', family: 'Pleuronectidae', genus: 'Pleuronectes', order: 'Pleuronectiformes',
    category: 'Fish', commercialName: 'European Plaice', aliases: ['Plie', 'Solla', 'Platessa'],
    productForms: ['Whole', 'Fillet', 'HGT', 'IQF'],
    keywords: ['plaice', 'flatfish', 'pleuronectidae', 'orange spots', 'white fish', 'north sea'],
    description: 'European Plaice with distinctive orange spots. Popular flatfish in Northern Europe.',
  },
  // ── Pelagic fish ──
  {
    commonName: 'Yellowfin Tuna', scientificName: 'Thunnus albacares', family: 'Scombridae', genus: 'Thunnus', order: 'Scombriformes',
    category: 'Fish', commercialName: 'Yellowfin Tuna', aliases: ['Thon Jaune', 'Atún de Aleta Amarilla', 'Tonno Pinna Gialla'],
    productForms: ['Loin', 'Steak', 'Whole', 'IQF', 'Vacuum', 'Portion'],
    keywords: ['tuna', 'yellowfin', 'scombridae', 'tropical', 'red flesh', 'sashimi', 'loin'],
    description: 'Yellowfin Tuna with characteristic yellow fins. Prized for sashimi and steaks.',
  },
  {
    commonName: 'Bluefin Tuna', scientificName: 'Thunnus thynnus', family: 'Scombridae', genus: 'Thunnus', order: 'Scombriformes',
    category: 'Fish', commercialName: 'Atlantic Bluefin Tuna', aliases: ['Thon Rouge', 'Atún Rojo', 'Tonno Rosso'],
    productForms: ['Loin', 'Steak', 'Whole', 'Vacuum', 'Sashimi'],
    keywords: ['tuna', 'bluefin', 'scombridae', 'premium', 'red flesh', 'sashimi', 'otoro', 'maguro'],
    description: 'Atlantic Bluefin Tuna — most prized tuna species. Deep red flesh, exceptional for sashimi.',
  },
  {
    commonName: 'Skipjack Tuna', scientificName: 'Katsuwonus pelamis', family: 'Scombridae', genus: 'Katsuwonus', order: 'Scombriformes',
    category: 'Fish', commercialName: 'Skipjack Tuna', aliases: ['Listao', 'Bonite', 'Katsuo'],
    productForms: ['Loin', 'Block', 'IQF', 'Whole'],
    keywords: ['skipjack', 'tuna', 'scombridae', 'canned', 'tropical', 'bonito'],
    description: 'Skipjack Tuna — most commercially important tuna. Primary species for canned tuna.',
  },
  {
    commonName: 'Swordfish', scientificName: 'Xiphias gladius', family: 'Xiphiidae', genus: 'Xiphias', order: 'Istiophoriformes',
    category: 'Fish', commercialName: 'Swordfish', aliases: ['Espadon', 'Pez Espada', 'Pesce Spada'],
    productForms: ['Steak', 'Loin', 'Whole', 'IQF', 'Vacuum'],
    keywords: ['swordfish', 'espadon', 'xiphiidae', 'meaty', 'steak', 'grilling', 'large pelagic'],
    description: 'Swordfish with firm meaty flesh. Ideal for grilling and steaks.',
  },
  {
    commonName: 'Mahi-Mahi', scientificName: 'Coryphaena hippurus', family: 'Coryphaenidae', genus: 'Coryphaena', order: 'Coryphaeniformes',
    category: 'Fish', commercialName: 'Mahi-Mahi', aliases: ['Dorado', 'Dolphinfish', 'Coryphène'],
    productForms: ['Fillet', 'Steak', 'IQF', 'Whole', 'Portion'],
    keywords: ['mahi-mahi', 'dorado', 'coryphaenidae', 'tropical', 'colorful', 'firm flesh'],
    description: 'Mahi-Mahi — tropical fish with firm, mildly sweet flesh. Vibrant colors when fresh.',
  },
  {
    commonName: 'Mackerel', scientificName: 'Scomber scombrus', family: 'Scombridae', genus: 'Scomber', order: 'Scombriformes',
    category: 'Fish', commercialName: 'Atlantic Mackerel', aliases: ['Maquereau', 'Caballa', 'Sgombro'],
    productForms: ['Whole', 'Fillet', 'HGT', 'IQF', 'Smoked'],
    keywords: ['mackerel', 'maquereau', 'scombridae', 'oily fish', 'omega-3', 'atlantic', 'striped'],
    description: 'Atlantic Mackerel — oily fish rich in omega-3. Distinctive blue-green striped pattern.',
  },
  {
    commonName: 'Herring', scientificName: 'Clupea harengus', family: 'Clupeidae', genus: 'Clupea', order: 'Clupeiformes',
    category: 'Fish', commercialName: 'Atlantic Herring', aliases: ['Hareng', 'Arenque', 'Aringa'],
    productForms: ['Whole', 'Fillet', 'IQF', 'Smoked', 'Pickled'],
    keywords: ['herring', 'hareng', 'clupeidae', 'oily fish', 'atlantic', 'smoked', 'pickled', 'silver'],
    description: 'Atlantic Herring — important commercial species. Silver-sided schooling fish.',
  },
  {
    commonName: 'Sardine', scientificName: 'Sardina pilchardus', family: 'Clupeidae', genus: 'Sardina', order: 'Clupeiformes',
    category: 'Fish', commercialName: 'European Sardine', aliases: ['Sardine', 'Sardina', 'Pilchard'],
    productForms: ['Whole', 'Fillet', 'IQF', 'Canned'],
    keywords: ['sardine', 'clupeidae', 'oily fish', 'mediterranean', 'canned', 'small pelagic'],
    description: 'European Sardine — small oily fish. Widely consumed fresh, canned, and smoked.',
  },
  {
    commonName: 'Anchovy', scientificName: 'Engraulis encrasicolus', family: 'Engraulidae', genus: 'Engraulis', order: 'Clupeiformes',
    category: 'Fish', commercialName: 'European Anchovy', aliases: ['Anchois', 'Anchoa', 'Acciuga'],
    productForms: ['Whole', 'Fillet', 'IQF', 'Canned', 'Salted'],
    keywords: ['anchovy', 'anchois', 'engraulidae', 'small pelagic', 'mediterranean', 'salted', 'umami'],
    description: 'European Anchovy — small pelagic fish. Intensely flavored when cured or salted.',
  },
  // ── Sea bass & bream ──
  {
    commonName: 'European Sea Bass', scientificName: 'Dicentrarchus labrax', family: 'Moronidae', genus: 'Dicentrarchus', order: 'Perciformes',
    category: 'Fish', commercialName: 'Sea Bass', aliases: ['Bar', 'Branzino', 'Lubina', 'Loup de Mer'],
    productForms: ['Whole', 'Fillet', 'HGT', 'IQF', 'Portion'],
    keywords: ['sea bass', 'bar', 'branzino', 'moronidae', 'mediterranean', 'aquaculture', 'white fish'],
    description: 'European Sea Bass — prized Mediterranean fish. Elegant white flesh, mild flavor.',
  },
  {
    commonName: 'Gilthead Sea Bream', scientificName: 'Sparus aurata', family: 'Sparidae', genus: 'Sparus', order: 'Perciformes',
    category: 'Fish', commercialName: 'Sea Bream', aliases: ['Dorade Royale', 'Dorada', 'Orata'],
    productForms: ['Whole', 'Fillet', 'HGT', 'IQF', 'Portion'],
    keywords: ['sea bream', 'dorade', 'dorada', 'sparidae', 'mediterranean', 'aquaculture', 'gold stripe'],
    description: 'Gilthead Sea Bream with characteristic gold stripe. Mediterranean aquaculture staple.',
  },
  {
    commonName: 'Red Porgy', scientificName: 'Pagrus pagrus', family: 'Sparidae', genus: 'Pagrus', order: 'Perciformes',
    category: 'Fish', commercialName: 'Red Porgy', aliases: ['Pagre', 'Pargo', 'Pagro'],
    productForms: ['Whole', 'Fillet', 'HGT'],
    keywords: ['porgy', 'pagre', 'sparidae', 'red', 'mediterranean', 'white fish'],
    description: 'Red Porgy — sparid fish with pinkish-red coloration. Valued in Mediterranean markets.',
  },
  {
    commonName: 'Red Mullet', scientificName: 'Mullus surmuletus', family: 'Mullidae', genus: 'Mullus', order: 'Perciformes',
    category: 'Fish', commercialName: 'Red Mullet', aliases: ['Rouget Barbet', 'Salmonete', 'Triglia'],
    productForms: ['Whole', 'Fillet', 'HGT'],
    keywords: ['red mullet', 'rouget', 'mullidae', 'red', 'mediterranean', 'premium', 'barbels'],
    description: 'Red Mullet — distinctive red fish with barbels. Highly prized in Mediterranean cuisine.',
  },
  // ── Monkfish & anglerfish ──
  {
    commonName: 'Monkfish', scientificName: 'Lophius piscatorius', family: 'Lophiidae', genus: 'Lophius', order: 'Lophiiformes',
    category: 'Fish', commercialName: 'Monkfish', aliases: ['Lotte', 'Rape', 'Coda di Rospo', 'Anglerfish'],
    productForms: ['Tail', 'Fillet', 'Whole', 'IQF', 'Portion'],
    keywords: ['monkfish', 'lotte', 'rape', 'lophiidae', 'tail', 'firm flesh', 'anglerfish', 'ugly fish'],
    description: 'Monkfish — only the tail is eaten. Firm, lobster-like white flesh. Highly commercial.',
  },
  // ── Tropical & exotic ──
  {
    commonName: 'Red Snapper', scientificName: 'Lutjanus campechanus', family: 'Lutjanidae', genus: 'Lutjanus', order: 'Perciformes',
    category: 'Fish', commercialName: 'Red Snapper', aliases: ['Vivaneau Rouge', 'Pargo Rojo', 'Snapper'],
    productForms: ['Whole', 'Fillet', 'HGT', 'IQF'],
    keywords: ['snapper', 'red snapper', 'lutjanidae', 'tropical', 'red', 'white fish', 'gulf'],
    description: 'Red Snapper — prized tropical fish with distinctive red coloration. Firm white flesh.',
  },
  {
    commonName: 'Grouper', scientificName: 'Epinephelus marginatus', family: 'Serranidae', genus: 'Epinephelus', order: 'Perciformes',
    category: 'Fish', commercialName: 'Grouper', aliases: ['Mérou', 'Mero', 'Cernia'],
    productForms: ['Whole', 'Fillet', 'HGT', 'Steak'],
    keywords: ['grouper', 'merou', 'serranidae', 'tropical', 'white fish', 'mediterranean', 'premium'],
    description: 'Grouper — large reef fish with firm white flesh. Highly valued in Mediterranean and Asian markets.',
  },
  {
    commonName: 'Barramundi', scientificName: 'Lates calcarifer', family: 'Latidae', genus: 'Lates', order: 'Perciformes',
    category: 'Fish', commercialName: 'Barramundi', aliases: ['Asian Sea Bass', 'Barra', 'Perche Géante'],
    productForms: ['Whole', 'Fillet', 'HGT', 'IQF', 'Portion'],
    keywords: ['barramundi', 'asian sea bass', 'latidae', 'tropical', 'aquaculture', 'white fish', 'australia'],
    description: 'Barramundi — tropical sea bass farmed across Asia-Pacific. Mild white flesh.',
  },
  // ── Crustaceans ──
  {
    commonName: 'Giant Tiger Prawn', scientificName: 'Penaeus monodon', family: 'Penaeidae', genus: 'Penaeus', order: 'Decapoda',
    category: 'Crustaceans', commercialName: 'Black Tiger Shrimp', aliases: ['Crevette Tigre', 'Gambón Tigre', 'Tiger Prawn'],
    productForms: ['Whole', 'HLSO', 'PD', 'PUD', 'IQF', 'Block', 'Cooked'],
    keywords: ['shrimp', 'prawn', 'tiger', 'penaeidae', 'black tiger', 'tropical', 'aquaculture', 'striped'],
    description: 'Black Tiger Shrimp — large tropical prawn with distinctive dark stripes. Widely farmed.',
  },
  {
    commonName: 'Whiteleg Shrimp', scientificName: 'Litopenaeus vannamei', family: 'Penaeidae', genus: 'Litopenaeus', order: 'Decapoda',
    category: 'Crustaceans', commercialName: 'Vannamei Shrimp', aliases: ['Crevette Vannamei', 'Pacific White Shrimp', 'Gambón Blanco'],
    productForms: ['Whole', 'HLSO', 'PD', 'PUD', 'IQF', 'Block', 'Cooked', 'Vacuum'],
    keywords: ['shrimp', 'vannamei', 'penaeidae', 'white', 'pacific', 'aquaculture', 'most farmed'],
    description: 'Whiteleg Shrimp — world\'s most farmed shrimp. Mild flavor, versatile product forms.',
  },
  {
    commonName: 'Northern Shrimp', scientificName: 'Pandalus borealis', family: 'Pandalidae', genus: 'Pandalus', order: 'Decapoda',
    category: 'Crustaceans', commercialName: 'Cold Water Shrimp', aliases: ['Crevette Nordique', 'Gamba del Norte', 'Coldwater Prawn'],
    productForms: ['Whole', 'Cooked', 'Peeled', 'IQF', 'Block'],
    keywords: ['shrimp', 'cold water', 'pandalidae', 'nordic', 'small', 'sweet', 'north atlantic'],
    description: 'Northern Shrimp — small cold-water shrimp with sweet flavor. Harvested in North Atlantic.',
  },
  {
    commonName: 'European Lobster', scientificName: 'Homarus gammarus', family: 'Nephropidae', genus: 'Homarus', order: 'Decapoda',
    category: 'Crustaceans', commercialName: 'European Lobster', aliases: ['Homard Européen', 'Bogavante', 'Astice'],
    productForms: ['Whole', 'Live', 'Half', 'Tail', 'Cooked', 'IQF'],
    keywords: ['lobster', 'homard', 'nephropidae', 'premium', 'blue', 'claws', 'european'],
    description: 'European Lobster — premium crustacean with blue-black shell. Highly prized.',
  },
  {
    commonName: 'Norway Lobster', scientificName: 'Nephrops norvegicus', family: 'Nephropidae', genus: 'Nephrops', order: 'Decapoda',
    category: 'Crustaceans', commercialName: 'Langoustine', aliases: ['Langoustine', 'Dublin Bay Prawn', 'Scampi', 'Cigala'],
    productForms: ['Whole', 'Tail', 'IQF', 'Cooked', 'Live'],
    keywords: ['langoustine', 'scampi', 'nephropidae', 'norway lobster', 'tail', 'premium', 'north atlantic'],
    description: 'Norway Lobster — slender crustacean sold as langoustine or scampi. Delicate sweet flesh.',
  },
  {
    commonName: 'Blue Crab', scientificName: 'Callinectes sapidus', family: 'Portunidae', genus: 'Callinectes', order: 'Decapoda',
    category: 'Crustaceans', commercialName: 'Blue Crab', aliases: ['Crabe Bleu', 'Cangrejo Azul', 'Granchio Blu'],
    productForms: ['Whole', 'Cooked', 'Claw', 'Lump Meat', 'IQF'],
    keywords: ['crab', 'blue crab', 'portunidae', 'atlantic', 'invasive', 'sweet meat', 'claws'],
    description: 'Blue Crab — Atlantic species now invasive in Mediterranean. Sweet, delicate meat.',
  },
  {
    commonName: 'Snow Crab', scientificName: 'Chionoecetes opilio', family: 'Oregoniidae', genus: 'Chionoecetes', order: 'Decapoda',
    category: 'Crustaceans', commercialName: 'Snow Crab', aliases: ['Crabe des Neiges', 'Cangrejo de Nieve', 'Opilio'],
    productForms: ['Cluster', 'Leg', 'Cooked', 'IQF', 'Whole'],
    keywords: ['snow crab', 'opilio', 'oregoniidae', 'cold water', 'legs', 'clusters', 'canada'],
    description: 'Snow Crab — cold-water crab harvested in North Atlantic and Pacific. Long legs, sweet meat.',
  },
  // ── Molluscs ──
  {
    commonName: 'Common Octopus', scientificName: 'Octopus vulgaris', family: 'Octopodidae', genus: 'Octopus', order: 'Octopoda',
    category: 'Molluscs', commercialName: 'Octopus', aliases: ['Poulpe', 'Pulpo', 'Polpo'],
    productForms: ['Whole', 'Cleaned', 'IQF', 'Cooked', 'Tentacles'],
    keywords: ['octopus', 'poulpe', 'pulpo', 'octopodidae', 'cephalopod', 'tentacles', 'mediterranean'],
    description: 'Common Octopus — eight-armed cephalopod. Firm texture when cooked. Mediterranean staple.',
  },
  {
    commonName: 'European Squid', scientificName: 'Loligo vulgaris', family: 'Loliginidae', genus: 'Loligo', order: 'Myopsida',
    category: 'Molluscs', commercialName: 'Squid', aliases: ['Calmar', 'Calamar', 'Calamaro'],
    productForms: ['Whole', 'Cleaned', 'Tube', 'Ring', 'IQF', 'Block'],
    keywords: ['squid', 'calmar', 'calamar', 'loliginidae', 'cephalopod', 'tube', 'rings', 'ink'],
    description: 'European Squid — common cephalopod. Versatile product forms from whole to rings.',
  },
  {
    commonName: 'Patagonian Squid', scientificName: 'Doryteuthis gahi', family: 'Loliginidae', genus: 'Doryteuthis', order: 'Myopsida',
    category: 'Molluscs', commercialName: 'Falkland Squid', aliases: ['Encornet Patagonien', 'Calamar Patagónico'],
    productForms: ['Whole', 'Cleaned', 'Tube', 'IQF', 'Block'],
    keywords: ['squid', 'patagonian', 'falkland', 'loliginidae', 'south atlantic', 'frozen'],
    description: 'Patagonian Squid from South Atlantic waters. Important commercial species.',
  },
  {
    commonName: 'Common Cuttlefish', scientificName: 'Sepia officinalis', family: 'Sepiidae', genus: 'Sepia', order: 'Sepiida',
    category: 'Molluscs', commercialName: 'Cuttlefish', aliases: ['Seiche', 'Sepia', 'Seppia'],
    productForms: ['Whole', 'Cleaned', 'IQF', 'Ink'],
    keywords: ['cuttlefish', 'seiche', 'sepia', 'sepiidae', 'cephalopod', 'ink', 'mediterranean'],
    description: 'Common Cuttlefish — cephalopod with internal shell. Prized for ink and tender flesh.',
  },
  {
    commonName: 'Atlantic Scallop', scientificName: 'Pecten maximus', family: 'Pectinidae', genus: 'Pecten', order: 'Pectinida',
    category: 'Molluscs', commercialName: 'King Scallop', aliases: ['Coquille Saint-Jacques', 'Vieira', 'Capasanta'],
    productForms: ['Whole', 'Half Shell', 'Roe On', 'Roe Off', 'IQF', 'Vacuum'],
    keywords: ['scallop', 'coquille saint-jacques', 'vieira', 'pectinidae', 'bivalve', 'roe', 'premium'],
    description: 'King Scallop — premium bivalve with sweet adductor muscle. Iconic French product.',
  },
  {
    commonName: 'Mediterranean Mussel', scientificName: 'Mytilus galloprovincialis', family: 'Mytilidae', genus: 'Mytilus', order: 'Mytilida',
    category: 'Molluscs', commercialName: 'Mussel', aliases: ['Moule', 'Mejillón', 'Cozza'],
    productForms: ['Whole', 'Half Shell', 'Cooked', 'IQF', 'Smoked'],
    keywords: ['mussel', 'moule', 'mejillon', 'mytilidae', 'bivalve', 'aquaculture', 'mediterranean'],
    description: 'Mediterranean Mussel — farmed bivalve. Blue-black shell, orange flesh.',
  },
  {
    commonName: 'Pacific Oyster', scientificName: 'Magallana gigas', family: 'Ostreidae', genus: 'Magallana', order: 'Ostreida',
    category: 'Molluscs', commercialName: 'Pacific Oyster', aliases: ['Huître Creuse', 'Ostra Japonesa', 'Ostrica'],
    productForms: ['Live', 'Half Shell', 'Shucked', 'IQF', 'Smoked'],
    keywords: ['oyster', 'huitre', 'ostreidae', 'bivalve', 'aquaculture', 'pacific', 'premium', 'live'],
    description: 'Pacific Oyster — most farmed oyster worldwide. Briny, complex flavor.',
  },
  // ── Echinoderms & other ──
  {
    commonName: 'Sea Urchin', scientificName: 'Paracentrotus lividus', family: 'Parechinidae', genus: 'Paracentrotus', order: 'Camarodonta',
    category: 'Other Seafood', commercialName: 'Sea Urchin', aliases: ['Oursin', 'Erizo de Mar', 'Riccio di Mare'],
    productForms: ['Live', 'Roe', 'Uni', 'IQF'],
    keywords: ['sea urchin', 'oursin', 'erizo', 'echinoderm', 'roe', 'uni', 'premium', 'mediterranean'],
    description: 'Sea Urchin — echinoderm prized for its roe (uni). Intense oceanic flavor.',
  },
  // ── Cephalopods ──
  {
    commonName: 'Jumbo Flying Squid', scientificName: 'Dosidicus gigas', family: 'Ommastrephidae', genus: 'Dosidicus', order: 'Oegopsida',
    category: 'Molluscs', commercialName: 'Humboldt Squid', aliases: ['Encornet Géant', 'Calamar Gigante', 'Pota'],
    productForms: ['Whole', 'Cleaned', 'Tube', 'Ring', 'IQF', 'Block'],
    keywords: ['squid', 'jumbo', 'humboldt', 'ommastrephidae', 'pacific', 'large', 'frozen block'],
    description: 'Jumbo Flying Squid from Humboldt Current. Large size, firm texture.',
  },
  // ── Seaweed & algae ──
  {
    commonName: 'Nori Seaweed', scientificName: 'Pyropia yezoensis', family: 'Bangiaceae', genus: 'Pyropia', order: 'Bangiales',
    category: 'Algae', commercialName: 'Nori', aliases: ['Nori', 'Laver', 'Algue Nori'],
    productForms: ['Dried', 'Sheet', 'Flake'],
    keywords: ['seaweed', 'nori', 'algae', 'bangiaceae', 'japanese', 'sushi', 'dried'],
    description: 'Nori Seaweed — dried red algae used in Japanese cuisine. Essential for sushi rolls.',
  },
  // ── Additional fish ──
  {
    commonName: 'Pangasius', scientificName: 'Pangasianodon hypophthalmus', family: 'Pangasiidae', genus: 'Pangasianodon', order: 'Siluriformes',
    category: 'Fish', commercialName: 'Pangasius', aliases: ['Basa', 'Swai', 'Tra', 'Panga'],
    productForms: ['Fillet', 'IQF', 'Block', 'Portion', 'Vacuum'],
    keywords: ['pangasius', 'basa', 'swai', 'pangasiidae', 'white fish', 'vietnam', 'aquaculture', 'mild'],
    description: 'Pangasius — Vietnamese catfish. Mild white flesh, widely exported as frozen fillets.',
  },
  {
    commonName: 'Tilapia', scientificName: 'Oreochromis niloticus', family: 'Cichlidae', genus: 'Oreochromis', order: 'Cichliformes',
    category: 'Fish', commercialName: 'Nile Tilapia', aliases: ['Tilapia du Nil', 'Tilapia'],
    productForms: ['Fillet', 'Whole', 'IQF', 'Block', 'Portion'],
    keywords: ['tilapia', 'cichlidae', 'white fish', 'freshwater', 'aquaculture', 'mild', 'tropical'],
    description: 'Nile Tilapia — widely farmed freshwater fish. Mild white flesh, affordable.',
  },
  {
    commonName: 'Sea Bream', scientificName: 'Pagellus erythrinus', family: 'Sparidae', genus: 'Pagellus', order: 'Perciformes',
    category: 'Fish', commercialName: 'Common Pandora', aliases: ['Pageot Commun', 'Breca', 'Pagello Fragolino'],
    productForms: ['Whole', 'Fillet', 'HGT'],
    keywords: ['sea bream', 'pageot', 'sparidae', 'red', 'mediterranean', 'white fish'],
    description: 'Common Pandora — sparid fish with reddish coloration. Mediterranean species.',
  },
  {
    commonName: 'Spiny Lobster', scientificName: 'Palinurus elephas', family: 'Palinuridae', genus: 'Palinurus', order: 'Decapoda',
    category: 'Crustaceans', commercialName: 'Spiny Lobster', aliases: ['Langouste', 'Langosta', 'Aragosta'],
    productForms: ['Whole', 'Live', 'Tail', 'Cooked', 'IQF'],
    keywords: ['spiny lobster', 'langouste', 'langosta', 'palinuridae', 'no claws', 'premium', 'mediterranean'],
    description: 'Spiny Lobster — clawless lobster with long antennae. Premium Mediterranean species.',
  },
  {
    commonName: 'King Crab', scientificName: 'Paralithodes camtschaticus', family: 'Lithodidae', genus: 'Paralithodes', order: 'Decapoda',
    category: 'Crustaceans', commercialName: 'Red King Crab', aliases: ['Crabe Royal', 'Cangrejo Real', 'Granchio Reale'],
    productForms: ['Leg', 'Cluster', 'Cooked', 'IQF', 'Whole'],
    keywords: ['king crab', 'crabe royal', 'lithodidae', 'alaska', 'legs', 'premium', 'red', 'large'],
    description: 'Red King Crab — largest commercially harvested crab. Prized legs with sweet meat.',
  },
  {
    commonName: 'Clam', scientificName: 'Ruditapes decussatus', family: 'Veneridae', genus: 'Ruditapes', order: 'Venerida',
    category: 'Molluscs', commercialName: 'Grooved Carpet Shell', aliases: ['Palourde', 'Almeja', 'Vongola'],
    productForms: ['Live', 'Cooked', 'IQF', 'Half Shell'],
    keywords: ['clam', 'palourde', 'almeja', 'veneridae', 'bivalve', 'live', 'mediterranean'],
    description: 'Grooved Carpet Shell — prized clam species. Firm flesh, briny flavor.',
  },
];

// ─── Category-to-species mapping for context-aware selection ─────────────────

const CATEGORY_SPECIES_MAP: Record<string, string[]> = {
  'Fish': ['Atlantic Salmon', 'Rainbow Trout', 'Atlantic Cod', 'European Sea Bass', 'Gilthead Sea Bream',
    'Yellowfin Tuna', 'Bluefin Tuna', 'Swordfish', 'Mahi-Mahi', 'Halibut', 'Sole', 'Turbot',
    'Red Mullet', 'Monkfish', 'Hake', 'Mackerel', 'Herring', 'Sardine', 'Whiting', 'Sea Bream',
    'Pollock', 'Alaska Pollock', 'Plaice', 'Red Snapper', 'Grouper', 'Barramundi', 'Pangasius', 'Tilapia'],
  'Crustaceans': ['Giant Tiger Prawn', 'Whiteleg Shrimp', 'Northern Shrimp', 'European Lobster',
    'Norway Lobster', 'Blue Crab', 'Snow Crab', 'Spiny Lobster', 'King Crab'],
  'Molluscs': ['Common Octopus', 'European Squid', 'Patagonian Squid', 'Common Cuttlefish',
    'Atlantic Scallop', 'Mediterranean Mussel', 'Pacific Oyster', 'Jumbo Flying Squid', 'Clam'],
  'Algae': ['Nori Seaweed'],
  'Other Seafood': ['Sea Urchin'],
};

// ─── Product form to species affinity ────────────────────────────────────────

const PRODUCT_FORM_AFFINITY: Record<string, string[]> = {
  'Fillet': ['Atlantic Salmon', 'Rainbow Trout', 'Atlantic Cod', 'Hake', 'Sole', 'Halibut', 'Pollock', 'Alaska Pollock', 'Pangasius', 'Tilapia'],
  'Loin': ['Yellowfin Tuna', 'Bluefin Tuna', 'Skipjack Tuna', 'Swordfish', 'Mahi-Mahi'],
  'Steak': ['Swordfish', 'Yellowfin Tuna', 'Halibut', 'Mahi-Mahi', 'Turbot'],
  'Whole': ['European Sea Bass', 'Gilthead Sea Bream', 'Red Mullet', 'Sardine', 'Herring', 'Mackerel'],
  'IQF': ['Whiteleg Shrimp', 'Giant Tiger Prawn', 'Northern Shrimp', 'European Squid', 'Common Octopus'],
  'Block': ['Alaska Pollock', 'Pollock', 'Atlantic Cod', 'Pangasius', 'Jumbo Flying Squid'],
  'Vacuum': ['Atlantic Salmon', 'Yellowfin Tuna', 'Bluefin Tuna', 'European Lobster'],
  'HGT': ['European Sea Bass', 'Gilthead Sea Bream', 'Hake', 'Turbot', 'Sole'],
};

// ─── Keyword-to-species matching ─────────────────────────────────────────────

function scoreSpeciesByKeywords(species: typeof SPECIES_DATABASE[0], keywords: string[]): number {
  if (!keywords.length) return 0;
  const lowerKeywords = keywords.map((k) => k.toLowerCase());
  let score = 0;
  for (const kw of lowerKeywords) {
    if (species.commonName.toLowerCase().includes(kw)) score += 10;
    if (species.scientificName.toLowerCase().includes(kw)) score += 8;
    if (species.family.toLowerCase().includes(kw)) score += 6;
    if (species.aliases.some((a) => a.toLowerCase().includes(kw))) score += 7;
    if (species.keywords.some((k) => k.toLowerCase().includes(kw))) score += 4;
    if (species.commercialName.toLowerCase().includes(kw)) score += 5;
  }
  return score;
}

function scoreSpeciesByTitle(species: typeof SPECIES_DATABASE[0], title: string): number {
  const lower = title.toLowerCase();
  let score = 0;
  if (lower.includes(species.commonName.toLowerCase())) score += 20;
  if (lower.includes(species.scientificName.toLowerCase())) score += 15;
  if (lower.includes(species.family.toLowerCase())) score += 8;
  if (species.aliases.some((a) => lower.includes(a.toLowerCase()))) score += 12;
  if (species.keywords.some((k) => lower.includes(k.toLowerCase()))) score += 5;
  return score;
}

// ─── Deterministic seed ───────────────────────────────────────────────────────

function deterministicSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// ─── Product form enum mapping ────────────────────────────────────────────────
// CRITICAL: sie_species_candidates.product_form is a PostgreSQL ENUM:
// 'whole' | 'hgt' | 'fillet' | 'steak' | 'loin' | 'iqf' | 'block' | 'vacuum' | 'portion' | 'other'
// All values MUST be lowercase to match the enum. Capitalized values cause silent insert failures.

export function toSieProductForm(raw: string | null | undefined): string {
  if (!raw) return 'other';
  const lower = raw.toLowerCase().trim();
  const VALID_FORMS = ['whole', 'hgt', 'fillet', 'steak', 'loin', 'iqf', 'block', 'vacuum', 'portion', 'other'];
  if (VALID_FORMS.includes(lower)) return lower;
  // Map common aliases
  const MAP: Record<string, string> = {
    'hlso': 'other', 'pd': 'other', 'pud': 'other', 'cooked': 'other',
    'smoked': 'other', 'canned': 'other', 'salted': 'other', 'pickled': 'other',
    'live': 'whole', 'half': 'other', 'tail': 'other', 'leg': 'other',
    'cluster': 'other', 'claw': 'other', 'tentacles': 'other', 'tube': 'other',
    'ring': 'other', 'roe': 'other', 'uni': 'other', 'sheet': 'other',
    'flake': 'other', 'dried': 'other', 'ink': 'other', 'lump meat': 'other',
    'sashimi': 'other', 'surimi': 'other',
  };
  return MAP[lower] ?? 'other';
}

// ─── Main Mock Engine function ────────────────────────────────────────────────

export function generateEnrichedMockCandidates(
  jobId: string,
  context: MockAssetContext,
): MockCandidate[] {
  const seed = deterministicSeed(context.assetId + (context.title ?? jobId));

  // 1. Build candidate pool based on category
  let pool = [...SPECIES_DATABASE];

  // If we have a category, prioritize species from that category
  if (context.category && CATEGORY_SPECIES_MAP[context.category]) {
    const categoryNames = CATEGORY_SPECIES_MAP[context.category];
    const categoryPool = pool.filter((s) => categoryNames.includes(s.commonName));
    if (categoryPool.length >= 5) {
      pool = categoryPool;
    }
  }

  // 2. Score each species based on available metadata
  const allKeywords = [
    ...(context.keywords ?? []),
    ...(context.title ? context.title.split(/[\s_\-,]+/) : []),
    ...(context.description ? context.description.split(/[\s_\-,]+/).slice(0, 20) : []),
  ].filter((k) => k.length > 2);

  const scored = pool.map((species) => {
    let score = 0;

    // Score by title
    if (context.title) score += scoreSpeciesByTitle(species, context.title);

    // Score by keywords
    score += scoreSpeciesByKeywords(species, allKeywords);

    // Score by existing species (if asset already has a species linked)
    if (context.existingSpeciesCommonName) {
      if (species.commonName.toLowerCase() === context.existingSpeciesCommonName.toLowerCase()) score += 50;
      if (species.family.toLowerCase() === (context.existingSpeciesFamily ?? '').toLowerCase()) score += 15;
    }
    if (context.existingSpeciesScientificName) {
      if (species.scientificName.toLowerCase() === context.existingSpeciesScientificName.toLowerCase()) score += 40;
      if (species.genus.toLowerCase() === (context.existingSpeciesGenus ?? '').toLowerCase()) score += 10;
    }

    // Score by product form
    if (context.productForm && PRODUCT_FORM_AFFINITY[context.productForm]) {
      if (PRODUCT_FORM_AFFINITY[context.productForm].includes(species.commonName)) score += 12;
    }

    // Add deterministic noise to differentiate assets with same metadata
    const noise = deterministicSeed(species.scientificName + context.assetId) % 8;
    score += noise;

    return { species, score };
  });

  // 3. Sort by score descending, then take top 5 unique species
  scored.sort((a, b) => b.score - a.score);

  // Ensure diversity: avoid same family for ranks 1-3 if possible
  const selected: typeof scored = [];
  const usedFamilies = new Set<string>();

  for (const item of scored) {
    if (selected.length >= 5) break;
    // Allow same family only after we have 3 diverse candidates
    if (selected.length < 3 && usedFamilies.has(item.species.family) && selected.length > 0) {
      continue;
    }
    selected.push(item);
    usedFamilies.add(item.species.family);
  }

  // Fill remaining slots if diversity filter removed too many
  if (selected.length < 5) {
    for (const item of scored) {
      if (selected.length >= 5) break;
      if (!selected.includes(item)) selected.push(item);
    }
  }

  // 4. Assign confidence scores
  // If we have existing species data, boost top candidate confidence
  const hasExistingSpecies = !!(context.existingSpeciesCommonName || context.existingSpeciesScientificName);
  const hasKeywords = context.keywords.length > 0;
  const hasProductForm = !!context.productForm;

  const baseConfidences = hasExistingSpecies
    ? [88, 62, 38, 22, 12]
    : hasKeywords
      ? [74, 58, 42, 27, 16]
      : [65, 50, 36, 23, 13];

  // Add deterministic variation per asset
  const confVariation = seed % 10;

  const candidates: MockCandidate[] = selected.slice(0, 5).map((item, i) => {
    const species = item.species;
    const confidence = Math.min(95, Math.max(5, baseConfidences[i] + (i === 0 ? confVariation : -(confVariation % 4))));
    const similarity = Math.round(confidence * 0.92);

    // Determine product form for this candidate
    const candidateProductForm = context.productForm
      ?? (species.productForms.includes('Fillet') ? 'Fillet' : species.productForms[0] ?? 'Whole');

    // Build contextual reasons
    const reasons: string[] = [];

    if (i === 0) {
      if (context.existingSpeciesCommonName?.toLowerCase() === species.commonName.toLowerCase()) {
        reasons.push(`Espèce déjà liée : "${species.commonName}" — confirmation de l'identification existante`);
      } else if (context.title && scoreSpeciesByTitle(species, context.title) > 10) {
        reasons.push(`Titre de l'actif contient "${species.commonName}" ou un synonyme reconnu`);
      } else {
        reasons.push(`Meilleure correspondance visuelle avec la famille ${species.family}`);
      }
      if (hasKeywords) {
        const matchingKw = context.keywords.filter((k) =>
          species.keywords.some((sk) => sk.toLowerCase().includes(k.toLowerCase())) ||
          species.commonName.toLowerCase().includes(k.toLowerCase())
        );
        if (matchingKw.length > 0) {
          reasons.push(`Mots-clés correspondants : ${matchingKw.slice(0, 3).join(', ')}`);
        }
      }
      if (hasProductForm) {
        reasons.push(`Forme produit "${candidateProductForm}" compatible avec ${species.commonName}`);
      }
    } else if (i === 1) {
      reasons.push(`Famille ${species.family} — morphologie similaire au candidat #1`);
      if (species.family === selected[0].species.family) {
        reasons.push(`Même famille (${species.family}) — ambiguïté intra-famille détectée`);
      } else {
        reasons.push(`Catégorie "${species.category}" compatible avec le contexte`);
      }
      reasons.push('Score de similarité visuelle élevé — validation humaine recommandée');
    } else if (i === 2) {
      reasons.push(`Candidat alternatif — ordre ${species.order}`);
      reasons.push(`Confiance intermédiaire : ${confidence}% — données insuffisantes pour certitude`);
      reasons.push('Ambiguïté détectée — plusieurs espèces plausibles dans cette catégorie');
    } else {
      reasons.push(`Proposition de bas rang — ${confidence}% de confiance`);
      reasons.push(`Espèce ${species.commonName} possible mais peu probable`);
      reasons.push('Validation humaine obligatoire avant toute publication');
    }

    // Build enriched keywords
    const enrichedKeywords = [
      ...new Set([
        species.commonName,
        species.scientificName,
        species.family,
        species.commercialName,
        candidateProductForm,
        species.category,
        ...species.keywords.slice(0, 5),
        ...context.keywords.slice(0, 5),
      ]),
    ].filter(Boolean);

    // Build description
    const description = [
      `${species.commonName} (${species.scientificName})`,
      `— ${species.description}`,
      context.productForm ? `Forme produit : ${candidateProductForm}.` : '',
      context.category ? `Catégorie : ${context.category}.` : '',
      'Proposition Mock Engine v2 — validation humaine requise avant publication.',
    ].filter(Boolean).join(' ');

    // Confidence breakdown
    const visionConf = Math.round(confidence * (hasExistingSpecies ? 0.95 : 0.88));
    const speciesConf = confidence;
    const commercialConf = Math.round(confidence * (hasProductForm ? 0.82 : 0.65));
    const metadataConf = Math.round(confidence * (hasKeywords ? 0.78 : 0.55));

    return {
      rank: i + 1,
      common_name: species.commonName,
      scientific_name: species.scientificName,
      family: species.family,
      genus: species.genus,
      order_name: species.order,
      ai_score: confidence,
      similarity_score: similarity,
      product_form: toSieProductForm(candidateProductForm),
      source_provider: 'mock',
      main_reasons: reasons,
      commercial_name: species.commercialName,
      description_candidate: description,
      category_candidate: context.category ?? species.category,
      packaging_candidate: context.packaging ?? candidateProductForm,
      product_candidate: candidateProductForm,
      keywords_candidate: enrichedKeywords,
      vision_confidence: visionConf,
      species_confidence: speciesConf,
      commercial_confidence: commercialConf,
      metadata_confidence: metadataConf,
    };
  });

  return candidates;
}
