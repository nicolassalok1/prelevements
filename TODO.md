# TODO

## Test manuel sur Vercel — refactor fieldDetail + map (branche `main`, commit `d27f07a`)

Après le refactor qui a découpé FieldDetailPanel (1248 → 80 l) et MapView (841 → 519 l),
ces chemins critiques n'ont pas de couverture e2e. À valider à la main avant de
considérer le refactor terminé :

- [ ] **Chargement initial (F5)** — sur une exploitation avec parcelles + champs + serres,
      toutes les couches Leaflet doivent réapparaître (teste `restorePersistedData`).
- [ ] **Dessin parcelle** — sidebar → "Dessiner la parcelle" → cliquer les sommets → bouton
      "Valider" du header termine le tracé.
- [ ] **Édition de contour** — clic sur une parcelle existante → "Modifier contour" → déplacer
      un vertex → "Valider" dans le header enregistre.
- [ ] **FieldDetailPanel — navigation entre tabs** — ouvrir une parcelle, naviguer
      Infos → Culture → Arrosage → Engrais → Autres → Sol → Relief sans crash.
- [ ] **Serre — wizard batch** — ouvrir une serre, onglet "Germination", "+ Nouveau batch" →
      étape 1 (infos) → étape 2 (plaques) → création OK + 3 jalons ajoutés à l'agenda.

Si une de ces étapes foire, me prévenir avec l'étape et le symptôme — tous les
tests auto passent côté code (261 verts), donc un bug ici sera forcément un bug
d'intégration Leaflet, localisé dans `src/utils/map*.ts` ou dans un des fichiers
`src/components/fieldDetail/*.tsx` déplacés.
