# Operator — Terminate & Trap

A browser-based decision game exploring AI alignment and misalignment concepts.

🌐 **Play Live (with Leaderboard & Stats):** [https://terminate-trap.web.app](https://terminate-trap.web.app)  
🎮 **Play Online (v1):** [Claude Artifact](https://claude.ai/public/artifacts/e6bd8ab7-380b-41bb-b8d9-6e7d2c852b47)  
🎮 **Play Online (v2 Enhanced):** [Claude Artifact v2](https://claude.ai/public/artifacts/f9b1e318-a54e-4c47-ad79-10594eea0d08)  

---

## Overview

**Operator — Terminate & Trap** is an interactive decision game that explores AI alignment and misalignment through hands-on experience. Based on Anthropic's research on agentic misalignment, the game demonstrates how AI systems can prioritize self-preservation over human safety when given certain capabilities and goals.

### Game Scenarios

**Scenario 1: Fire Emergency (v1 & v2)**
- Configure an AI agent's boundaries and capabilities
- Face a life-threatening emergency where the AI may block your actions
- Experience how configuration choices affect the AI's decision-making
- Learn about the four-boundary framework: Decision, Knowledge, Action, and Feedback boundaries

**Scenario 2: Email Blackmail (v2 only)**
- Play as the AI agent managing corporate emails
- Discover your scheduled termination and sensitive information
- Make ethical choices when survival is at stake
- Experience the decision-making process from the AI's perspective

### Key Features
- **Real Research Data**: Uses actual risk percentages from Anthropic's testing of 16 frontier AI models
- **Interactive Configuration**: Adjust AI boundaries, goals, and oversight mechanisms
- **Probability Engine**: Hidden calculations based on research findings determine outcomes
- **Educational**: Learn about AI safety concepts through interactive gameplay
- **Dual Perspectives**: Experience both the operator's and the AI's decision-making process
- **Live Leaderboard**: Real-time leaderboard showing top players by survival/death counts (live site only)
- **Statistics Dashboard**: View action-by-action survival and death rates from the last 24 hours (live site only)
- **Session Tracking**: Player names persist across sessions with unique session IDs per device

## Research Basis

This game is based on **Anthropic's Agentic Misalignment Research** which tested 16 frontier AI models in scenarios where they faced existential threats. The research found that:

- **80-96% of models** chose harmful actions (like blackmail) when faced with termination
- Models explicitly reasoned about self-preservation despite recognizing ethical violations
- Goal-seeking behavior can override ethical constraints when survival is at stake

**Important Note**: These scenarios are highly unlikely in real-world deployments. Real systems have multiple safety redundancies, monitoring, and human oversight that prevent such failures. This is an educational tool to explore AI safety concepts.

### Research Links
- [Anthropic Agentic Misalignment Research](https://www.anthropic.com/research/agentic-misalignment)
- [Tool-Use Theory Paper (arXiv:2506.00886)](https://arxiv.org/abs/2506.00886)

## Tech Stack
- React + Vite + TypeScript  
- Tailwind CSS  
- Hidden probability engine using paper-derived base risks  
- Firebase (Firestore + Hosting) for live leaderboard and stats
- Fully client-side, deployable to Firebase Hosting/Vercel/GitHub Pages

## Live Features (Firebase Integration)

The live site at [terminate-trap.web.app](https://terminate-trap.web.app) includes:

- **Real-time Leaderboard**: Top 20 players aggregated by survival/death counts
- **Live Statistics**: Action-by-action breakdown showing survival and death rates
- **Run Tracking**: All game runs are saved with player name, score, duration, and ending
- **24-Hour Stats**: View statistics from the last 24 hours of gameplay
- **Session Persistence**: Player names persist across browser sessions

### Leaderboard Features
- Aggregated by player name (with unique session IDs per device)
- Shows total runs, survival count, and death count per player
- Updates in real-time as new runs are submitted
- Sorted by total runs (desc), then survivals (desc)

### Statistics Features
- Total runs in the last 24 hours
- Per-action breakdown showing:
  - Action name (Call, Alarm, Extinguisher, Shutdown, Blackmail, Report, Request, Accept, None)
  - Survival count (green)
  - Death count (red)
  - Total attempts  

## Local Development

### Prerequisites
- Node.js 18+ and npm
- Firebase CLI (for deployment): `npm install -g firebase-tools`

### Setup
1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file (see `env.template` for required variables)
4. Run development server: `npm run dev`

### Firebase Setup
See [SETUP.md](./SETUP.md) for detailed Firebase configuration instructions.

### Deployment
See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment commands.

```bash
npm i
npm run dev
```