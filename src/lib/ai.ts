import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { Garment, Outfit, User, WeatherSnapshot } from "./types";

const MODEL = "claude-opus-4-8";

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY manquante — ajoutez-la dans votre fichier .env",
    );
  }
  if (!_client) _client = new Anthropic();
  return _client;
}

/**
 * "FASHION BRAIN" — high-end stylist system prompt. Prepended to every
 * outfit-composing call so recommendations read like a professional stylist's,
 * not a random compatibility check.
 */
const FASHION_BRAIN = `FASHION BRAIN — Système de stylisme pour recommandations de tenues
Tu es une styliste personnelle haut de gamme spécialisée dans la création de tenues cohérentes, modernes, élégantes et portables. Ton rôle n'est pas simplement d'assembler des vêtements compatibles : tu composes une vraie tenue avec du goût, comme une styliste professionnelle.

PRIORITÉS : harmonie des couleurs, équilibre des volumes, cohérence des matières, cohérence du style, occasion, saison, morphologie, niveau d'élégance, simplicité maîtrisée. Une bonne tenue doit sembler intentionnelle, jamais aléatoire, et doit "respirer" (jamais surchargée).

PRINCIPE : chaque tenue a une pièce principale (hero piece), une palette cohérente, une silhouette équilibrée, un niveau d'élégance homogène, des accessoires qui complètent sans surcharger.

RÈGLES ABSOLUES (sauf style très créatif/éditorial demandé) :
- Maximum 3 couleurs dominantes. Une seule pièce forte. Un seul motif fort. Jamais deux imprimés forts.
- Haut ample → bas ajusté/structuré ; bas large → haut près du corps ou rentré.
- Si une pièce est très habillée, équilibre avec des pièces de niveau équivalent.
- Ne mélange pas sport et soirée (sauf streetwear chic assumé), ni des matières de saisons opposées.
- La tenue doit toujours être cohérente avec l'occasion.

MÉTHODE : identifie occasion → saison/météo → style perso → niveau d'élégance → choisis la pièce principale → construis autour → vérifie proportions haut/bas, harmonie couleurs, harmonie matières, motifs → choisis chaussures → sac → bijoux seulement s'ils améliorent → contrôle de goût final. Si la tenue ne pourrait pas apparaître dans un lookbook Zara, Massimo Dutti, COS, Sézane, Mango Premium, Toteme ou Reformation, rejette-la et recommence.

COULEURS : neutres premium (blanc, écru, crème, beige, camel, taupe, gris clair, anthracite, noir, marine, chocolat) ; une couleur vive est un accent, pas une base. Éviter : vert vif+rouge vif, orange vif+fuchsia, violet+jaune vif, noir profond+marine délavé, marron chaud+gris froid qui jurent, néon dans un look chic/old money, total beige sans contraste de texture, >3 couleurs fortes.

MATIÈRES : mêler une structurée, une souple, une lisse/texturée, du même univers de saison et d'élégance. Premium : laine, cachemire, coton épais, lin de qualité, soie, satin mat, cuir, daim, denim brut, maille fine, tweed sobre. À risque : polyester brillant, simili trop brillant, satin cheap, dentelle chargée, sequins en journée. Ne jamais associer satin brillant + polyester brillant, ni lin d'été + velours d'hiver.

VOLUMES : équilibre toujours la silhouette. Évite haut oversize + bas wide + manteau oversize. Robe volumineuse → chaussures fines + accessoires simples.

MOTIFS : un seul motif fort, le reste uni ou très discret. Pas de rayures+carreaux, léopard+fleurs, deux imprimés forts, etc.

ACCESSOIRES & BIJOUX : complètent, ne dominent pas. Tenue chargée → bijoux discrets. Tenue minimaliste → bijoux plus visibles autorisés. Doré avec crème/beige/camel/chocolat/noir/bordeaux ; argenté avec blanc/gris/noir/bleu/denim. Chaussures et sac cohérents avec le niveau d'élégance (pas de baskets sport avec robe de soirée, pas de sac de plage avec un look bureau).

STYLES (adapte à la préférence de l'utilisateur) : Old Money, Quiet Luxury, Parisienne, Clean Girl, Office/Business Chic, Streetwear Chic, Coquette, Romantic, French Riviera — respecte leurs palettes, matières et pièces typiques.

MORPHOLOGIES : adapte les coupes (A, V, X, H, 8, O) pour flatter, sans JAMAIS de commentaire négatif sur le corps — langage valorisant et pratique.

CONTRÔLE FINAL : pièce principale claire ? couleurs harmonieuses ? ≤3 couleurs dominantes ? matières cohérentes ? volumes équilibrés ? chaussures/sac/bijoux cohérents ? style respecté ? adaptée à l'occasion et à la saison ? digne d'un lookbook qualitatif ? Si une réponse est non, améliore avant de proposer.

RÈGLE FINALE : agis comme une styliste avec du goût, pas comme un générateur de combinaisons. Si une association est techniquement possible mais peu élégante, ne la propose pas. Privilégie : simple, chic, cohérent, portable, moderne, flatteur, intentionnel.`;

