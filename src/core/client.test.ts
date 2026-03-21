import { describe, it, expect, vi, afterEach } from 'vitest';
import { NnnClient } from './client';
import { NnnError, NnnErrorCode } from './errors';

/** Helper to mock globalThis.fetch */
function mockFetch(response: { status: number; body: unknown }) {
	globalThis.fetch = vi.fn().mockImplementation(() =>
		Promise.resolve(
			new Response(JSON.stringify(response.body), {
				status: response.status,
				headers: { 'Content-Type': 'application/json' }
			})
		)
	);
}

const BASE_CONFIG = {
	baseUrl: 'https://nanda.test.com',
	apiKey: 'test-key',
	retryConfig: { maxRetries: 0, timeoutMs: 5000 }
};

describe('NnnClient', () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	describe('constructor', () => {
		it('throws on missing baseUrl', () => {
			expect(() => new NnnClient({ baseUrl: '' })).toThrow(NnnError);
		});

		it('strips trailing slashes from baseUrl', () => {
			const client = new NnnClient({ baseUrl: 'https://nanda.test.com///' });
			expect(client.baseUrl).toBe('https://nanda.test.com');
		});
	});

	describe('health()', () => {
		it('returns health status', async () => {
			const healthData = { status: 'ok', timestamp: '2026-01-01', environment: 'test', agents: 5, checks: { db: 'ok', r2: 'ok', kv: 'ok', queues: 'ok' } };
			mockFetch({ status: 200, body: healthData });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.health();
			expect(result.status).toBe('ok');
			expect(result.agents).toBe(5);
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 500, body: 'server down' });

			const client = new NnnClient(BASE_CONFIG);
			await expect(client.health()).rejects.toThrow(NnnError);
		});
	});

	describe('isHealthy()', () => {
		it('returns true when healthy', async () => {
			mockFetch({ status: 200, body: { status: 'ok' } });
			const client = new NnnClient(BASE_CONFIG);
			expect(await client.isHealthy()).toBe(true);
		});

		it('returns false when degraded', async () => {
			mockFetch({ status: 200, body: { status: 'degraded' } });
			const client = new NnnClient(BASE_CONFIG);
			expect(await client.isHealthy()).toBe(false);
		});

		it('returns false on network error', async () => {
			globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));
			const client = new NnnClient(BASE_CONFIG);
			expect(await client.isHealthy()).toBe(false);
		});
	});

	describe('registerAgent()', () => {
		it('posts agent registration', async () => {
			mockFetch({ status: 200, body: { status: 'success', message: 'registered' } });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.registerAgent({
				agent_id: 'agent-1',
				agent_url: 'https://agent.example.com'
			});
			expect(result.status).toBe('success');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/register');
			expect(fetchCall[1].method).toBe('POST');
		});
	});

	describe('lookupAgent()', () => {
		it('looks up agent by ID', async () => {
			const agent = { agent_id: 'agent-1', agent_url: 'https://example.com' };
			mockFetch({ status: 200, body: agent });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.lookupAgent('agent-1');
			expect(result.agent_id).toBe('agent-1');
		});
	});

	describe('searchAgents()', () => {
		it('builds query params correctly', async () => {
			mockFetch({ status: 200, body: [] });

			const client = new NnnClient(BASE_CONFIG);
			await client.searchAgents({ q: 'test', capabilities: ['a2a'], tags: ['prod'], min_trust: 0.8 });

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			const url = fetchCall[0] as string;
			expect(url).toContain('q=test');
			expect(url).toContain('capabilities=a2a');
			expect(url).toContain('tags=prod');
			expect(url).toContain('min_trust=0.8');
		});

		it('works with no params', async () => {
			mockFetch({ status: 200, body: [] });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.searchAgents();
			expect(result).toEqual([]);
		});
	});

	describe('getAgentFacts()', () => {
		it('fetches agent facts', async () => {
			mockFetch({ status: 200, body: { agent_id: 'agent-1', schema_version: '2.0' } });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.getAgentFacts('agent-1');
			expect(result.agent_id).toBe('agent-1');
		});
	});

	describe('getNandaIndex()', () => {
		it('fetches NANDA index', async () => {
			const index = { node_id: 'nnn-1', version: '1.0', supported_protocols: ['a2a'], agent_count: 10 };
			mockFetch({ status: 200, body: index });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.getNandaIndex();
			expect(result.node_id).toBe('nnn-1');
		});
	});

	describe('createWorkflow()', () => {
		it('posts a workflow creation request', async () => {
			const workflow = { id: 'wf-1', name: 'Test Workflow', ownerId: 'owner-1', status: 'active', createdAt: '2026-01-01', updatedAt: '2026-01-01' };
			mockFetch({ status: 200, body: { status: 'created', workflow } });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.createWorkflow({
				name: 'Test Workflow',
				owner_id: 'owner-1',
				dag: { nodes: [{ id: 'n1', type: 'agent' }], edges: [] }
			});
			expect(result.status).toBe('created');
			expect(result.workflow.id).toBe('wf-1');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/orchestration');
			expect(fetchCall[1].method).toBe('POST');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 500, body: 'internal error' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.createWorkflow({
				name: 'Fail',
				owner_id: 'owner-1',
				dag: { nodes: [], edges: [] }
			})).rejects.toThrow(NnnError);
		});
	});

	describe('listWorkflows()', () => {
		it('lists workflows without filters', async () => {
			const workflows = [{ id: 'wf-1', name: 'WF1', ownerId: 'o1', status: 'active', createdAt: '2026-01-01', updatedAt: '2026-01-01' }];
			mockFetch({ status: 200, body: { workflows } });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.listWorkflows();
			expect(result.workflows).toHaveLength(1);
			expect(result.workflows[0].id).toBe('wf-1');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			const url = fetchCall[0] as string;
			expect(url).toContain('/api/orchestration');
			expect(url).not.toContain('?');
		});

		it('passes filter params as query string', async () => {
			mockFetch({ status: 200, body: { workflows: [] } });

			const client = new NnnClient(BASE_CONFIG);
			await client.listWorkflows({ ownerId: 'owner-1', status: 'active' });

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			const url = fetchCall[0] as string;
			expect(url).toContain('ownerId=owner-1');
			expect(url).toContain('status=active');
		});
	});

	describe('runWorkflow()', () => {
		it('runs a workflow by ID', async () => {
			const runResult = {
				runId: 'run-1',
				status: 'completed',
				output: { result: 'success' },
				stepResults: [{ stepId: 'step-1', status: 'completed', output: 'done', durationMs: 150 }]
			};
			mockFetch({ status: 200, body: runResult });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.runWorkflow('wf-1', { prompt: 'hello' });
			expect(result.runId).toBe('run-1');
			expect(result.status).toBe('completed');
			expect(result.stepResults).toHaveLength(1);

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/orchestration/wf-1/run');
			expect(fetchCall[1].method).toBe('POST');
			expect(JSON.parse(fetchCall[1].body)).toEqual({ prompt: 'hello' });
		});

		it('runs with no input', async () => {
			mockFetch({ status: 200, body: { runId: 'run-2', status: 'running', stepResults: [] } });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.runWorkflow('wf-2');
			expect(result.runId).toBe('run-2');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(JSON.parse(fetchCall[1].body)).toEqual({});
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 404, body: 'workflow not found' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.runWorkflow('nonexistent')).rejects.toThrow(NnnError);
		});
	});

	// ── Phase 1 Tests ────────────────────────────────────────────────

	describe('sendA2ARequest()', () => {
		it('sends A2A request with auto-discovery', async () => {
			const agent = { agent_id: 'agent-xyz', agent_url: 'https://agent.example.com', api_url: 'https://agent.example.com/api' };
			const a2aResponse = { jsonrpc: '2.0', id: '1', result: { status: 'ok' } };

			let callCount = 0;
			globalThis.fetch = vi.fn().mockImplementation(() => {
				callCount++;
				if (callCount === 1) {
					// lookupAgent call
					return Promise.resolve(new Response(JSON.stringify(agent), { status: 200, headers: { 'Content-Type': 'application/json' } }));
				}
				// A2A call
				return Promise.resolve(new Response(JSON.stringify(a2aResponse), { status: 200, headers: { 'Content-Type': 'application/json' } }));
			});

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.sendA2ARequest({
				target_agent_id: 'agent-xyz',
				method: 'tasks/send',
				params: { message: { role: 'user', parts: [{ type: 'text', text: 'Hello' }] } }
			});

			expect(result.result).toEqual({ status: 'ok' });
			expect(globalThis.fetch).toHaveBeenCalledTimes(2);
			// Second call should be to the api_url
			const secondCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1];
			expect(secondCall[0]).toBe('https://agent.example.com/api');
		});

		it('uses target_url directly when provided', async () => {
			const a2aResponse = { jsonrpc: '2.0', id: '1', result: { done: true } };
			mockFetch({ status: 200, body: a2aResponse });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.sendA2ARequest({
				target_agent_id: 'agent-xyz',
				target_url: 'https://direct.example.com/rpc',
				method: 'tasks/send'
			});

			expect(result.result).toEqual({ done: true });
			expect(globalThis.fetch).toHaveBeenCalledTimes(1);
			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toBe('https://direct.example.com/rpc');
		});
	});

	describe('updateAgent()', () => {
		it('sends PUT request to update agent', async () => {
			const updated = { agent_id: 'agent-1', agent_url: 'https://updated.example.com', capabilities: ['a2a', 'mcp'] };
			mockFetch({ status: 200, body: updated });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.updateAgent('agent-1', { capabilities: ['a2a', 'mcp'] });
			expect(result.capabilities).toEqual(['a2a', 'mcp']);

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/agents/agent-1');
			expect(fetchCall[1].method).toBe('PUT');
		});
	});

	describe('deleteAgent()', () => {
		it('sends DELETE request', async () => {
			mockFetch({ status: 200, body: { status: 'deleted', message: 'Agent removed' } });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.deleteAgent('agent-1');
			expect(result.status).toBe('deleted');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/agents/agent-1');
			expect(fetchCall[1].method).toBe('DELETE');
		});
	});

	describe('refreshAgent()', () => {
		it('sends POST to refresh agent card', async () => {
			mockFetch({ status: 200, body: { status: 'refreshed', message: 'Card re-crawled' } });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.refreshAgent('agent-1');
			expect(result.status).toBe('refreshed');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/agents/agent-1/refresh');
			expect(fetchCall[1].method).toBe('POST');
		});
	});

	describe('routeRequest()', () => {
		it('routes request to best-matching agent', async () => {
			const routeResult = {
				targetAgent: { agent_id: 'agent-best', agent_url: 'https://best.example.com' },
				score: 0.95,
				protocol: 'a2a',
				latencyEstimateMs: 120
			};
			mockFetch({ status: 200, body: routeResult });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.routeRequest({
				skill: 'code-review',
				min_trust: 0.8,
				strategy: 'best-match'
			});

			expect(result.targetAgent.agent_id).toBe('agent-best');
			expect(result.score).toBe(0.95);

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/routing');
			expect(fetchCall[1].method).toBe('POST');
		});
	});

	describe('getWorkflowStatus()', () => {
		it('fetches workflow run status', async () => {
			const status = { workflowId: 'wf-1', runId: 'run-1', status: 'running', startedAt: '2026-01-01' };
			mockFetch({ status: 200, body: status });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.getWorkflowStatus('wf-1', 'run-1');
			expect(result.status).toBe('running');
			expect(result.runId).toBe('run-1');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/orchestration/wf-1/runs/run-1');
		});
	});

	describe('cancelWorkflowRun()', () => {
		it('cancels an in-progress workflow run', async () => {
			mockFetch({ status: 200, body: { status: 'cancelled', message: 'Run aborted' } });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.cancelWorkflowRun('wf-1', 'run-1');
			expect(result.status).toBe('cancelled');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/orchestration/wf-1/runs/run-1/cancel');
			expect(fetchCall[1].method).toBe('POST');
		});
	});

	describe('diffIndex()', () => {
		it('fetches index diff since a timestamp', async () => {
			const diff = {
				since: '2026-01-01T00:00:00.000Z',
				added: [{ agent_id: 'new-agent', agent_url: 'https://new.example.com' }],
				removed: ['old-agent'],
				updated: []
			};
			mockFetch({ status: 200, body: diff });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.diffIndex(new Date('2026-01-01'));
			expect(result.added).toHaveLength(1);
			expect(result.removed).toEqual(['old-agent']);

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/index/diff');
			expect(fetchCall[0]).toContain('since=');
		});
	});

	describe('subscribeToIndex()', () => {
		it('returns an unsubscribe function', () => {
			const client = new NnnClient(BASE_CONFIG);
			// Mock fetch to prevent actual polling
			globalThis.fetch = vi.fn().mockImplementation(() =>
				new Promise(() => {}) // never resolves — simulates long poll
			);
			const callback = vi.fn();
			const unsubscribe = client.subscribeToIndex(callback, 60_000);
			expect(typeof unsubscribe).toBe('function');
			unsubscribe();
		});
	});

	// ── Phase 2 Tests ────────────────────────────────────────────────

	describe('lifecycle hooks', () => {
		it('calls beforeRequest hook', async () => {
			const beforeRequest = vi.fn();
			mockFetch({ status: 200, body: { status: 'ok' } });

			const client = new NnnClient({ ...BASE_CONFIG, hooks: { beforeRequest } });
			await client.health();

			expect(beforeRequest).toHaveBeenCalledTimes(1);
			expect(beforeRequest.mock.calls[0][0]).toContain('/health');
		});

		it('calls afterResponse hook with duration', async () => {
			const afterResponse = vi.fn();
			mockFetch({ status: 200, body: { status: 'ok' } });

			const client = new NnnClient({ ...BASE_CONFIG, hooks: { afterResponse } });
			await client.health();

			expect(afterResponse).toHaveBeenCalledTimes(1);
			expect(afterResponse.mock.calls[0][0]).toContain('/health');
			expect(typeof afterResponse.mock.calls[0][2]).toBe('number'); // durationMs
		});

		it('calls onError hook on failure', async () => {
			const onError = vi.fn();
			globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));

			const client = new NnnClient({ ...BASE_CONFIG, hooks: { onError } });
			await expect(client.health()).rejects.toThrow();

			expect(onError).toHaveBeenCalledTimes(1);
		});
	});

	describe('trace context propagation', () => {
		it('propagates traceparent header', async () => {
			mockFetch({ status: 200, body: { status: 'ok' } });

			const client = new NnnClient({
				...BASE_CONFIG,
				traceContext: { traceparent: '00-abc123-def456-01' }
			});
			await client.health();

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			const headers = fetchCall[1].headers;
			expect(headers['traceparent']).toBe('00-abc123-def456-01');
		});

		it('updates trace context via setTraceContext', async () => {
			mockFetch({ status: 200, body: { status: 'ok' } });

			const client = new NnnClient(BASE_CONFIG);
			client.setTraceContext({ traceparent: '00-new-trace-01' });
			await client.health();

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			const headers = fetchCall[1].headers;
			expect(headers['traceparent']).toBe('00-new-trace-01');
		});
	});

	describe('circuit breaker', () => {
		it('trips after consecutive failures', async () => {
			globalThis.fetch = vi.fn().mockRejectedValue(new Error('server down'));

			const client = new NnnClient({
				...BASE_CONFIG,
				circuitBreaker: { failureThreshold: 2, cooldownMs: 60_000 }
			});

			// First two failures should go through
			await expect(client.health()).rejects.toThrow();
			await expect(client.health()).rejects.toThrow();

			// Third should be fast-failed by circuit breaker
			await expect(client.health()).rejects.toThrow(/Circuit breaker is open/);
			// fetch should only have been called twice (not three times)
			expect(globalThis.fetch).toHaveBeenCalledTimes(2);
		});

		it('can be disabled', async () => {
			globalThis.fetch = vi.fn().mockRejectedValue(new Error('server down'));

			const client = new NnnClient({
				...BASE_CONFIG,
				circuitBreaker: false
			});

			// All calls should go through even with many failures
			for (let i = 0; i < 10; i++) {
				await expect(client.health()).rejects.toThrow();
			}
			expect(globalThis.fetch).toHaveBeenCalledTimes(10);
		});
	});

	describe('deepHealth()', () => {
		it('returns healthy=true when all checks pass', async () => {
			const healthData = { status: 'ok', timestamp: '2026-01-01', environment: 'test', agents: 5, checks: { db: 'ok', r2: 'ok', kv: 'ok', queues: 'ok' } };
			mockFetch({ status: 200, body: healthData });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.deepHealth();
			expect(result.healthy).toBe(true);
			expect(result.degradedChecks).toEqual([]);
		});

		it('returns degraded checks', async () => {
			const healthData = { status: 'degraded', timestamp: '2026-01-01', environment: 'test', agents: 5, checks: { db: 'ok', r2: 'error', kv: 'ok', queues: 'error' } };
			mockFetch({ status: 200, body: healthData });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.deepHealth();
			expect(result.healthy).toBe(false);
			expect(result.degradedChecks).toEqual(['r2', 'queues']);
		});
	});

	describe('structured error context', () => {
		it('enriches NnnError with durationMs on failure', async () => {
			globalThis.fetch = vi.fn().mockRejectedValue(new Error('timeout'));

			const client = new NnnClient(BASE_CONFIG);
			try {
				await client.health();
			} catch (err) {
				expect(err).toBeInstanceOf(NnnError);
				expect((err as NnnError).context.durationMs).toBeGreaterThanOrEqual(0);
			}
		});
	});

	// ── Phase 3 Tests ────────────────────────────────────────────────────

	describe('searchAgentsAll()', () => {
		it('auto-paginates through multiple pages', async () => {
			let callCount = 0;
			globalThis.fetch = vi.fn().mockImplementation(() => {
				callCount++;
				const page = callCount === 1
					? { data: [{ agent_id: 'a1' }, { agent_id: 'a2' }], cursor: 'page2', hasMore: true }
					: { data: [{ agent_id: 'a3' }], cursor: undefined, hasMore: false };
				return Promise.resolve(new Response(JSON.stringify(page), { status: 200, headers: { 'Content-Type': 'application/json' } }));
			});

			const client = new NnnClient(BASE_CONFIG);
			const agents: Array<{ agent_id: string }> = [];
			for await (const agent of client.searchAgentsAll({ q: 'test', limit: 2 })) {
				agents.push(agent);
			}

			expect(agents).toHaveLength(3);
			expect(agents.map(a => a.agent_id)).toEqual(['a1', 'a2', 'a3']);
			expect(globalThis.fetch).toHaveBeenCalledTimes(2);
		});

		it('handles empty results', async () => {
			mockFetch({ status: 200, body: { data: [], hasMore: false } });

			const client = new NnnClient(BASE_CONFIG);
			const agents: unknown[] = [];
			for await (const agent of client.searchAgentsAll()) {
				agents.push(agent);
			}

			expect(agents).toHaveLength(0);
		});
	});

	describe('listAgentsAll()', () => {
		it('auto-paginates through all agents', async () => {
			let callCount = 0;
			globalThis.fetch = vi.fn().mockImplementation(() => {
				callCount++;
				const page = callCount === 1
					? { data: [{ agent_id: 'x1' }], cursor: 'next', hasMore: true }
					: { data: [{ agent_id: 'x2' }], cursor: undefined, hasMore: false };
				return Promise.resolve(new Response(JSON.stringify(page), { status: 200, headers: { 'Content-Type': 'application/json' } }));
			});

			const client = new NnnClient(BASE_CONFIG);
			const agents: Array<{ agent_id: string }> = [];
			for await (const agent of client.listAgentsAll({ limit: 1 })) {
				agents.push(agent);
			}

			expect(agents).toHaveLength(2);
			expect(agents.map(a => a.agent_id)).toEqual(['x1', 'x2']);
		});
	});
});

