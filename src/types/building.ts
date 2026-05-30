
// src/types/building.ts
export type BuildingCategory = 'bevaring' | 'riving' | 'ukjent' | string;

export type Building = {
  id: string;
  name: string;
  slug?: string;
  address: string;
  status: string;
  epoch?: string;
  style?: string;
  subStyle?: string;
  owner?: string;
  arkitekt?: string;
  verneklasse?: string;
  imageUrls?: string[];
  imageAttributions?: string[];
  constructionYear?: number;
  completionYear?: number;
  description?: string;
  latitude?: number;
  longitude?: number;

  previouslyExisted?: boolean;
  previousName?: string;
  previousImageUrl?: string;
  previousImageAttribution?: string;
  previousArchitect?: string;
  previousConstructionYear?: number;
  previousDemolitionYear?: number;
  demolitionReason?: string;
  previousInfoUrl?: string;

  category?: BuildingCategory; 
};