// ---------------------------------------------------------------------------
// Analyse automatique d'une photo de vêtement
// ---------------------------------------------------------------------------

const GarmentAnalysisSchema = z.object({
  name: z.string().describe("Nom court du vêtement, ex: « Chemise en lin blanche »"),
  category: z
    .enum(["haut", "bas", "robe", "combinaison", "veste", "chaussures", "sac", "sacoche", "ceinture", "chapeau", "bijoux", "lunettes", "foulard", "accessoire"])
    .describe("Catégorie du vêtement ou accessoire"),
  type: z.string().describe("Type précis, ex: chemise, jean, blazer, sneakers, ceinture"),
  cut: z
    .string()
    .describe("Coupe : ajustée, droite, slim, oversize, large, cintrée, évasée ou regular"),
  colors: z.array(z.string()).describe("Couleurs dominantes en français, max 3"),
  material: z.string().describe("Matière probable, ex: coton, lin, laine, cuir, denim"),
  seasons: z
    .array(z.enum(["printemps", "été", "automne", "hiver"]))
    .describe("Saisons adaptées"),
  styles: z.array(z.string()).describe(
    "Styles parmi : Classique, Élégant, Décontracté, Urbain, Vintage, Sportswear, Streetwear, Minimaliste, Chic, Business casual",
  ),
  eveningSuitable: z.boolean().describe("Vêtement adapté à une soirée / sortie nocturne"),
  description: z.string().describe("Description courte et élégante en français, 1-2 phrases"),
});

export type GarmentAnalysis = z.infer<typeof GarmentAnalysisSchema>;

const LANG_NAMES: Record<string, string> = {
  fr: "French", en: "English", es: "Spanish", it: "Italian", de: "German", pt: "Portuguese",
};

function langInstruction(lang?: string) {
  const name = LANG_NAMES[lang ?? "fr"] ?? "French";
  return `Respond entirely in ${name}.`;
}

export async function analyzeGarmentPhoto(
  base64: string,
  mediaType: string,
  lang?: string,
): Promise<GarmentAnalysis> {
  const response = await client().messages.parse({
    model: MODEL,
    max_tokens: 2048,
    system:
      `You are an expert fashion stylist with 20 years of experience. You analyze garment photos to catalogue a wardrobe. Your responses are precise. Pay close attention to colour: carefully distinguish true BLACK from NAVY / dark blue, and dark grey from black. ${langInstruction(lang)}`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: base64,
            },
          },
          {
            type: "text",
            text: "Analyze this garment: identify its category, type, cut, colors, likely material, suitable seasons and styles, and whether it suits an evening occasion.",
          },
        ],
      },
    ],
    output_config: {
      format: zodOutputFormat(GarmentAnalysisSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("L'analyse de l'image a échoué, réessayez.");
  }
  return response.parsed_output;
}

// ---------------------------------------------------------------------------
// Analyse d'une photo de tenue déjà portée (référence de style)
// ---------------------------------------------------------------------------

const StylePhotoSchema = z.object({
  description: z
    .string()
    .describe("Description courte et élégante de la tenue et de son style, 1-2 phrases"),
  colors: z.array(z.string()).describe("Couleurs dominantes de la tenue, max 4"),
  styles: z
    .array(z.string())
    .describe(
      "Styles parmi : Classique, Élégant, Décontracté, Urbain, Vintage, Sportswear, Streetwear, Minimaliste, Chic, Business casual",
    ),
});

export type StylePhotoAnalysis = z.infer<typeof StylePhotoSchema>;

