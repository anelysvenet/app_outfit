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
    .enum(["haut", "bas", "robe", "veste", "chaussures", "sac", "sacoche", "ceinture", "chapeau", "bijoux", "lunettes", "foulard", "accessoire"])
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
      `You are an expert fashion stylist with 20 years of experience. You analyze garment photos to catalogue a wardrobe. Your responses are precise. ${langInstruction(lang)}`,
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
    .describe("1 à 3 propositions de tenues complètes"),
});

export interface GenerationContext {
  user: Pick<User, "styles">;
  wardrobe: Garment[];
  weather: WeatherSnapshot | null;
  occasion: string;
  evening: boolean;
  ratedOutfits: Outfit[];
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
- Styles préférés de l'utilisateur : ${ctx.user.styles.join(", ") || "non précisés"}

HISTORIQUE DES NOTES (1 à 5, apprends les goûts de l'utilisateur — favorise ce qui ressemble aux tenues notées 4-5, évite ce qui ressemble aux tenues notées 1-2) :
${tasteHistory.length ? JSON.stringify(tasteHistory, null, 1) : "Aucune note pour l'instant."}

RÈGLES DE COMPOSITION :
1. Utilise UNIQUEMENT des vêtements présents dans la garde-robe, référencés par leur id exact.
2. Chaque tenue doit comporter : un haut + un bas (OU une robe), et des chaussures. ${hasBag ? "Ajoute un sac ou sacoche adapté(e)." : "Aucun sac dans la garde-robe : n'en propose pas."} ${hasAccessories ? "Enrichis la tenue avec des accessoires pertinents disponibles (ceinture, bijoux, chapeau, lunettes, foulard…)." : "Aucun accessoire disponible : n'en propose pas."}
3. Ajoute une veste/manteau si la météo le justifie (froid, vent, pluie).
4. Adapte matières et coupes à la température ressentie, au vent et à la pluie.
5. Respecte l'occasion et les styles préférés.
6. Propose 2 à 3 tenues distinctes si la garde-robe le permet, sinon 1.`;

  const response = await client().messages.parse({
    model: MODEL,
    max_tokens: 4096,
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
  return response.parsed_output.outfits
    .map((o) => ({
      ...o,
      items: o.items.filter((it) => validIds.has(it.garmentId)),
    }))
    .filter((o) => o.items.length >= 2);
}
