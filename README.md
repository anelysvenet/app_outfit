# AURA — Votre styliste personnel propulsé par l'IA

Application web (Next.js) qui transforme votre garde-robe en dressing intelligent :
photographiez vos vêtements, l'IA les analyse, puis compose des **tenues complètes**
adaptées à la **météo du jour**, à l'**occasion** et à **vos goûts**.

## Fonctionnalités

- **Import de la garde-robe par photos** — pour chaque pièce : description courte,
  coupe, couleur, matière, style, saison, marque (facultative).
- **Analyse IA automatique des photos** (Claude, vision + structured outputs) :
  type de vêtement, coupe (ajustée, droite, oversize, slim…), couleurs, matière,
  saisons, styles, aptitude « soirée ».
- **Génération de tenues complètes** à partir des vêtements réellement présents :
  haut + bas (ou robe) + chaussures + sac (*uniquement s'il y en a un dans le
  dressing*) + accessoires + veste si la météo l'exige.
- **Recommandations météo** : température, ressenti, vent, pluie, min/max via
  Open-Meteo — par **géolocalisation** ou par **villes ajoutées manuellement**
  (mémorisées dans le profil).
- **Occasions** : travail, sortie, soirée, voyage, rendez-vous, sport…
- **Styles à l'inscription** : Classique, Élégant, Décontracté, Urbain, Vintage,
  Sportswear, Streetwear, Minimaliste, Chic, Business casual (multi-sélection).
- **Apprentissage des goûts** : notation 1–5 de chaque tenue ; l'historique des
  notes est injecté dans le prompt de génération pour affiner les propositions.
- **Section Soirée** dédiée (ambiance nocturne) : classez vos pièces « soirée »,
  l'IA compose des tenues d'événement à partir de cette sélection.
- **Essayage virtuel** : avec une photo en pied (inscription ou profil), la tenue
  est appliquée sur votre silhouette. Rendu réaliste via fal.ai (IDM‑VTON) si
  `FAL_KEY` est configurée ; sinon, rendu « lookbook » élégant en local.

## Démarrage

```bash
cp .env.example .env       # puis renseignez ANTHROPIC_API_KEY
npm install
npm run dev                # http://localhost:3000
```

### Variables d'environnement

| Variable            | Obligatoire | Rôle                                                    |
| ------------------- | ----------- | ------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | ✅          | Analyse des photos + génération des tenues (Claude)     |
| `AUTH_SECRET`       | —           | Signature des sessions (auto-généré dans `data/` sinon) |
| `FAL_KEY`           | —           | Essayage virtuel réaliste (fal.ai IDM-VTON)             |

## Architecture

- **Next.js 15 (App Router) + TypeScript + Tailwind 4 + Framer Motion**
- **IA** : `@anthropic-ai/sdk` — modèle `claude-opus-4-8`, vision + structured
  outputs (`zodOutputFormat`) pour des réponses JSON garanties valides.
- **Météo** : Open-Meteo (géocodage + prévisions), gratuit et sans clé.
- **Données** : stockage JSON local (`data/db.json`) + uploads (`data/uploads/`),
  zéro dépendance native — facilement remplaçable par Postgres/Prisma en prod.
- **Auth** : sessions signées HMAC (cookie httpOnly), mots de passe hashés scrypt.

```
src/
├── app/
│   ├── page.tsx               # Landing
│   ├── login/ · signup/       # Auth (inscription en 3 étapes avec styles + photo)
│   ├── (app)/
│   │   ├── dressing/          # Garde-robe + ajout/analyse IA
│   │   ├── generer/           # Météo + occasion → génération de tenues
│   │   ├── tenues/            # Historique + notation
│   │   ├── soiree/            # Section Soirée (sélection nocturne)
│   │   └── profil/            # Styles, villes, photo en pied
│   └── api/                   # auth, garments, weather, outfits, tryon, files
├── components/                # Nav, Modal, GarmentForm, OutfitCard, Stars…
└── lib/                       # ai.ts, weather.ts, tryon.ts, db.ts, auth.ts…
```
