# CLAUDE.md — Instructions pour Claude Code

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
- React + TypeScript + Vite + Tailwind CSS v4
- Zustand pour le state management
- Supabase pour l'auth et la persistence
- Leaflet pour la cartographie
- Déploiement sur Vercel
