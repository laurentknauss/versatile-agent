# Versatile Agent — LangGraph + assistant-ui

[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-1.4-blue)](https://langchain-ai.github.io/langgraphjs/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![assistant-ui](https://img.shields.io/badge/assistant--ui-latest-purple)](https://assistant-ui.com/)
[![pnpm](https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm)](https://pnpm.io/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> **Agent LangGraph conversationnel avec 8 outils, interface chat streaming, structured outputs, thread management, tests unitaires (Vitest), et monorepo pnpm.**

---

## ✨ Fonctionnalités

| Capacité | Détail |
|---|---|
| **🧠 Agent IA** | GPT-5.1 avec streaming, cycle ReAct outillé, structured outputs |
| **🌤️ Météo** | Prévisions enrichies (vent, humidité, pluie, ressenti, probabilité précipitations) via OpenWeatherMap |
| **🪙 Crypto** | Prix et market data via CoinGecko (filtres catégorie, IDs, multi-timeframe) |
| **🔍 Web Search** | Recherche web via Tavily |
| **💳 Stripe** | Paiements, clients, produits (API Stripe) |
| **🧮 Utilitaires** | Addition, nombre aléatoire, heure courante |
| **💬 Chat UI** | Interface assistant-ui (Next.js 16) |
| **📜 Threads** | Historique persistant des conversations |
| **📄 PDF Reader** | Extraction de texte depuis des PDFs |

---

## 🏗️ Architecture

```
versatile-agent/
├── src/
│   ├── agentWithTools.ts    ← Graph LangGraph (StateGraph, nœuds, edges)
│   └── tools/               ← Boîte à outils modulaire
│       ├── tools.ts         ← Agrégateur de tous les outils
│       ├── weatherTool.ts   ← OpenWeatherMap (structured output)
│       ├── geckoTool.ts     ← CoinGecko (structured output)
│       ├── stripeTool.ts    ← Stripe
│       ├── tavilyTool.ts    ← Tavily web search
│       ├── randomNumberTool.ts
│       ├── pfdReader.ts     ← PDF reader
│       ├── __tests__/       ← Tests Vitest (108 tests)
│       └── types/           ← Types par outil
│           ├── gecko.ts     ← CoinGecko types
│           ├── weather.ts   ← OpenWeatherMap types
│           ├── stripe.ts    ← Stripe types
│           ├── pdf.ts       ← PDF types
│           └── common.ts    ← Types partagés
├── assistant-ui/            ← Frontend Next.js + assistant-ui
│   ├── app/
│   │   ├── page.tsx         ← Page principale (chat)
│   │   └── api/[..._path]/  ← Proxy API vers LangGraph
│   └── components/
├── okf/                     ← Open Knowledge Format (doc locale)
├── patches/                 ← Patch pnpm @typescript/vfs (TS7 compat)
├── .env.example             ← Variables d'environnement (template)
├── langgraph.json           ← Config LangGraph CLI
├── vitest.config.ts         ← Config Vitest
└── pnpm-workspace.yaml      ← Monorepo pnpm
```

### Flux de messages

```
Utilisateur → assistant-ui → Proxy API → LangGraph Agent (GPT-5.1)
                                              │
                                         ┌────┴────┐
                                         │  Agent  │
                                         ├─► tools ◄──► weather, crypto,
                                         │         │     search, stripe,
                                         │         │     addition, random,
                                         │         │     time, pdf
                                         └────┬────┘
                                              │
                                    Réponse streaming → Chat UI
```

### Structured Outputs (tous les outils)

Tous les outils retournent des **objets JSON structurés** (pas de strings formatés).
Cela permet au LLM d'interpréter les données sans avoir à parser du texte —
plus fiable, plus facile à maintenir, et moins d'hallucinations.

**Exemple — weatherTool.ts :**
```typescript
{
  location: { city: "Paris", country: "FR" },
  forecastDaysRequested: 3,
  forecastDaysReturned: 2,
  forecastStarting: "tomorrow",  // J+1 shift (skip today)
  forecast: [
    {
      date: "2026-06-02",
      temperature: { averageCelsius: 22, minCelsius: 20, maxCelsius: 24, feelsLikeCelsius: 21 },
      weather: "pluie légère",
      wind: { speedKmh: 18, directionDegrees: 220, direction: "↗️ SW" },
      humidityPercent: 72,
      rainMm: 1.2,
      precipitationProbabilityPercent: 60,
    },
  ],
}
```

**Exemple — coinGeckoPrice :**
```typescript
{
  type: "crypto_prices",
  vsCurrencies: "usd,eur",
  prices: [
    { coinId: "bitcoin", name: "BITCOIN", price_usd: 65000, price_eur: 59000, marketCap: 1270000000000, volume24h: 28000000000, change24hPercent: 2.5 },
  ],
}
```

**Exemple — coinGeckoMarket :**
```typescript
{
  type: "crypto_market_data",
  currency: "usd",
  category: "decentralized-finance-defi",
  page: 1,
  perPage: 10,
  coins: [
    { rank: 1, coinId: "bitcoin", symbol: "BTC", name: "Bitcoin", currentPrice: 65000, marketCap: 1270000000000, volume24h: 28000000000, change24hPercent: 2.5, circulatingSupply: 19000000 },
  ],
}
```

LangGraph convertit automatiquement ces objets en JSON via `JSON.stringify()`
dans le `ToolNode` — pas besoin de formatage manuel.

---

## 🚀 Quick Start

### Prérequis

- **Node.js ≥ 20**
- **pnpm ≥ 11** (installé via `npm i -g pnpm` ou `corepack enable`)
- **Clés API** (voir `.env.example`)

### Installation

```bash
# Cloner le dépôt
git clone <votre-repo-url>
cd versatile-agent

# Installer les dépendances (monorepo)
pnpm install

# Copier et configurer les variables d'environnement
cp .env .env.local   # ou éditer .env directement
```

### Lancement

```bash
# Démarrer backend + frontend simultanément
pnpm dev

# Ou séparément : backend LangGraph seul
pnpm dev:backend

# Frontend assistant-ui seul
pnpm dev:frontend
```

- **Backend** : `langgraphjs dev` → `http://localhost:2024` (API + Studio)
- **Frontend** : Next.js → `http://localhost:3000` (Chat UI)

### Variables d'environnement

```bash
OPENAI_API_KEY=sk-...                       
TAVILY_API_KEY=tvly-...                        
OPENWEATHERMAP_API_KEY=...                  
COINGECKO_API_KEY=CG-...                      
STRIPE_SECRET_KEY=sk_live_...                  
```

---

## 🛠️ Outils disponibles

| Outil | Description | Source |
|---|---|---|
| `tavilySearch` | Recherche web | Tavily API |
| `openWeatherMap` | Prévisions météo enrichies (vent, humidité, pluie, ressenti) | OpenWeatherMap |
| `coinGeckoPrice` | Prix crypto structurés (multi-devises, market cap, volume, change 24h) | CoinGecko |
| `coinGeckoMarket` | Market data (cap, volume, rang, filtre catégorie/IDs, pagination) | CoinGecko |
| `additionTool` | Addition de deux nombres | Interne |
| `randomNumber` | Nombre aléatoire dans un intervalle | Interne |
| `currentTime` | Heure locale HH:MM:SS | Interne |
| `stripe_*` | Customers, produits, paiements | Stripe API |
| `read_pdf` | Extraction texte depuis PDF (URL ou fichier local) | pdf-parse |

---

### 💬 Example queries — CoinGecko

| Category | Query | Tool used |
|---|---|---|
| **Single price** | *"What's the price of bitcoin in USD?"* | `coinGeckoPrice` |
| **Multi-coin** | *"Give me prices for bitcoin, ethereum, solana, chainlink and cardano in EUR"* | `coinGeckoPrice` |
| **Multi-currency** | *"Compare bitcoin price in USD, EUR and GBP"* | `coinGeckoPrice` |
| **Price + change** | *"What's the price of avalanche token  and its 24h change?"* | `coinGeckoPrice` |
| **Top market cap** | *"What are the top 10 cryptocurrencies by market cap?"* | `coinGeckoMarket` |
| **Top 50** | *"Show me the top 50 cryptos in EUR"* | `coinGeckoMarket` |
| **By category** | *"What are the top 20 DeFi tokens?"* | `coinGeckoMarket` (category: `decentralized-finance-defi`) |
| **Gaming tokens** | *"List the top gaming tokens by market cap"* | `coinGeckoMarket` (category: `gaming`) |
| **NFT tokens** | *"Top 5 NFT tokens ranked by market cap"* | `coinGeckoMarket` (category: `non-fungible-tokens-nft`) 
| **Combined** | *"Show me the top 10 cryptos and the price of bitcoin in EUR and USD"* | Both tools |

### 💬 Example queries — Weather

| Query | Tool used | Features used |
|---|---|---|
| *"What's the weather in Paris?"* | `openWeatherMap` | Température, vent, humidité, pluie, ressenti |
| *"Forecast for Tokyo next 5 days"* | `openWeatherMap` | J+1 shift, prévisions complètes |
| *"Y a-t-il des risques de précipitations à Marseille dans les 3 prochains jours ?"* | `openWeatherMap` | Pluviométrie mm, probabilité % |
| *"Météo détaillée à Montréal sur 4 jours"* | `openWeatherMap` | Vent, humidité, ressenti, pluie |

### 💬 Example queries — Web search & utilities

| Query | Tool used |
|---|---|
| *"Search for latest AI news"* | `tavilySearch` |
| *"What's 42 + 58?"* | `additionTool` |
| *"Give me a random number between 1 and 100"* | `randomNumber` |
| *"What time is it?"* | `currentTime` |

---

## 🧪 Scripts

| Commande | Description |
|---|---|
| `pnpm dev` | Backend + frontend en parallèle |
| `pnpm start` | Backend seul (`langgraphjs dev`) |
| `pnpm typecheck` | Vérification TypeScript |
| `pnpm lint` | ESLint |
| `pnpm format` | Prettier |
| `pnpm lint:fix` | ESLint avec auto-fix |
| `pnpm test` | Tests unitaires Vitest (108 tests) |
| `pnpm test:watch` | Tests en mode watch |

---

## 🖥️ LangSmith Studio

Le backend expose un **Studio visuel** à `http://localhost:2024` :

- Inspecter le graphe en temps réel
- Tester des messages manuellement
- Suivre les runs, traces et tool calls
- Déboguer le flux ReAct nœud par nœud

---

## 📚 Documentation locale

Le dossier `okf/` contient la documentation auto-suffisante au format google  **Open Knowledge** :

- [Spécification](okf/SPEC.md)
- [Architecture](okf/concepts/architecture.md)
- [Graph LangGraph](okf/components/graph.md)
- [Proxy API](okf/api/proxy.md)
- [Variables d'environnement](okf/environment/env.md)
- [Migration console → assistant-ui](okf/concepts/migration.md)

---

## 📦 Stack technique

| Technologie | Version |
|---|---|
| TypeScript | 7 |
| LangGraph | 1.4 |
| @langchain/openai | 1.5 |
| Next.js | 16 |
| assistant-ui | latest |
| pnpm | 11 |
| ESLint | 9 |
| Prettier | 3 |
| Husky | 9 |

---

## 🤝 Contribution

1. Fork le projet
2. Crée une branche (`git checkout -b feature/ma-feature`)
3. Commit (`git commit -m 'feat: ajout de ma feature'`)
4. Push (`git push origin feature/ma-feature`)
5. Ouvre une Pull Request

---

## 📄 Licence

MIT — voir le fichier [LICENSE](LICENSE) pour les détails.

---

<details>
<summary><b>📸 Captures d'écran (à venir)</b></summary>

<!-- Ajouter ici des screenshots du chat UI et du Studio LangGraph -->

</details>