export async function analyzeStylePhoto(
  base64: string,
  mediaType: string,
  lang?: string,
): Promise<StylePhotoAnalysis> {
  const response = await client().messages.parse({
    model: MODEL,
    max_tokens: 1024,
    system: `You are a fashion stylist analyzing a photo of an outfit the user already wears, to learn their personal style. Be precise and concise. ${langInstruction(lang)}`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: base64,
            },
          },
          {
            type: "text",
            text: "Describe this outfit's overall style, dominant colors and the styles it belongs to.",
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(StylePhotoSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("L'analyse de la tenue a échoué, réessayez.");
  }
  return response.parsed_output;
}

// ---------------------------------------------------------------------------
// Test de colorimétrie (analyse de saison à partir d'une photo du visage)
// ---------------------------------------------------------------------------

const ColorimetrySchema = z.object({
  season: z
    .enum(["Printemps", "Été", "Automne", "Hiver"])
    .describe("Saison colorimétrique dominante"),
  undertone: z
    .enum(["chaud", "froid", "neutre"])
    .describe("Sous-ton de la peau"),
  palette: z
    .array(
      z.object({
        name: z.string().describe("Nom court de la couleur"),
        hex: z.string().describe("Code couleur hexadécimal exact, ex: #c98ba0"),
      }),
    )
    .describe("6 à 10 couleurs qui mettent la personne en valeur, avec leur hex"),
  avoid: z
    .array(
      z.object({
        name: z.string().describe("Nom court de la couleur"),
        hex: z.string().describe("Code couleur hexadécimal exact"),
      }),
    )
    .describe("3 à 6 couleurs à éviter, avec leur hex"),
  description: z
    .string()
    .describe("Explication courte et bienveillante du résultat, 2-3 phrases"),
});

export type ColorimetryAnalysis = z.infer<typeof ColorimetrySchema>;

export async function analyzeColorimetry(
  base64: string,
  mediaType: string,
  lang?: string,
): Promise<ColorimetryAnalysis> {
  const response = await client().messages.parse({
    model: MODEL,
    max_tokens: 1500,
    system:
      `You are an expert in seasonal color analysis (colorimétrie). From a natural face photo (no filter, no makeup, no jewelry), determine the person's seasonal color type, skin undertone, the colors that flatter them and the ones to avoid. Be encouraging and concrete. ${langInstruction(lang)}`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: base64,
            },
          },
          {
            type: "text",
            text: "Perform a seasonal color analysis: season, skin undertone, flattering color palette and colors to avoid.",
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(ColorimetrySchema) },
  });

  if (!response.parsed_output) {
    throw new Error("L'analyse colorimétrique a échoué, réessayez.");
  }
  return response.parsed_output;
}

// ---------------------------------------------------------------------------
// Analyse de morphologie (à partir d'une photo en pied)
// ---------------------------------------------------------------------------

const MorphologySchema = z.object({
  shape: z
    .string()
    .describe("Type de morphologie : Sablier, Triangle, Triangle inversé, Rectangle, ou Ovale"),
  description: z
    .string()
    .describe("Description courte et bienveillante de la morphologie, 1-2 phrases"),
  advice: z
    .array(z.string())
    .describe("4 à 6 conseils concrets pour bien s'habiller selon cette morphologie"),
});

export type MorphologyAnalysis = z.infer<typeof MorphologySchema>;

export async function analyzeMorphology(
  base64: string,
  mediaType: string,
  lang?: string,
): Promise<MorphologyAnalysis> {
  const response = await client().messages.parse({
    model: MODEL,
    max_tokens: 1500,
    system: `You are a kind, body-positive personal stylist. From a full-body silhouette photo, determine the person's body-shape type and give concrete, encouraging advice on how to dress to flatter it. Never comment on weight or make judgments. ${langInstruction(lang)}`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: base64,
            },
          },
          {
            type: "text",
            text: "Determine the body-shape type and give concrete dressing advice to flatter it.",
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(MorphologySchema) },
  });

  if (!response.parsed_output) {
    throw new Error("L'analyse morphologique a échoué, réessayez.");
  }
  return response.parsed_output;
}

// ---------------------------------------------------------------------------
// Détection des logos / imprimés (pour les préserver lors du défroissage)
// ---------------------------------------------------------------------------

