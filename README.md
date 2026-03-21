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

// Run a workflow and get the result
const result = await nnn.runWorkflow('workflow-123', { prompt: 'Analyze this PR' });

// Stream workflow events (SSE)
for await (const event of nnn.streamWorkflowEvents(result.runId)) {
  console.log(event.type, event.data);
}

// Auto-paginate through all agents
for await (const agent of nnn.searchAgentsAll({ capabilities: ['code-review'] })) {
  console.log(agent.agent_id);
}

// Health check
const healthy = await nnn.isHealthy(); // never throws
```

## Architecture

```
@nexartis/nexartis-nanda-node-sdk
└── src/core/
    ├── client.ts      NnnClient — unified client class (includes health)
    ├── errors.ts      NnnError + NnnErrorCode enum
    ├── retry.ts       fetchWithRetry, exponential backoff + jitter
    ├── logger.ts      Portable logger (no-op when disabled)
    └── types.ts       All TypeScript interfaces
```

## API Reference

### NnnClient Methods

| Category | Method | Description |
|----------|--------|-------------|
| **Health** | `health()` | Full health status (DB, R2, KV, Queues) |
| | `isHealthy()` | Boolean convenience (never throws) |
| | `deepHealth()` | Extended health with degraded-check details |
| **Registry** | `registerAgent(req)` | Register an agent on the NANDA network |
| | `lookupAgent(agentId)` | Lookup a single agent by ID |
| | `searchAgents(params?)` | Search agents (single page) |
| | `listAgents()` | List all agents (single page) |
| | `updateAgent(agentId, updates)` | Update agent metadata |
| | `updateAgentStatus(agentId, status, caps?)` | Update agent status & capabilities |
| | `deleteAgent(agentId)` | Remove an agent |
| | `refreshAgent(agentId)` | Trigger a live-probe refresh |
| **Auto-pagination** | `searchAgentsAll(params?)` | `AsyncGenerator` — yields every matching agent across all pages |
| | `listAgentsAll(params?)` | `AsyncGenerator` — yields every agent across all pages |
| **Discovery** | `getAgentFacts(agentId)` | Get AgentFacts (v1/v2 metadata) |
| | `getAgentCard()` | Get the node's A2A agent card |
| | `getNandaIndex()` | Get `.well-known/nanda-index` descriptor |
| | `diffIndex(since)` | Get added/updated/removed agents since a `Date` |
| | `subscribeToIndex(cb, intervalMs?)` | Long-poll watcher; returns `stop()` function |
| **Stats** | `stats()` | Get registry statistics |
| **Orchestration** | `createWorkflow(req)` | Create a DAG workflow |
| | `listWorkflows(params?)` | List workflows by owner/status |
| | `getWorkflow(workflowId)` | Get workflow details + runs |
| | `updateWorkflow(workflowId, updates)` | Update a workflow |
| | `deleteWorkflow(workflowId)` | Delete a workflow |
| | `runWorkflow(workflowId, input?)` | Execute a workflow and return run result |
| | `getWorkflowStatus(runId)` | Get run status + step details |
| | `cancelWorkflowRun(runId)` | Cancel a running workflow |
| | `streamWorkflowEvents(runId)` | `AsyncGenerator<Record<string, unknown>>` — SSE stream |
| **Routing & Delegation** | `routeRequest(params)` | Intelligent agent routing |
| | `delegateTask(params)` | Delegate a sub-task to an agent |
| | `listDelegations(workflowId)` | List delegations for a workflow |
| **Patterns & Conflicts** | `listPatterns(options?)` | List orchestrator patterns |
| | `createPattern(params)` | Register a new pattern |
| | `listConflicts(params?)` | List orchestration conflicts |
| | `raiseConflict(params)` | Raise a conflict for resolution |
| **Resolution** | `resolveAgent(agentId)` | Resolve an agent via Lean Index |
| | `adaptiveResolve(agentId, ctx?)` | Multi-strategy adaptive resolution |
| **Trust & Reputation** | `getReputation()` | Get agent reputation entries |
| | `getTrustScores(options?)` | Query trust scores |
| | `getTrustFrameworks(options?)` | Query trust frameworks |
| | `syncCrossRegistryTrust(adminKey?)` | Trigger cross-registry trust sync |
| **A2A** | `sendA2ARequest(agentId, payload)` | Send a JSON-RPC A2A request to a remote agent |
| | `streamA2ARequest(agentId, payload)` | `AsyncGenerator` — stream SSE from a remote A2A agent |
| **Billing** | `getSubscription(keyId)` | Get subscription details |
| | `createSubscription(params)` | Create a subscription |
| | `listInvoices(keyId)` | List invoices for a key |
| | `createInvoice(params)` | Create an invoice |
| | `getEarnings(developerId, view?)` | Get developer earnings |
| | `earningsAction(params)` | Perform an earnings action (withdraw, etc.) |
| **Checkout (UCP)** | `createCheckoutSession(params)` | Create a checkout session |
| | `getCheckoutSession(sessionId)` | Get checkout session details |
| | `submitCheckoutPayment(sessionId, payment)` | Submit payment for a checkout |
| | `cancelCheckoutSession(sessionId)` | Cancel a checkout session |
| **Webhooks** | `listWebhooks()` | List webhook subscriptions |
| | `createWebhook(params)` | Create a webhook (returns `secret`) |
| | `getWebhook(webhookId)` | Get a webhook subscription |
| | `updateWebhook(webhookId, action)` | Pause or resume a webhook |
| | `deleteWebhook(webhookId)` | Delete a webhook subscription |
| **Federation** | `getFederationPeers()` | List federation peers |
| | `getFederationStatus()` | Get federation status |
| | `getFederatedAgents()` | List agents federated from peers |

### Standalone Functions

Retry utilities are available as standalone functions for consumers who need lower-level control:

```typescript
import { fetchWithRetry, normalizeBaseUrl, calculateBackoffDelay, isTransientError } from '@nexartis/nexartis-nanda-node-sdk';
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

