# Versatile Agent — LangGraph + assistant-ui

[![TypeScript](https://img.shields.io/badge/TypeScript-7-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![LangGraph](https://img.shields.io/badge/LangGraph-1.4-blue)](https://langchain-ai.github.io/langgraphjs/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![assistant-ui](https://img.shields.io/badge/assistant--ui-latest-purple)](https://assistant-ui.com/)
[![LangGraph v0](<https://img.shields.io/badge/StateGraph-v0%20(legacy)-orange>)](https://github.com/laurentknauss/versatile-agent/tree/dev)
[![pnpm](https://img.shields.io/badge/pnpm-12.3-F69220?logo=pnpm)](https://pnpm.io/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

> **Agent LangGraph conversationnel avec 8 outils, interface chat streaming, structured outputs, thread management, tests unitaires (Vitest), et monorepo pnpm.**

---

## 🌿 Branches — quelle version lire ?

> ⚠️ **Cette branche `dev` est une archive.** Elle contient la **v0** du graphe : un `StateGraph` **monté à la main** (nœuds `agent` / `tools`, edge conditionnel `shouldContinue`, `MemorySaver`, export `graph`) et `ChatOpenAI` (`gpt-4.1-mini-2025-04-14`).

| Branche                   | Version LangGraph                                                                                                         | Statut                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `main`                    | **v1 — `createAgent()`** : boucle ReAct intégrée, middleware, mémoire long terme (`store` MongoDB), modèle DeepSeek Flash | **Production — c'est la version à lire et à exécuter**           |
| **`dev`** (cette branche) | **v0 — `StateGraph` manuel** : construction explicite du graphe, `ChatOpenAI`                                             | Archive obsolète, conservée pour documenter la migration v0 → v1 |

**Pour lire le projet à jour : `git checkout main`.**

⚠️ **Cette branche n'est pas exécutable telle quelle** : la v0 importe `ChatOpenAI` depuis `@langchain/openai`, dépendance retirée de la lignée v1. Elle est conservée **comme archive en lecture seule** — la version exécutable et à jour est `main`.

---

## ✨ Fonctionnalités

| Capacité           | Détail                                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| **🧠 Agent IA**    | GPT-4.1 mini (`ChatOpenAI`) avec streaming, cycle ReAct outillé par un `StateGraph` explicite         |
| **🌤️ Météo**       | Prévisions enrichies (vent, humidité, pluie, ressenti, probabilité précipitations) via OpenWeatherMap |
| **🪙 Crypto**      | Prix et market data via CoinGecko (filtres catégorie, IDs, multi-timeframe)                           |
| **🔍 Web Search**  | Recherche web via Tavily                                                                              |
| **💳 Stripe**      | Paiements, clients, produits (API Stripe)                                                             |
| **🧮 Utilitaires** | Addition, nombre aléatoire, heure courante                                                            |
| **💬 Chat UI**     | Interface assistant-ui (Next.js 16)                                                                   |
| **📜 Threads**     | Historique persistant des conversations                                                               |
| **📄 PDF Reader**  | Extraction de texte depuis des PDFs                                                                   |

---

## 🏗️ Architecture

```
versatile-agent/
├── src/
│   ├── agentWithTools.ts    ← Graph LangGraph v0 (StateGraph manuel : agent → tools → agent)
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
Utilisateur → assistant-ui → Proxy API → LangGraph Agent (GPT-4.1 mini · v0 StateGraph)
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
      date: "2024-06-02",
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
# Modèle (v0 : OpenAI — la v1 sur main utilise DEEPSEEK_API_KEY / deepseek-flash)
OPENAI_API_KEY=sk-...                          # Obligatoire (ChatOpenAI, gpt-4.1-mini)

# Outils
TAVILY_API_KEY=tvly-...                        # Web search
OPENWEATHERMAP_API_KEY=...                      # Météo
COINGECKO_API_KEY=CG-...                        # Crypto
STRIPE_SECRET_KEY=sk_live_...                   # Stripe
BRAVE_SEARCH_API_KEY=BSA...                     # Brave search (commenté)

# Mémoire long terme (v0 : store câblé uniquement si ce cluster est défini)
# MONGODB_ATLAS_URI="mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/..."
```

---

## 🛠️ Outils disponibles

| Outil             | Description                                                                               | Source         |
| ----------------- | ----------------------------------------------------------------------------------------- | -------------- |
| `tavilySearch`    | Recherche web                                                                             | Tavily API     |
| `openWeatherMap`  | Prévisions météo enrichies (vent, humidité, pluie, ressenti)                              | OpenWeatherMap |
| `coinGeckoPrice`  | Prix crypto structurés (multi-devises, market cap, volume, change 24h)                    | CoinGecko      |
| `coinGeckoMarket` | Market data (cap, volume, rang, filtre catégorie/IDs, pagination)                         | CoinGecko      |
| `additionTool`    | Addition de deux nombres                                                                  | Interne        |
| `randomNumber`    | Nombre aléatoire dans un intervalle                                                       | Interne        |
| `currentTime`     | Heure locale HH:MM:SS                                                                     | Interne        |
| `stripe_*`        | Customers, produits, paiements                                                            | Stripe API     |
| `read_pdf`        | Extraction texte depuis PDF (URL ou fichier local)                                        | pdf-parse      |
| `saveMemory`      | Enregistre un fait durable pour les conversations futures (nécessite `MONGODB_ATLAS_URI`) | MongoDB store  |
| `recallMemories`  | Recherche dans les souvenirs enregistrés                                                  | MongoDB store  |

---

### 💬 Example queries — CoinGecko

| Category           | Query                                                                          | Tool used                                                  |
| ------------------ | ------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| **Single price**   | _"What's the price of bitcoin in USD?"_                                        | `coinGeckoPrice`                                           |
| **Multi-coin**     | _"Give me prices for bitcoin, ethereum, solana, chainlink and cardano in EUR"_ | `coinGeckoPrice`                                           |
| **Multi-currency** | _"Compare bitcoin price in USD, EUR and GBP"_                                  | `coinGeckoPrice`                                           |
| **Price + change** | _"What's the price of avalanche-2 and its 24h change?"_                        | `coinGeckoPrice`                                           |
| **Top market cap** | _"What are the top 10 cryptocurrencies by market cap?"_                        | `coinGeckoMarket`                                          |
| **Top 50**         | _"Show me the top 50 cryptos in EUR"_                                          | `coinGeckoMarket`                                          |
| **By category**    | _"What are the top 20 DeFi tokens?"_                                           | `coinGeckoMarket` (category: `decentralized-finance-defi`) |
| **Gaming tokens**  | _"List the top gaming tokens by market cap"_                                   | `coinGeckoMarket` (category: `gaming`)                     |
| **NFT tokens**     | _"Top 5 NFT tokens ranked by market cap"_                                      | `coinGeckoMarket` (category: `non-fungible-tokens-nft`)    |
| **Pagination**     | _"Page 2 of the top cryptos"_                                                  | `coinGeckoMarket` (page param)                             |
| **Combined**       | _"Show me the top 10 cryptos and the price of bitcoin in EUR and USD"_         | Both tools                                                 |

### 💬 Example queries — Weather

| Query                                                    | Tool used        | Features used                                |
| -------------------------------------------------------- | ---------------- | -------------------------------------------- |
| _"What's the weather in Paris?"_                         | `openWeatherMap` | Température, vent, humidité, pluie, ressenti |
| _"Forecast for Tokyo next 5 days"_                       | `openWeatherMap` | J+1 shift, prévisions complètes              |
| _"Y a-t-il des risques de précipitations à Marseille ?"_ | `openWeatherMap` | Pluviométrie mm, probabilité %               |
| _"Météo détaillée à Montréal sur 4 jours"_               | `openWeatherMap` | Vent, humidité, ressenti, pluie              |

### 💬 Example queries — Web search & utilities

| Query                                         | Tool used      |
| --------------------------------------------- | -------------- |
| _"Search for latest AI news"_                 | `tavilySearch` |
| _"What's 42 + 58?"_                           | `additionTool` |
| _"Give me a random number between 1 and 100"_ | `randomNumber` |
| _"What time is it?"_                          | `currentTime`  |

---

## 🧪 Scripts

| Commande          | Description                        |
| ----------------- | ---------------------------------- |
| `pnpm dev`        | Backend + frontend en parallèle    |
| `pnpm start`      | Backend seul (`langgraphjs dev`)   |
| `pnpm typecheck`  | Vérification TypeScript            |
| `pnpm lint`       | ESLint                             |
| `pnpm format`     | Prettier                           |
| `pnpm lint:fix`   | ESLint avec auto-fix               |
| `pnpm test`       | Tests unitaires Vitest (108 tests) |
| `pnpm test:watch` | Tests en mode watch                |

---

## 🖥️ LangSmith Studio

Le backend expose un **Studio visuel** à `http://localhost:2024` :

- Inspecter le graphe en temps réel
- Tester des messages manuellement
- Suivre les runs, traces et tool calls
- Déboguer le flux ReAct nœud par nœud

---

## 📚 Documentation locale

Le dossier `okf/` contient la documentation auto-suffisante au format **Open Knowledge** :

- [Spécification](okf/SPEC.md)
- [Architecture](okf/concepts/architecture.md)
- [Graph LangGraph](okf/components/graph.md)
- [Proxy API](okf/api/proxy.md)
- [Variables d'environnement](okf/environment/env.md)
- [Migration console → assistant-ui](okf/concepts/migration.md)

---

## 📦 Stack technique

| Technologie       | Version                                           |
| ----------------- | ------------------------------------------------- |
| TypeScript        | 7                                                 |
| LangGraph         | 1.4                                               |
| @langchain/openai | 1.5 (à installer sur cette branche, voir bandeau) |
| Next.js           | 16                                                |
| assistant-ui      | latest                                            |
| pnpm              | 12.3                                              |
| ESLint            | 9                                                 |
| Prettier          | 3                                                 |
| Husky             | 9                                                 |

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