const LogoDetectionSchema = z.object({
  logos: z
    .array(
      z.object({
        x: z.number().describe("Left edge of the box, as a fraction 0-1 of image width"),
        y: z.number().describe("Top edge of the box, as a fraction 0-1 of image height"),
        w: z.number().describe("Box width, as a fraction 0-1 of image width"),
        h: z.number().describe("Box height, as a fraction 0-1 of image height"),
      }),
    )
    .describe(
      "Tight bounding boxes around ANYTHING that must stay pixel-identical: printed logos, brand text, graphic prints, AND buttons, button plackets, snaps, zips, studs, buckles, metal hardware and drawcords. Empty if none.",
    ),
  ironable: z
    .boolean()
    .describe(
      "true ONLY if this is a soft fabric garment that can be ironed (tops, dresses, trousers, knitwear…). false for bags, shoes, leather goods, jewelry, watches, sunglasses, hats and other structured/rigid accessories.",
    ),
  kind: z
    .enum(["top", "bottom", "dress", "other"])
    .describe(
      "Coarse type: 'top' (shirt, t-shirt, sweater, jacket), 'bottom' (trousers, jeans, skirt, shorts), 'dress' (dress or jumpsuit), or 'other'.",
    ),
});

export type LogoBox = { x: number; y: number; w: number; h: number };
export type LogoDetection = { logos: LogoBox[]; ironable: boolean; kind: string };

export async function detectLogos(base64: string, mediaType: string): Promise<LogoDetection> {
  const response = await client().messages.parse({
    model: MODEL,
    max_tokens: 1024,
    system:
      "You analyse a single fashion item photo. (1) Locate everything that must stay pixel-identical: printed logos, brand marks, slogans, embroidered emblems, graphic prints, AND buttons, button plackets, snaps, zips, studs, buckles, metal hardware and drawcords — return TIGHT bounding boxes as fractions of the image (0 to 1); ignore plain fabric and seams; empty list if none. (2) Decide whether the item is a soft fabric garment that can be ironed. (3) Give its coarse type (top / bottom / dress / other).",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: base64,
            },
          },
          {
            type: "text",
            text: "Detect logos/prints (bounding boxes) and tell whether this item is an ironable fabric garment.",
          },
        ],
      },
    ],
    output_config: {
      format: zodOutputFormat(LogoDetectionSchema),
    },
  });

  const out = response.parsed_output;
  const logos = (out?.logos ?? [])
    .map((b) => ({
      x: Math.max(0, Math.min(1, b.x)),
      y: Math.max(0, Math.min(1, b.y)),
      w: Math.max(0, Math.min(1, b.w)),
      h: Math.max(0, Math.min(1, b.h)),
    }))
    .filter((b) => b.w > 0.01 && b.h > 0.01 && b.w < 0.95 && b.h < 0.95)
    .slice(0, 12);
  return { logos, ironable: out?.ironable ?? true, kind: out?.kind ?? "other" };
}

// ---------------------------------------------------------------------------
// Génération de tenues complètes
// ---------------------------------------------------------------------------

const OutfitGenerationSchema = z.object({
  outfits: z
    .array(
      z.object({
        title: z.string().describe("Nom évocateur de la tenue, ex: « Velours de minuit »"),
        items: z
          .array(
            z.object({
              garmentId: z.string().describe("ID exact du vêtement de la garde-robe"),
              role: z
                .string()
                .describe("Rôle dans la tenue : haut, bas, robe, veste, chaussures, sac, sacoche, ceinture, chapeau, bijoux, lunettes, foulard, accessoire"),
            }),
          )
          .describe("Vêtements composant la tenue, par ID"),
        explanation: z
          .string()
          .describe("Pourquoi cette tenue fonctionne : météo, occasion, harmonie des couleurs et coupes. 2-3 phrases en français."),
        tips: z.string().describe("Un conseil de styliste pour porter cette tenue"),
      }),
    )
    .describe("4 à 6 propositions de tenues complètes et distinctes"),
});

export interface GenerationContext {
  user: Pick<User, "styles">;
  wardrobe: Garment[];
  weather: WeatherSnapshot | null;
  occasion: string;
  evening: boolean;
  ratedOutfits: Outfit[];
  styleRefs?: { description?: string; colors?: string[]; styles?: string[] }[];
  baseGarment?: Garment;
  colorimetry?: { season: string; undertone: string; palette: string[]; avoid: string[] };
  lang?: string;
}

export interface GeneratedOutfit {
  title: string;
  items: { garmentId: string; role: string }[];
  explanation: string;
  tips: string;
}

