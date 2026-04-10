import { useAppStore } from '../store/useAppStore'

/**
 * Help modal — condensed, up-to-date walkthrough of the v7 feature set.
 * The copy is structured around the way a field manager actually uses
 * the app day-to-day, not around abstract technical concepts.
 */
export function HelpModal() {
  const open = useAppStore((s) => s.helpOpen)
  const setHelpOpen = useAppStore((s) => s.setHelpOpen)

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/60 z-[10000] flex items-center justify-center"
      onClick={(e) => { if (e.target === e.currentTarget) setHelpOpen(false) }}
    >
      <div className="bg-panel border border-border p-4 md:p-7 w-full h-full md:w-[92vw] md:max-w-[680px] md:h-auto md:max-h-[88vh] overflow-y-auto relative scrollbar-thin scrollbar-thumb-border">
        <button
          onClick={() => setHelpOpen(false)}
          className="absolute top-3 right-4 bg-transparent border-none text-muted text-xl cursor-pointer hover:text-red transition-colors"
        >
          ✕
        </button>

        <h2 className="font-mono text-sm text-olive-lit tracking-[2px] mb-1 pr-8">
          ANRAC — GESTION EXPLOITATION
        </h2>
        <p className="text-[12px] text-muted leading-relaxed mb-5">
          Outil de gestion de terrain : cartographie des zones, suivi des activités
          quotidiennes, dépenses, prélèvements GPS et analyse du relief.
        </p>

        {/* ── 1. Mise en place ── */}
        <Section title="1 · METTRE EN PLACE L'EXPLOITATION">
          <p className="mb-2">
            Ouvrez la sidebar gauche avec le bouton <Kbd>☰</Kbd> en haut à
            gauche. Elle glisse par-dessus la carte et contient tous les outils
            de dessin.
          </p>
          <Bullet>
            <b>Dessiner l'exploitation</b> — le périmètre global de votre
            terrain. Cliquez les sommets sur la carte, double-cliquez pour
            fermer le polygone.
          </Bullet>
          <Bullet>
            <b>Ajouter un champ / zone</b> — à l'intérieur de l'exploitation,
            dessinez chaque zone cultivable. Donnez-lui un nom avant de
            commencer à dessiner.
          </Bullet>
          <Bullet>
            <b>Modifier un contour</b> — bouton <Kbd>✎</Kbd> sur une zone →
            déplacez les sommets sur la carte → <Kbd>✓ Valider</Kbd>. Le
            relief est automatiquement recalculé.
          </Bullet>
        </Section>

        {/* ── 2. Suivi quotidien ── */}
        <Section title="2 · SUIVRE LES ACTIVITÉS (AGENDA)">
          <p className="mb-2">
            Le bouton <Kbd>◰ AGENDA</Kbd> de la sidebar droite ouvre le
            calendrier. Cliquez un jour puis <Kbd>+ Activité</Kbd> pour
            enregistrer une action. Quatre types sont disponibles&nbsp;:
          </p>
          <Bullet>
            <b className="text-cyan">Arrosage</b> — méthode, temps d'arrosage
            (min) et débit (L/h). Volume estimé calculé automatiquement.
          </Bullet>
          <Bullet>
            <b className="text-olive-lit">Engrais</b> — catégorie + type libre
            (ex. NPK 15-15-15), produit, quantité (kg) et nombre d'ouvriers.
          </Bullet>
          <Bullet>
            <b className="text-amber">Autre</b> — titre libre (désherbage,
            taille, récolte…) + nombre d'ouvriers. Bouton <i>Toutes les
            zones</i> pour sélectionner l'exploitation entière d'un clic.
          </Bullet>
          <Bullet>
            <b className="text-red">Dépense</b> — montant en DH, catégorie
            (Carburant, Matériel, …). Les dépenses sont globales et requièrent
            une description dans les notes.
          </Bullet>
          <p className="mt-2 text-muted">
            Les arrosages, engrais et autres activités s'affichent ensuite
            dans les onglets correspondants du détail d'une zone.
          </p>
        </Section>

        {/* ── 3. Points de prélèvement ── */}
        <Section title="3 · POINTS DE PRÉLÈVEMENT GPS">
          <p className="mb-2">
            Sur chaque zone dans la sidebar droite, bouton <Kbd>⊕ Ajouter
            point</Kbd> pour enregistrer un prélèvement précis&nbsp;:
          </p>
          <Bullet><b>Clic sur la carte</b> — à l'endroit voulu (doit être dans le champ).</Bullet>
          <Bullet><b>Saisie GPS manuelle</b> — lat/lng au clavier dans le formulaire.</Bullet>
          <Bullet>
            <b>Bouton « Point ici »</b> — utilise la position GPS live de
            votre appareil (cluster <Kbd>⊙</Kbd> sous les contrôles de zoom).
            Précision et altitude stockées automatiquement.
          </Bullet>
          <p className="mt-2 text-muted">
            Chaque point peut recevoir une note libre et être renommé par
            double-clic.
          </p>
        </Section>

        {/* ── 4. Relief / 3D ── */}
        <Section title="4 · RELIEF ET VUE 3D">
          <p className="mb-2">
            Détail d'une zone → onglet <b>RELIEF</b>. Le relief (altitude
            min/max, pente, exposition, ensoleillement moyen) est
            <b> calculé automatiquement</b> dès la création de la zone via
            le DEM SRTM et l'historique ensoleillement Open-Meteo.
          </p>
          <Bullet>
            Badge <Kbd>AUTO</Kbd> — valeurs auto-calculées, mises à jour si
            le contour change.
          </Bullet>
          <Bullet>
            Badge <Kbd>MANUEL</Kbd> — dès que vous modifiez un champ à la
            main, les valeurs sont verrouillées.
          </Bullet>
          <Bullet>
            Bouton <Kbd>✨ Recalculer</Kbd> — force un nouveau calcul sur
            demande.
          </Bullet>
        </Section>

        {/* ── 5. Archivage ── */}
        <Section title="5 · ARCHIVER UNE ZONE">
          <p>
            Bouton <Kbd>◱</Kbd> sur la zone → modal avec option de
            <b> réattribuer ses activités</b> à d'autres zones avant
            archivage. La zone archivée disparaît des listes actives mais
            reste visible dans la section <i>Archives</i> en bas de la
            sidebar droite (bouton afficher/masquer sur la carte, bouton ↶
            pour désarchiver).
          </p>
        </Section>

        {/* ── 6. Sauvegarde ── */}
        <Section title="6 · SAUVEGARDE">
          <p>
            Sidebar gauche → section <b>Sauvegarde</b>. Tous vos polygones,
            points, activités, dépenses et archives sont exportés dans un
            seul fichier JSON avec <Kbd>↓ Sauvegarder</Kbd>, rechargeables
            avec <Kbd>↑ Charger</Kbd>. L'état est aussi persisté
            automatiquement dans le navigateur (localStorage).
          </p>
        </Section>

        <div className="font-mono text-[10px] text-muted mt-6 pt-3 border-t border-border leading-relaxed">
          React 19 · Vite · Leaflet · Three.js · Zustand · Tailwind CSS<br />
          Données relief : SRTM GL1 30m (Open-Elevation) · Ensoleillement : Open-Meteo Archive<br />
          Usage interne ANRAC
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h3 className="font-mono text-[11px] text-olive-lit tracking-[2px] mb-2 border-b border-border pb-1.5">
        {title}
      </h3>
      <div className="text-[12.5px] text-text leading-relaxed space-y-1">
        {children}
      </div>
    </div>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <div className="pl-4 relative">
      <span className="absolute left-0 top-[0.55em] w-1.5 h-1.5 rounded-full bg-olive-lit" />
      {children}
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <code className="font-mono text-[11px] bg-bg border border-border px-1.5 py-0.5 text-amber">
      {children}
    </code>
  )
}