### Configuration

All methods use exponential backoff with jitter by default. The client also supports lifecycle hooks, a built-in circuit breaker, and OpenTelemetry trace propagation:

```typescript
const nnn = new NnnClient({
  baseUrl: 'https://nanda.nexartis.com',
  apiKey: 'your-api-key',

  // Retry tuning
  retryConfig: {
    maxRetries: 5,       // default: 3
    baseDelayMs: 500,    // default: 1000
    maxDelayMs: 15000,   // default: 10000
    timeoutMs: 10000,    // default: 8000
  },

  // Lifecycle hooks
  hooks: {
    beforeRequest: (url, init) => { /* mutate headers, log, etc. */ },
    afterResponse: (url, response, durationMs) => { /* metrics, logging */ },
    onError: (url, error) => { /* alerting */ },
  },

  // Circuit breaker (pass `false` to disable)
  circuitBreaker: {
    failureThreshold: 5,   // consecutive failures to trip
    cooldownMs: 30_000,    // ms before a probe request is allowed
  },

  // OpenTelemetry trace context propagation
  traceContext: {
    traceparent: '00-abc123-def456-01',
    tracestate: 'vendor=value',
  },
});

// Trace context can also be updated at runtime
nnn.setTraceContext({ traceparent: '00-newTrace-newSpan-01' });
```

## Design Principles

- **Zero dependencies** — only standard `fetch`
- **No env reads** — all configuration via constructor injection
- **Typed errors** — `NnnError` enum codes, never raw strings
- **Retry resilience** — exponential backoff + jitter, caller abort signal forwarding
- **Circuit breaker** — automatic failure isolation with half-open probing; external A2A calls are scoped separately to prevent third-party failures from tripping the registry breaker
- **A2A compatible** — first-class support for Agent Card JSON, NANDA Index, and SSE streaming
- **Auto-pagination** — `searchAgentsAll()` and `listAgentsAll()` async generators handle cursor pagination with stale-cursor guards

## License

Proprietary — Nexartis LLC. All rights reserved.