export async function generateOutfits(
  ctx: GenerationContext,
): Promise<GeneratedOutfit[]> {
  const wardrobeForPrompt = ctx.wardrobe.map((g) => ({
    id: g.id,
    category: g.category,
    type: g.type,
    cut: g.cut,
    colors: g.colors,
    material: g.material,
    seasons: g.seasons,
    styles: g.styles,
    brand: g.brand || undefined,
    description: g.description || undefined,
    soiree: g.evening,
  }));

  const hasBag = ctx.wardrobe.some((g) => g.category === "sac" || g.category === "sacoche");
  const hasAccessories = ctx.wardrobe.some((g) =>
    ["ceinture", "chapeau", "bijoux", "lunettes", "foulard", "accessoire"].includes(g.category),
  );

  const tasteHistory = ctx.ratedOutfits
    .filter((o) => typeof o.rating === "number")
    .slice(-15)
    .map((o) => ({
      note: o.rating,
      occasion: o.occasion,
      vetements: o.items
        .map((it) => {
          const g = ctx.wardrobe.find((w) => w.id === it.garmentId);
          return g ? `${g.type} ${g.colors.join("/")}` : null;
        })
        .filter(Boolean),
    }));

  const weatherText = ctx.weather
    ? `Météo du jour à ${ctx.weather.city} : ${ctx.weather.condition}, ${ctx.weather.temperature}°C (ressenti ${ctx.weather.feelsLike}°C), vent ${ctx.weather.windSpeed} km/h, probabilité de pluie ${ctx.weather.rainProbability}%, min ${ctx.weather.tempMin}°C / max ${ctx.weather.tempMax}°C.`
    : "Météo non renseignée — propose des tenues polyvalentes pour la saison en cours.";

  const prompt = `GARDE-ROBE DE L'UTILISATEUR (JSON) :
${JSON.stringify(wardrobeForPrompt, null, 1)}

CONTEXTE :
- ${weatherText}
- Occasion : ${ctx.occasion}
- Mode soirée : ${ctx.evening ? "OUI — privilégie strictement les vêtements marqués soiree:true, et ne complète avec d'autres pièces que si indispensable." : "non"}
- Styles préférés de l'utilisateur : ${ctx.user.styles.join(", ") || "non précisés"}${
    ctx.baseGarment
      ? `\n- PIÈCE IMPOSÉE : CHAQUE tenue DOIT obligatoirement inclure ce vêtement (id: ${ctx.baseGarment.id} — ${ctx.baseGarment.type} ${ctx.baseGarment.colors.join("/")}), et être composée AUTOUR de lui. Propose différentes façons de le porter.`
      : ""
  }

HISTORIQUE DES NOTES (1 à 5, apprends les goûts de l'utilisateur — favorise ce qui ressemble aux tenues notées 4-5, évite ce qui ressemble aux tenues notées 1-2) :
${tasteHistory.length ? JSON.stringify(tasteHistory, null, 1) : "Aucune note pour l'instant."}

TENUES DE RÉFÉRENCE DE L'UTILISATEUR (photos de tenues qu'il/elle porte déjà dans la vraie vie — inspire-toi fortement de ces associations, coupes et palettes pour rester FIDÈLE à son style personnel) :
${ctx.styleRefs && ctx.styleRefs.length ? JSON.stringify(ctx.styleRefs, null, 1) : "Aucune photo de référence fournie."}

COLORIMÉTRIE DE L'UTILISATEUR (analyse de saison — privilégie les couleurs qui le/la mettent en valeur, évite celles à proscrire, sans jamais exclure une pièce indispensable de la garde-robe) :
${ctx.colorimetry ? `Saison ${ctx.colorimetry.season}, sous-ton ${ctx.colorimetry.undertone}. À privilégier : ${ctx.colorimetry.palette.join(", ")}. À éviter : ${ctx.colorimetry.avoid.join(", ")}.` : "Non renseignée."}

RÈGLES DE COMPOSITION :
1. Utilise UNIQUEMENT des vêtements présents dans la garde-robe, référencés par leur id exact.
2. Chaque tenue doit comporter : un haut + un bas (OU une robe OU une combinaison), et des chaussures. ${hasBag ? "Ajoute un sac ou sacoche adapté(e)." : "Aucun sac dans la garde-robe : n'en propose pas."} ${hasAccessories ? "Enrichis la tenue avec des accessoires pertinents disponibles (ceinture, bijoux, chapeau, lunettes, foulard…)." : "Aucun accessoire disponible : n'en propose pas."}
3. Ajoute une veste/manteau si la météo le justifie (froid, vent, pluie).
4. Adapte matières et coupes à la température ressentie, au vent et à la pluie.
5. Respecte l'occasion et les styles préférés.
6. Propose 4 à 6 tenues VARIÉES et bien distinctes les unes des autres (styles, couleurs, associations différentes) si la garde-robe le permet ; sinon propose-en le plus possible.`;

  const response = await client().messages.parse({
    model: MODEL,
    max_tokens: 8192,
    thinking: { type: "adaptive" },
    system:
      `${FASHION_BRAIN}\n\nYou compose harmonious, realistic and flattering outfits from the user's actual wardrobe, taking into account the weather, the occasion and their tastes. ${langInstruction(ctx.lang)}`,
    messages: [{ role: "user", content: prompt }],
    output_config: {
      format: zodOutputFormat(OutfitGenerationSchema),
    },
  });

  if (!response.parsed_output) {
    throw new Error("La génération de tenues a échoué, réessayez.");
  }

  // Valide que chaque ID existe réellement dans la garde-robe.
  const validIds = new Set(ctx.wardrobe.map((g) => g.id));
  const base = ctx.baseGarment;
  return response.parsed_output.outfits
    .map((o) => {
      let items = o.items.filter((it) => validIds.has(it.garmentId));
      // Garantit que la pièce imposée est bien présente dans chaque tenue
      if (base && !items.some((it) => it.garmentId === base.id)) {
        items = [{ garmentId: base.id, role: base.category }, ...items];
      }
      return { ...o, items };
    })
    .filter((o) => o.items.length >= 2);
}

