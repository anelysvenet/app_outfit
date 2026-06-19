export const STYLES = [
  "Classique",
  "Élégant",
  "Décontracté",
  "Urbain",
  "Vintage",
  "Sportswear",
  "Streetwear",
  "Minimaliste",
  "Chic",
  "Business casual",
] as const;

export type Style = (typeof STYLES)[number];

export const CATEGORIES = [
  "haut",
  "bas",
  "robe",
  "veste",
  "chaussures",
  "sac",
  "sacoche",
  "ceinture",
  "chapeau",
  "bijoux",
  "lunettes",
  "foulard",
  "accessoire",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  haut: "Haut",
  bas: "Bas",
  robe: "Robe",
  veste: "Veste / Manteau",
  chaussures: "Chaussures",
  sac: "Sac à main",
  sacoche: "Sacoche",
  ceinture: "Ceinture",
  chapeau: "Chapeau / Casquette",
  bijoux: "Bijoux & Montre",
  lunettes: "Lunettes de soleil",
  foulard: "Foulard / Écharpe",
  accessoire: "Autre accessoire",
};

export const CUTS = [
  "ajustée",
  "droite",
  "slim",
  "oversize",
  "large",
  "cintrée",
  "évasée",
  "regular",
] as const;

export const SEASONS = ["printemps", "été", "automne", "hiver"] as const;

export const OCCASIONS = [
  "Travail",
  "Sortie",
  "Soirée",
  "Voyage",
  "Rendez-vous",
  "Sport",
  "Décontracté",
  "Cérémonie",
] as const;

export interface ColorSwatch {
  name: string;
  hex: string;
}

export interface Colorimetry {
  season: string; // Printemps, Été, Automne, Hiver
  undertone: string; // chaud, froid, neutre
  palette: ColorSwatch[]; // couleurs qui mettent en valeur (nom + hex)
  avoid: ColorSwatch[]; // couleurs à éviter (nom + hex)
  description: string;
  photo?: string; // photo du visage pour la visualisation « draping »
}

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  styles: string[];
  photo?: string;
  cities: string[];
  language?: string;
  country?: string;
  currency?: string;
  subscription?: "free" | "premium";
  promoCode?: string;
  colorimetry?: Colorimetry;
  createdAt: string;
}

export interface Garment {
  id: string;
  userId: string;
  photo: string;
  cutout?: string; // version détourée sur fond transparent (rendu collage)
  name: string;
  category: Category;
  type: string;
  cut: string;
  colors: string[];
  material: string;
  seasons: string[];
  styles: string[];
  brand?: string;
  description?: string;
  evening: boolean;
  deleted?: boolean;
  deletedAt?: string;
  createdAt: string;
}

export interface WeatherSnapshot {
  city: string;
  temperature: number;
  feelsLike: number;
  windSpeed: number;
  precipitation: number;
  rainProbability: number;
  condition: string;
  tempMin: number;
  tempMax: number;
}

export interface OutfitItem {
  garmentId: string;
  role: string;
}

export interface Outfit {
  id: string;
  userId: string;
  title: string;
  items: OutfitItem[];
  occasion: string;
  weather: WeatherSnapshot | null;
  explanation: string;
  tips: string;
  evening: boolean;
  rating?: number;
  tryOnImage?: string;
  deleted?: boolean;
  deletedAt?: string;
  createdAt: string;
}

/** Photo d'une tenue déjà portée par l'utilisateur, utilisée comme référence de style. */
export interface StyleRef {
  id: string;
  userId: string;
  photo: string;
  description?: string;
  colors?: string[];
  styles?: string[];
  createdAt: string;
}

export interface Database {
  users: User[];
  garments: Garment[];
  outfits: Outfit[];
  styleRefs: StyleRef[];
}
