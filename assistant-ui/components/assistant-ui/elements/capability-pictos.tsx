'use client';

import Image from 'next/image';
import { ThreadPrimitive } from '@assistant-ui/react';
import { type FC } from 'react';

import { ShineBorder } from '@/components/assistant-ui/elements/shine-border';
import { cn } from '@/lib/utils';

/** Contrat commun des visuels : image détourée posée dans `public/agents`. */
type VisualProps = { className?: string };

/**
 * Visuel image détouré — chaque PNG est recadré sur son contenu, transparent et
 * 256 px de côté, ce qui laisse passer le dégradé de la tuile ronde.
 */
const agentVisual = (src: string, width: number, height: number): FC<VisualProps> => {
  const Visual: FC<VisualProps> = ({ className }) => (
    <Image
      src={src}
      alt=""
      aria-hidden
      width={width}
      height={height}
      className={cn('object-contain', className)}
    />
  );
  return Visual;
};

/** Document PDF (`public/agents/pdf.png`) : lecture d'un fichier déposé. */
const PdfVisual = agentVisual('/agents/pdf.png', 256, 248);

/** Soleil (`public/agents/sun.png`) : prévisions météo. */
const WeatherVisual = agentVisual('/agents/sun.png', 256, 255);

/** Pièce Bitcoin dorée (`public/agents/bitcoin.png`) : actus crypto. */
const BitcoinVisual = agentVisual('/agents/bitcoin.png', 256, 253);

/** Clap de cinéma (`public/agents/camera.png`) : recherche de films TMDB. */
const CinemaVisual = agentVisual('/agents/camera.png', 256, 254);

/** Carte bancaire (`public/agents/card.png`) : paiements Stripe. */
const StripeVisual = agentVisual('/agents/card.png', 256, 249);

/** Avion de ligne (`public/agents/plane.png`) : suivi de vol en direct. */
const FlightVisual = agentVisual('/agents/plane.png', 256, 149);

type Capability = {
  label: string;
  hint: string;
  tile: string;
  Visual: FC<VisualProps>;
  /** Taille du visuel dans la tuile — défaut `size-9`, agrandi pour une image pleine. */
  visualClassName?: string;
  prompt: string;
  autoSend: boolean;
};

const CAPABILITIES: Capability[] = [
  {
    label: 'Lecteur de PDF',
    hint: 'Déposez un PDF avec le bouton « + », puis envoyez : l’agent le lit et cite la page.',
    tile: 'from-rose-500 to-red-600',
    Visual: PdfVisual,
    visualClassName: 'size-10',
    prompt: 'Résume ce document et donne-moi les 3 chiffres clés avec leur numéro de page.',
    autoSend: false,
  },
  {
    label: 'Agent météo',
    hint: 'Prévisions OpenWeatherMap — cliquez pour lancer la démo.',
    tile: 'from-sky-400 to-blue-600',
    Visual: WeatherVisual,
    visualClassName: 'size-10',
    prompt: 'Quel temps fera-t-il à Paris demain ?',
    autoSend: true,
  },
  {
    label: 'Agent Stripe',
    hint: 'Solde, clients et derniers événements de votre compte Stripe.',
    tile: 'from-indigo-500 to-violet-600',
    Visual: StripeVisual,
    visualClassName: 'size-10',
    prompt: 'Quel est le solde de mon compte Stripe et quels sont les derniers événements ?',
    autoSend: true,
  },
  {
    label: 'Agent news crypto',
    hint: 'Cours CoinGecko et actualités via recherche web.',
    tile: 'from-amber-400 to-orange-600',
    Visual: BitcoinVisual,
    visualClassName: 'size-10',
    prompt: 'Quelles sont les dernières nouvelles sur le Bitcoin ?',
    autoSend: true,
  },
  {
    label: 'Agent cinéma',
    hint: 'Recherche TMDB — date de sortie, note, résumé et affiche. Cliquez pour lancer la démo.',
    tile: 'from-violet-500 to-fuchsia-600',
    Visual: CinemaVisual,
    visualClassName: 'size-10',
    prompt: 'Quand le Fabuleux Destin d’Amélie Poulain est-il sorti au cinéma ?',
    autoSend: true,
  },
  {
    label: 'Agent vols en direct',
    hint: 'Suivi de vol AirLabs — position, retard, terminal et porte. Cliquez pour lancer la démo.',
    tile: 'from-cyan-500 to-blue-800',
    Visual: FlightVisual,
    visualClassName: 'size-10',
    prompt: 'Où se trouve le vol U24573 en ce moment ?',
    autoSend: true,
  },
];

/**
 * Colonne de capacités affichée sous le nom du produit, en haut de page.
 * Chaque pastille est un vrai raccourci : elle pré-remplit ou envoie un prompt.
 */
export const CapabilityStrip: FC = () => (
  <div className="flex w-full flex-col items-center gap-3">
    {CAPABILITIES.map(({ label, hint, tile, Visual, visualClassName, prompt, autoSend }) => (
      <ThreadPrimitive.Suggestion
        key={label}
        prompt={prompt}
        send={autoSend}
        title={hint}
        className="group/cap relative flex w-full max-w-80 items-center gap-3.5 overflow-hidden rounded-full border border-white/25 bg-white/12 py-2.5 pr-6 pl-2.5 text-white transition-colors hover:bg-white/22 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
      >
        <span
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br shadow-sm ring-1 ring-white/30',
            tile
          )}
        >
          <Visual className={cn('size-9', visualClassName)} />
        </span>
        <span className="text-base font-medium whitespace-nowrap">{label}</span>
        <ShineBorder
          shineColor={['#ffffff', '#bae6fd']}
          duration={7}
          className="opacity-0 transition-opacity duration-300 group-hover/cap:opacity-100"
        />
      </ThreadPrimitive.Suggestion>
    ))}
  </div>
);