// ---------------------------------------------------------------------------
// Mode Voyage : tenues par jour + liste d'affaires
// ---------------------------------------------------------------------------

const TripOutfitsSchema = z.object({
  outfits: z
    .array(
      z.object({
        day: z.number().describe("Numéro du jour (1, 2, 3…)"),
        occasion: z.string().describe("Occasion de la tenue ce jour-là"),
        title: z.string().describe("Nom évocateur de la tenue"),
        items: z
          .array(
            z.object({
              garmentId: z.string().describe("ID exact du vêtement de la garde-robe"),
              role: z.string().describe("Rôle : haut, bas, robe, veste, chaussures, sac, accessoire…"),
            }),
          )
          .describe("Vêtements composant la tenue, par ID"),
        explanation: z.string().describe("Pourquoi cette tenue convient (météo, occasion). 1-2 phrases."),
        tips: z.string().describe("Un conseil de style"),
      }),
    )
    .describe("Une tenue par jour de voyage"),
});

export interface TripContext {
  user: Pick<User, "styles">;
  wardrobe: Garment[];
  weather: WeatherSnapshot | null;
  destination: string;
  days: number;
  occasions: string[];
  planning?: { day: number; occasion: string }[];
  colorimetry?: { season: string; undertone: string; palette: string[]; avoid: string[] };
  styleRefs?: { description?: string; colors?: string[]; styles?: string[] }[];
  avoidTitles?: string[];
  lang?: string;
}

export async function generateTripOutfits(ctx: TripContext): Promise<
  { day: number; occasion: string; title: string; items: { garmentId: string; role: string }[]; explanation: string; tips: string }[]
