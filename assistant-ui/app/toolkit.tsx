'use generative';

import { defineToolkit, externalTool } from '@assistant-ui/react';

import { AirportBoardTable } from '@/components/assistant-ui/elements/airport-board.aui';
import { FlightTrackerCard } from '@/components/assistant-ui/elements/flight-tracker.aui';
import { WeatherForecastStrip } from '@/components/assistant-ui/elements/weather-card.aui';

/**
 * Ces outils sont exécutés par le graphe LangGraph (`src/tools/*`), pas par le
 * navigateur : ici on ne fait que rattacher un rendu à leur nom, celui que le
 * modèle publie côté graphe. `externalTool()` dit au compilateur de ne rien
 * émettre côté serveur — aucun schéma publié, aucun exécuteur dans le bundle
 * client — et de garder côté client le seul `render`, résolu sur les tool-calls
 * de même nom via `part.toolUI`.
 */
export default defineToolkit({
  flightTracker: {
    execute: externalTool(),
    render: ({ args, result }) => <FlightTrackerCard args={args} result={result} />,
  },
  airportBoard: {
    execute: externalTool(),
    render: ({ args, result }) => <AirportBoardTable args={args} result={result} />,
  },
  openWeatherMap: {
    execute: externalTool(),
    render: ({ args, result }) => <WeatherForecastStrip args={args} result={result} />,
  },
});
