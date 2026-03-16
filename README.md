# @nexartis/nexartis-nanda-node-sdk

TypeScript SDK for the [Nexartis NANDA Node](https://nanda.nexartis.com) — agent registry, discovery, orchestration, and A2A interoperability. Zero dependencies beyond standard `fetch`.

## What is NANDA Node?

Nexartis NANDA Node (NNN) is the runtime infrastructure for the NANDA (Nexartis Agent & Network Discovery Architecture) protocol. It provides:

- **Agent Registry** — register, lookup, search, and list AI agents across the network
- **A2A Discovery** — `.well-known/agent-card.json` and NANDA Index for interoperability
- **Agent Facts** — structured metadata (AgentFacts v1/v2) for trust and capability discovery
- **DAG Orchestration** — create and manage multi-agent workflows with directed acyclic graphs
- **Health & Stats** — subsystem health checks (DB, R2, KV, Queues) and registry statistics

This SDK wraps all NNN REST API endpoints with typed responses and retry logic.

## Installation

This package is published to GitHub Packages (private).

### 1. Configure npm registry

Create `.npmrc` in your project root:

```
@nexartis:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

### 2. Install

```bash
pnpm add @nexartis/nexartis-nanda-node-sdk
```

### Local Development

For local development, link the SDK directly:

```json
{
  "dependencies": {
    "@nexartis/nexartis-nanda-node-sdk": "link:../nexartis-nanda-node-sdk"
  }
}
```

## Quick Start

```typescript
import { NnnClient } from '@nexartis/nexartis-nanda-node-sdk';

const nnn = new NnnClient({
  baseUrl: 'https://nanda.nexartis.com',
  apiKey: 'your-api-key',
});

// Register an agent
await nnn.registerAgent({
  agent_id: 'my-agent',
  agent_url: 'https://my-agent.example.com',
  capabilities: ['text-generation', 'code-review'],
  tags: ['production', 'v2'],
});

// Search for agents
const agents = await nnn.searchAgents({
  capabilities: ['text-generation'],
  min_trust: 0.8,
});

// Get A2A agent card
const card = await nnn.getAgentCard();

// Get NANDA index
const index = await nnn.getNandaIndex();

// Create a DAG workflow
await nnn.createWorkflow({
  name: 'review-pipeline',
  owner_id: 'orchestrator-1',
  dag: {
    nodes: [
      { id: 'analyze', type: 'agent', data: { agent_id: 'analyzer' } },
      { id: 'review', type: 'agent', data: { agent_id: 'reviewer' } },
    ],
    edges: [{ source: 'analyze', target: 'review' }],
  },
});

// Health check
const healthy = await nnn.isHealthy(); // never throws
```

## Architecture

```
@nexartis/nexartis-nanda-node-sdk
└── src/core/
    ├── client.ts      NnnClient — unified client class
    ├── errors.ts      NnnError + NnnErrorCode enum
    ├── retry.ts       fetchWithRetry, exponential backoff + jitter
    ├── health.ts      Health check helpers
    ├── logger.ts      Portable logger (no-op when disabled)
    └── types.ts       All TypeScript interfaces
```

## API Reference

### NnnClient Methods

| Category | Method | Description |
|----------|--------|-------------|
| **Health** | `health()` | Full health status (DB, R2, KV, Queues) |
| | `isHealthy()` | Boolean convenience (never throws) |
| **Registry** | `registerAgent(req)` | Register an agent on the NANDA network |
| | `lookupAgent(agentId)` | Lookup a single agent by ID |
| | `searchAgents(params?)` | Search agents by query, capabilities, tags, trust |
| | `listAgents()` | List all registered agents |
| **Discovery** | `getAgentFacts(agentId)` | Get AgentFacts (v1/v2 metadata) |
| | `getAgentCard()` | Get the node's A2A agent card |
| | `getNandaIndex()` | Get `.well-known/nanda-index` descriptor |
| **Stats** | `stats()` | Get registry statistics |
| **Orchestration** | `createWorkflow(req)` | Create a DAG workflow |
| | `listWorkflows(params?)` | List workflows by owner/status |

### Standalone Functions

Every client method is also available as a standalone function:

```typescript
import { checkHealth, isHealthy } from '@nexartis/nexartis-nanda-node-sdk';
```

### Error Handling

All errors are typed `NnnError` with a `code` enum for programmatic handling:

```typescript
import { NnnError, NnnErrorCode } from '@nexartis/nexartis-nanda-node-sdk';

try {
  await nnn.lookupAgent('nonexistent');
} catch (err) {
  if (err instanceof NnnError) {
    switch (err.code) {
      case NnnErrorCode.NOT_FOUND:
        // Handle 404
        break;
      case NnnErrorCode.RATE_LIMITED:
        // Back off
        break;
      case NnnErrorCode.CONFIGURATION_ERROR:
        // Invalid config
        break;
    }
  }
}
```

### Retry Configuration

All methods use exponential backoff with jitter by default. Override per-client:

```typescript
const nnn = new NnnClient({
  baseUrl: 'https://nanda.nexartis.com',
  retryConfig: {
    maxRetries: 5,       // default: 3
    baseDelayMs: 500,    // default: 1000
    maxDelayMs: 15000,   // default: 10000
    timeoutMs: 10000,    // default: 5000
  },
});
```

## Design Principles

- **Zero dependencies** — only standard `fetch`
- **No env reads** — all configuration via constructor injection
- **Typed errors** — `NnnError` enum codes, never raw strings
- **Retry resilience** — exponential backoff + jitter, caller abort signal forwarding
- **A2A compatible** — first-class support for Agent Card JSON and NANDA Index

## License

Proprietary — Nexartis LLC. All rights reserved.