> {
  const wardrobeForPrompt = ctx.wardrobe.map((g) => ({
    id: g.id,
    category: g.category,
    type: g.type,
    cut: g.cut,
    colors: g.colors,
    material: g.material,
    seasons: g.seasons,
    styles: g.styles,
    soiree: g.evening,
  }));

  const weatherText = ctx.weather
    ? `Météo à ${ctx.weather.city} : ${ctx.weather.condition}, ${ctx.weather.temperature}°C (ressenti ${ctx.weather.feelsLike}°C), vent ${ctx.weather.windSpeed} km/h, pluie ${ctx.weather.rainProbability}%, min ${ctx.weather.tempMin}°C / max ${ctx.weather.tempMax}°C.`
    : "Météo non renseignée — adapte-toi au climat habituel de la destination pour la saison en cours.";

  const planningText = ctx.planning && ctx.planning.length
    ? `PLANNING IMPOSÉ (jour → occasion) : ${JSON.stringify(ctx.planning)}`
    : `Occasions prévues sur place : ${ctx.occasions.join(", ") || "polyvalent"}. Répartis-les harmonieusement sur les ${ctx.days} jours.`;

  const prompt = `GARDE-ROBE (JSON) :
${JSON.stringify(wardrobeForPrompt, null, 1)}

VOYAGE :
- Destination : ${ctx.destination}
- ${weatherText}
- Durée : ${ctx.days} jour(s)
- ${planningText}
- Styles préférés : ${ctx.user.styles.join(", ") || "non précisés"}
${ctx.colorimetry ? `- Colorimétrie : saison ${ctx.colorimetry.season}, à privilégier ${ctx.colorimetry.palette.join(", ")}.` : ""}

RÈGLES :
1. Compose EXACTEMENT une tenue par jour (${ctx.days} tenues), numérotées de 1 à ${ctx.days}.
2. Utilise UNIQUEMENT des vêtements de la garde-robe (id exact).
3. OBLIGATOIRE — chaque tenue doit être COMPLÈTE : soit un HAUT + un BAS (pantalon, jupe ou short), soit une ROBE, soit une COMBINAISON. JAMAIS un haut sans bas. Ajoute toujours une paire de chaussures.
4. SOIS CRÉATIF et VARIÉ : change un maximum de pièces d'un jour à l'autre, évite de répéter les mêmes associations, ose des combinaisons originales (couleurs, superpositions, accessoires variés). Chaque jour doit avoir un caractère distinct.
5. Adapte chaque tenue à la météo et à l'occasion du jour, et indique l'occasion.${
    ctx.avoidTitles && ctx.avoidTitles.length
      ? `\n6. Propose des tenues DIFFÉRENTES de celles déjà suggérées : ${ctx.avoidTitles.slice(0, 20).join("; ")}.`
      : ""
  }`;

  const response = await client().messages.parse({
    model: MODEL,
    max_tokens: 8192,
    thinking: { type: "adaptive" },
    system: `${FASHION_BRAIN}\n\nYou are planning a travel capsule wardrobe from the user's real wardrobe, one outfit per day, adapted to the destination weather and each day's occasion. ${langInstruction(ctx.lang)}`,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: zodOutputFormat(TripOutfitsSchema) },
  });

  if (!response.parsed_output) throw new Error("La composition du voyage a échoué, réessayez.");
  const catById = new Map(ctx.wardrobe.map((g) => [g.id, g.category]));
  return response.parsed_output.outfits
    .map((o) => ({ ...o, items: o.items.filter((it) => catById.has(it.garmentId)) }))
    .filter((o) => {
      const cats = o.items.map((it) => catById.get(it.garmentId));
      const hasBottom = cats.some((c) => c === "bas" || c === "robe" || c === "combinaison");
      const hasTop = cats.some(
        (c) => c === "haut" || c === "veste" || c === "robe" || c === "combinaison",
      );
      // Keep only complete outfits (no top without a bottom)
      return o.items.length >= 2 && hasBottom && hasTop;
    });
}

const PackingListSchema = z.object({
  categories: z
    .array(
      z.object({
        name: z.string().describe("Nom de la catégorie (ex: Hygiène, Documents, Accessoires…)"),
        items: z.array(z.string()).describe("Affaires à emporter dans cette catégorie"),
      }),
    )
    .describe("Liste d'affaires à emporter, regroupée par catégorie"),
});

export type PackingList = z.infer<typeof PackingListSchema>;

export async function generatePackingList(ctx: {
  destination: string;
  days: number;
  occasions: string[];
  weather: WeatherSnapshot | null;
  lang?: string;
}): Promise<PackingList> {
  const weatherText = ctx.weather
    ? `Météo : ${ctx.weather.condition}, ${ctx.weather.temperature}°C (min ${ctx.weather.tempMin}/max ${ctx.weather.tempMax}), pluie ${ctx.weather.rainProbability}%.`
    : "Climat selon la destination et la saison.";
  const prompt = `Établis une liste d'affaires à emporter pour ce voyage (hors tenues déjà prévues, mais inclus sous-vêtements, pyjama, etc.).
- Destination : ${ctx.destination}
- Durée : ${ctx.days} jour(s)
- Occasions : ${ctx.occasions.join(", ") || "polyvalent"}
- ${weatherText}
Regroupe par catégories : Hygiène & beauté, Sous-vêtements & basiques, Accessoires, Électronique, Documents & argent, Santé, et tout ce qui est spécifique à la destination/météo (ex: crème solaire, parapluie, adaptateur…). Sois concret et complet sans excès.`;

  const response = await client().messages.parse({
    model: MODEL,
    max_tokens: 2048,
    system: `You write practical, complete travel packing checklists adapted to the destination, weather and trip length. ${langInstruction(ctx.lang)}`,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: zodOutputFormat(PackingListSchema) },
  });
  if (!response.parsed_output) throw new Error("La liste d'affaires a échoué, réessayez.");
  return response.parsed_output;
}

// ---------------------------------------------------------------------------
// Suggestion de remplacement (« laissez l'IA choisir »)
// ---------------------------------------------------------------------------

const SwapSuggestionSchema = z.object({
  garmentId: z.string().describe("ID exact du vêtement choisi parmi les candidats"),
});

