# CLAUDE.md — Instructions pour Claude Code

## Mode opératoire

- **Autonomie maximale** sur opérations locales réversibles (code, tests, refactor, type-check, lint, build local). Ne pas demander de permission.
- **Confirmation requise** pour : actions destructives (rm -rf, force-push, reset --hard), envois externes (ouverture PR, messages, emails), engagements financiers, modifications Supabase prod qui cassent la rétro-compat du JSONB.
- Lancer `npm test` + `npm run lint` + `npm run build` après chaque modification significative.
- Si un build casse, le corriger immédiatement.
- Commits conventionnels avec scope (`feat(map):`, `fix(ui):`, `refactor(fieldDetail):`, etc.).
- **Répondre toujours en français.**

## Standards de code

- **TypeScript strict** : pas de `any`, `unknown` à défaut.
- **i18n obligatoire** : aucun texte en dur dans le JSX — toujours `useTranslation()`. Fichiers dans `src/i18n/`.
- **Tailwind CSS 4** pour tout le styling — pas de CSS modules, pas de styled-components.
- **Zustand** pour tout le state partagé/persisté — pas de Context API pour ça.
- **Mobile-first** : tester en responsive avant de merger (safe-area, FAB, sidebar compacte).
- **Composants en .tsx, utils/types/lib en .ts**.
- **Un composant par fichier** pour les gros composants (shell + tabs extraits).

## Règles de développement

### Compatibilité base de données (Supabase)
À chaque modification du code qui touche la persistence des données (types, store, persistence.ts) :
1. Vérifier que les nouveaux champs sont ajoutés dans `PersistedField`, `PersistedChamp`, et `PersistedData`
2. Vérifier que `buildPersistedData()` sérialise les nouveaux champs
3. Vérifier que `normalizePersistedData()` fournit des valeurs par défaut pour la rétro-compatibilité
4. Vérifier que le type de `updateField` dans AppState accepte les nouveaux champs
5. La table Supabase `user_data` stocke un JSONB — pas besoin de migration SQL pour les champs de données, mais si la structure de la table elle-même change, appliquer la migration via le MCP Supabase ou fournir le SQL à exécuter

### Architecture de persistence
- Table unique `user_data` avec `user_id` (UUID) et `data` (JSONB)
- Tout le state de l'app est dans le JSONB — pas de tables relationnelles
- RLS activé : chaque user ne voit que ses données
- Double persistence : localStorage (cache rapide) + Supabase (cloud, debounce 1s)

### Strains par défaut
Les strains Cali par défaut sont : Cali Water, Mochi Coco, One Hitter, Yuzu
Elles sont définies dans `DEFAULT_CALI_STRAINS` dans `src/components/fieldDetail/CultureTab.tsx`.

### Structure modulaire FieldDetailPanel
FieldDetailPanel.tsx n'est qu'une shell. Chaque tab vit dans `src/components/fieldDetail/` :
- shell routing : `FieldDetailPanel.tsx`
- helpers partagés : `shared.tsx` (`useField`, `Label`, `Empty`, `StatCard`, `*_LABELS`)
- activités : `activityList.tsx` (`QuickAddActivityButton`, `ActivityList`)
- tabs : `InfoTab.tsx`, `CultureTab.tsx`, `WateringTab.tsx`, `AmendmentsTab.tsx`, `OtherActivitiesTab.tsx`, `SoilTab.tsx`, `ReliefTab.tsx`, `BatchesTab.tsx`

### Structure modulaire MapView
MapView.tsx délègue la logique non-React à `src/utils/map*.ts` :
- `mapRenderers.ts` : singleton `globalMap` (`getMap`/`setMap`/`clearMap`), `createPointIcon`, `renderChampOnMap`
- `mapRestore.ts` : `restorePersistedData` (hydrate store + layers au chargement)
- `mapDrawControls.ts` : `setDrawHandler` + `finishDraw`/`cancelDraw`/`finishEdit`/`cancelEdit` (boutons Valider/Annuler du Header)

MapView ré-exporte ces fonctions pour que Header et FieldList continuent d'importer depuis `./MapView`.

### Stack
- React 19 + TypeScript 5.9 strict + Vite 8
- Tailwind CSS 4 (plugin Vite `@tailwindcss/vite`)
- Zustand 5 pour le state management
- Supabase (`@supabase/supabase-js` 2.103) pour l'auth et la persistence
- Leaflet 1.9 + `leaflet-draw` + `react-leaflet` 5 pour la cartographie
- Turf.js (`@turf/helpers`, `@turf/union`) pour les calculs géo
- i18next 26 + react-i18next 17 pour l'i18n
- Vitest 4 + Testing Library + happy-dom pour les tests
- Déploiement sur Vercel (auto-deploy sur push `main`)

## Pointeurs externes

### Vault Obsidian — knowledge base projet
- `10-projects/BeldiFarmer/00-index.md` — index + snapshot
- `10-projects/BeldiFarmer/10-architecture/overview.md` — stack complète + patterns (Zustand, JSONB, MapView modulaire, FieldDetailPanel 8 tabs, i18n, mobile-first)
- `10-projects/BeldiFarmer/10-architecture/persistence-jsonb.md` — **pattern JSONB détaillé**, checklist à suivre à chaque nouveau champ persisté, pièges de rétro-compat
- `10-projects/BeldiFarmer/30-features/map-and-field-detail.md` — découpage MapView + utils + les 8 tabs FieldDetailPanel
- `10-projects/BeldiFarmer/50-ops/env-and-deploy.md` — env vars, Vercel, Supabase, edge functions, checklist avant release

### Docs libraries
Pour tout ce qui touche Leaflet / leaflet-draw / react-leaflet / Zustand / Supabase / Turf / i18next / Tailwind CSS 4 / Vite 8 / Vitest 4 / React 19 → **utiliser MCP `context7`** (resolve-library-id puis query-docs). Le training data est souvent périmé sur ces libs qui bougent vite, notamment l'écosystème carto.

### Skills réutilisables
- **`dev-beldifarmer`** — skill dédiée (patterns, pièges, stack). Auto-triggerée sur les mots-clés projet.
- **`frontend-design-mentor`** — pour questions design / palette / composants / mobile UX.

## Principes de code transverses
Les **4 principes Karpathy** du CLAUDE.md global s'appliquent :
- **Think before coding** : hypothèses explicites, demander si flou, ne pas implémenter en silence.
- **Simplicity First** : pas de feature au-delà de la demande, pas d'abstraction prématurée.
- **Surgical Changes** : toucher uniquement ce qui est demandé, pas d'amélioration adjacente non demandée.
- **Goal-Driven Execution** : critères de succès vérifiables (tests qui reproduisent le bug, tests qui passent).
