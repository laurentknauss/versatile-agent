'use client';

import type * as React from 'react';

import { cn } from '@/lib/utils';

interface BorderBeamProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Longueur de la comète, en pixels
   * @default 50
   */
  size?: number;
  /**
   * Durée d'un tour complet, en secondes
   * @default 6
   */
  duration?: number;
  /** Couleur de tête de la comète */
  colorFrom?: string;
  /** Couleur de queue */
  colorTo?: string;
  /**
   * Épaisseur de l'anneau sur lequel glisse la comète, en pixels
   * @default 1
   */
  borderWidth?: number;
}

/**
 * Border Beam — Magic UI (registre : magicui.design/r/border-beam.json).
 * Zéro dépendance : là où l'original anime `offsetDistance` avec `motion`, le
 * CSS fait le travail seul (`offset-path: rect(...)` + `animate-border-beam`,
 * déclaré dans globals.css). Purement décoratif : sans support d'`offset-path`
 * la comète reste au repos en haut du cadre et la carte s'affiche normalement.
 * À poser dans un conteneur `relative overflow-hidden rounded-*`.
 */
export function BorderBeam({
  size = 50,
  duration = 6,
  colorFrom = '#ffaa40',
  colorTo = '#9c40ff',
  borderWidth = 1,
  className,
  style,
  ...props
}: BorderBeamProps) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-(length:--border-beam-width) border-transparent mask-[linear-gradient(transparent,transparent),linear-gradient(#000,#000)] mask-intersect [mask-clip:padding-box,border-box]"
      style={{ '--border-beam-width': `${borderWidth}px` } as React.CSSProperties}
      {...props}
    >
      <div
        className={cn(
          'absolute aspect-square rounded-full bg-linear-to-l from-(--color-from) via-(--color-to) to-transparent blur-[1px]',
          'motion-safe:animate-border-beam',
          className
        )}
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            '--color-from': colorFrom,
            '--color-to': colorTo,
            '--border-beam-duration': `${duration}s`,
            ...style,
          } as React.CSSProperties
        }
      />
    </div>
  );
}