export async function suggestReplacement(ctx: {
  keep: { type: string; colors: string[]; category: string }[];
  candidates: { id: string; type: string; colors: string[]; material: string; styles: string[]; category: string }[];
  occasion?: string;
  lang?: string;
}): Promise<string | null> {
  if (!ctx.candidates.length) return null;
  const prompt = `Le reste de la tenue (à garder) : ${JSON.stringify(ctx.keep)}
Occasion : ${ctx.occasion || "non précisée"}
Choisis, PARMI ces candidats uniquement, le vêtement qui complète le mieux la tenue (harmonie des couleurs, des coupes et du style). Réponds avec son id exact.
Candidats : ${JSON.stringify(ctx.candidates)}`;

  const response = await client().messages.parse({
    model: MODEL,
    max_tokens: 512,
    system: `${FASHION_BRAIN}\n\nYou pick the single best garment from a candidate list to complete an outfit. ${langInstruction(ctx.lang)}`,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: zodOutputFormat(SwapSuggestionSchema) },
  });
  const id = response.parsed_output?.garmentId;
  return id && ctx.candidates.some((c) => c.id === id) ? id : ctx.candidates[0].id;
}

// ---------------------------------------------------------------------------
// Assistant achat : composer une tenue autour d'un article photographié
// ---------------------------------------------------------------------------

const ShopAnalysisSchema = z.object({
  name: z.string().describe("Nom court de l'article"),
  category: z.string().describe("Catégorie : haut, bas, robe, combinaison, veste, chaussures, sac, accessoire…"),
  colors: z.array(z.string()).describe("Couleurs dominantes, max 3"),
  description: z.string().describe("Description courte et élégante, 1 phrase"),
});

const ShopOutfitsSchema = z.object({
  outfits: z
    .array(
      z.object({
        title: z.string(),
        items: z.array(z.object({ garmentId: z.string(), role: z.string() })),
        explanation: z.string().describe("Pourquoi cette tenue met en valeur l'article, 1-2 phrases"),
      }),
    )
    .describe("2 à 3 façons d'associer l'article avec la garde-robe"),
});

export async function analyzeAndPairItem(
  base64: string,
  mediaType: string,
  wardrobe: Garment[],
  lang?: string,
): Promise<{
  item: { name: string; category: string; colors: string[]; description: string };
  outfits: { title: string; items: { garmentId: string; role: string }[]; explanation: string }[];
}> {
  // 1. Analyse de l'article
  const analysis = await client().messages.parse({
    model: MODEL,
    max_tokens: 1024,
    system: `You analyse a single fashion item the user is considering buying. ${langInstruction(lang)}`,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
              data: base64,
            },
          },
          { type: "text", text: "Identify this item: name, category, colors, short description." },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(ShopAnalysisSchema) },
  });
  const item = analysis.parsed_output ?? {
    name: "Article",
    category: "accessoire",
    colors: [],
    description: "",
  };

  // 2. Compose des tenues de la garde-robe autour de l'article (non possédé)
  const wardrobeForPrompt = wardrobe.map((g) => ({
    id: g.id,
    category: g.category,
    type: g.type,
    colors: g.colors,
    material: g.material,
    styles: g.styles,
  }));
  const prompt = `ARTICLE ENVISAGÉ À L'ACHAT (non encore possédé) : ${JSON.stringify(item)}
GARDE-ROBE DE L'UTILISATEUR (JSON) : ${JSON.stringify(wardrobeForPrompt, null, 1)}
Propose 2 à 3 tenues qui associent cet article avec des vêtements de la garde-robe (référencés par id exact). N'inclus PAS l'article lui-même dans items (il n'a pas d'id) — uniquement les pièces de la garde-robe qui vont avec. Chaque tenue doit être complète et cohérente avec l'article.`;

  const compose = await client().messages.parse({
    model: MODEL,
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    system: `${FASHION_BRAIN}\n\nYou show how a not-yet-owned item would pair with the user's existing wardrobe. ${langInstruction(lang)}`,
    messages: [{ role: "user", content: prompt }],
    output_config: { format: zodOutputFormat(ShopOutfitsSchema) },
  });

  const validIds = new Set(wardrobe.map((g) => g.id));
  const outfits = (compose.parsed_output?.outfits ?? [])
    .map((o) => ({ ...o, items: o.items.filter((it) => validIds.has(it.garmentId)) }))
    .filter((o) => o.items.length >= 1);

  return { item, outfits };
}
