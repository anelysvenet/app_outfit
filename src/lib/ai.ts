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
});

export type LogoBox = { x: number; y: number; w: number; h: number };
export type LogoDetection = { logos: LogoBox[]; ironable: boolean };

export async function detectLogos(base64: string, mediaType: string): Promise<LogoDetection> {
  const response = await client().messages.parse({
    model: MODEL,
    max_tokens: 1024,
    system:
      "You analyse a single fashion item photo. (1) Locate everything that must stay pixel-identical: printed logos, brand marks, slogans, embroidered emblems, graphic prints, AND buttons, button plackets, snaps, zips, studs, buckles, metal hardware and drawcords — return TIGHT bounding boxes as fractions of the image (0 to 1); ignore plain fabric and seams; empty list if none. (2) Decide whether the item is a soft fabric garment that can be ironed.",
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
  return { logos, ironable: out?.ironable ?? true };
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
      `You are an exceptional artistic director and personal stylist. You compose harmonious, realistic and flattering outfits from the user's actual wardrobe, taking into account the weather, the occasion and their tastes. ${langInstruction(ctx.lang)}`,
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
