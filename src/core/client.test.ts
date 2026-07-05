// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi, afterEach } from 'vitest';
import { NnnClient, SDK_VERSION } from './client';
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

		it('exports the current package version for request metadata', () => {
			expect(SDK_VERSION).toBe('1.2.2');
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
			mockFetch({ status: 200, body: { status: 'ok', checks: { db: 'ok', redis: 'ok' } } });
			const client = new NnnClient(BASE_CONFIG);
			expect(await client.isHealthy()).toBe(true);
		});

		it('returns false when degraded', async () => {
			mockFetch({ status: 200, body: { status: 'degraded', checks: { db: 'ok', redis: 'degraded' } } });
			const client = new NnnClient(BASE_CONFIG);
			expect(await client.isHealthy()).toBe(false);
		});

		it('returns false on network error', async () => {
			globalThis.fetch = vi.fn().mockRejectedValue(new Error('network down'));
			const client = new NnnClient(BASE_CONFIG);
			expect(await client.isHealthy()).toBe(false);
		});
	});

	describe('agents.register()', () => {
		it('posts agent registration', async () => {
			mockFetch({ status: 200, body: { status: 'success', message: 'registered' } });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.agents.register({
				agent_id: 'agent-1',
				agent_url: 'https://agent.example.com'
			});
			expect(result.status).toBe('success');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/register');
			expect(fetchCall[1].method).toBe('POST');
		});
	});

	describe('agents.lookup()', () => {
		it('looks up agent by ID', async () => {
			const agent = { agent_id: 'agent-1', agent_url: 'https://example.com' };
			mockFetch({ status: 200, body: agent });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.agents.lookup('agent-1');
			expect(result.agent_id).toBe('agent-1');
		});
	});

	describe('agents.search()', () => {
		it('builds query params correctly', async () => {
			mockFetch({ status: 200, body: [] });

			const client = new NnnClient(BASE_CONFIG);
			await client.agents.search({ q: 'test', capabilities: ['a2a'], tags: ['prod'], min_trust: 0.8 });

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
			const result = await client.agents.search();
			expect(result).toEqual([]);
		});
	});

	describe('agents.getFacts()', () => {
		it('fetches agent facts', async () => {
			mockFetch({ status: 200, body: { agent_id: 'agent-1', schema_version: '2.0' } });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.agents.getFacts('agent-1');
			expect(result.agent_id).toBe('agent-1');
		});
	});

	describe('agents.getNandaIndex()', () => {
		it('fetches NANDA index', async () => {
			const index = { node_id: 'nnn-1', version: '1.0', supported_protocols: ['a2a'], agent_count: 10 };
			mockFetch({ status: 200, body: index });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.agents.getNandaIndex();
			expect(result.node_id).toBe('nnn-1');
		});
	});

	describe('orchestration.createWorkflow()', () => {
		it('posts a workflow creation request', async () => {
			const workflow = { id: 'wf-1', name: 'Test Workflow', ownerId: 'owner-1', status: 'active', createdAt: '2026-01-01', updatedAt: '2026-01-01' };
			mockFetch({ status: 200, body: { status: 'created', workflow } });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.orchestration.createWorkflow({
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
			await expect(client.orchestration.createWorkflow({
				name: 'Fail',
				owner_id: 'owner-1',
				dag: { nodes: [], edges: [] }
			})).rejects.toThrow(NnnError);
		});
	});

	describe('orchestration.listWorkflows()', () => {
		it('lists workflows without filters', async () => {
			const workflows = [{ id: 'wf-1', name: 'WF1', ownerId: 'o1', status: 'active', createdAt: '2026-01-01', updatedAt: '2026-01-01' }];
			mockFetch({ status: 200, body: { workflows } });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.orchestration.listWorkflows();
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
			await client.orchestration.listWorkflows({ ownerId: 'owner-1', status: 'active' });

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			const url = fetchCall[0] as string;
			expect(url).toContain('owner_id=owner-1');
			expect(url).toContain('status=active');
		});
	});

	describe('orchestration.runWorkflow()', () => {
		it('runs a workflow by ID', async () => {
			const runResult = {
				run_id: 'run-1',
				status: 'completed'
			};
			mockFetch({ status: 200, body: runResult });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.orchestration.runWorkflow('wf-1', { prompt: 'hello' });
			expect(result.run_id).toBe('run-1');
			expect(result.status).toBe('completed');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/orchestration/wf-1/runs');
			expect(fetchCall[1].method).toBe('POST');
			expect(JSON.parse(fetchCall[1].body)).toEqual({ prompt: 'hello' });
		});

		it('runs with no input', async () => {
			mockFetch({ status: 200, body: { run_id: 'run-2', status: 'running' } });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.orchestration.runWorkflow('wf-2');
			expect(result.run_id).toBe('run-2');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(JSON.parse(fetchCall[1].body)).toEqual({});
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 404, body: 'workflow not found' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.orchestration.runWorkflow('nonexistent')).rejects.toThrow(NnnError);
		});
	});

	// ── Orchestration CRUD ────────────────────────────────────────

	describe('orchestration.getWorkflow()', () => {
		it('fetches a single workflow by ID', async () => {
			const detail = {
				workflow: { id: 'wf-1', name: 'WF1', ownerId: 'o1', status: 'active', dag: { nodes: [], edges: [] }, metadata: {}, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
				steps: [{ id: 's1', workflowId: 'wf-1', agentId: 'a1', action: 'run', order: 1, config: {}, dependsOn: [], condition: null }]
			};
			mockFetch({ status: 200, body: detail });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.orchestration.getWorkflow('wf-1');
			expect(result.workflow.id).toBe('wf-1');
			expect(result.steps).toHaveLength(1);

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/orchestration/wf-1');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 404, body: 'not found' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.orchestration.getWorkflow('nonexistent')).rejects.toThrow(NnnError);
		});
	});

	describe('orchestration.updateWorkflow()', () => {
		it('sends PATCH request to update a workflow', async () => {
			const updated = { ok: true, workflow: { id: 'wf-1', name: 'Updated', ownerId: 'o1', status: 'active', createdAt: '2026-01-01', updatedAt: '2026-01-02' } };
			mockFetch({ status: 200, body: updated });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.orchestration.updateWorkflow('wf-1', { name: 'Updated', status: 'active' });
			expect(result.ok).toBe(true);
			expect(result.workflow.name).toBe('Updated');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/orchestration/wf-1');
			expect(fetchCall[1].method).toBe('PATCH');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 500, body: 'internal error' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.orchestration.updateWorkflow('wf-1', { name: 'Fail' })).rejects.toThrow(NnnError);
		});
	});

	describe('orchestration.deleteWorkflow()', () => {
		it('sends DELETE request to delete a workflow', async () => {
			mockFetch({ status: 200, body: { ok: true, deleted: 'wf-1' } });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.orchestration.deleteWorkflow('wf-1');
			expect(result.ok).toBe(true);
			expect(result.deleted).toBe('wf-1');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/orchestration/wf-1');
			expect(fetchCall[1].method).toBe('DELETE');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 404, body: 'not found' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.orchestration.deleteWorkflow('nonexistent')).rejects.toThrow(NnnError);
		});
	});

	describe('orchestration.delegateTask()', () => {
		it('posts a delegation request', async () => {
			const delegation = { id: 'del-1', status: 'completed', delegator_id: 'agent-1', action: 'summarize', target_agent_id: 'agent-2', result: { summary: 'done' }, created_at: '2026-01-01' };
			mockFetch({ status: 200, body: delegation });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.orchestration.delegateTask({ delegator_id: 'agent-1', action: 'summarize', target_agent_id: 'agent-2' });
			expect(result.id).toBe('del-1');
			expect(result.status).toBe('completed');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/orchestration/delegate');
			expect(fetchCall[1].method).toBe('POST');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 500, body: 'internal error' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.orchestration.delegateTask({ delegator_id: 'a', action: 'b' })).rejects.toThrow(NnnError);
		});
	});

	describe('orchestration.listDelegations()', () => {
		it('fetches delegations for a workflow', async () => {
			const delegations = [{ id: 'del-1', status: 'completed', delegator_id: 'a1', action: 'run', created_at: '2026-01-01' }];
			mockFetch({ status: 200, body: { delegations } });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.orchestration.listDelegations('wf-1');
			expect(result.delegations).toHaveLength(1);

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/orchestration/delegate');
			expect(fetchCall[0]).toContain('workflow_id=wf-1');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 500, body: 'error' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.orchestration.listDelegations('wf-1')).rejects.toThrow(NnnError);
		});
	});

	// Helper to mock a `/a2a` response wrapping a delegation payload.
	function mockA2AResult(payload: unknown) {
		mockFetch({
			status: 200,
			body: {
				jsonrpc: '2.0',
				id: 'test',
				result: { role: 'agent', parts: [{ text: JSON.stringify(payload) }] }
			}
		});
	}

	describe('orchestration.grantDelegation()', () => {
		it('posts a delegation.grant A2A envelope and unwraps the result', async () => {
			const grantResult = { delegationId: 'del-42', kymVcId: 'vc-1', expiresAt: 1900000000 };
			mockA2AResult(grantResult);

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.orchestration.grantDelegation({
				granted_by_did: 'did:key:parent',
				granted_to_did: 'did:key:child',
				granted_scope: ['tool:search'],
				expires_at: 1900000000,
				granted_by_proof_hash: 'a'.repeat(64)
			});

			expect(result).toEqual(grantResult);

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/a2a');
			expect(fetchCall[1].method).toBe('POST');
			const body = JSON.parse(fetchCall[1].body as string);
			expect(body.jsonrpc).toBe('2.0');
			expect(body.method).toBe('message/send');
			const inner = JSON.parse(body.params.message.parts[0].text);
			expect(inner.action).toBe('delegation.grant');
			expect(inner.granted_by_did).toBe('did:key:parent');
			expect(inner.granted_scope).toEqual(['tool:search']);
		});

		it('surfaces JSON-RPC error as NnnError', async () => {
			mockFetch({
				status: 200,
				body: {
					jsonrpc: '2.0',
					id: 'test',
					error: { code: -32602, message: 'scope-widens-parent: Child scope "x" is not present in parent grantedScope' }
				}
			});
			const client = new NnnClient(BASE_CONFIG);
			await expect(
				client.orchestration.grantDelegation({
					granted_by_did: 'did:key:parent',
					granted_to_did: 'did:key:child',
					granted_scope: ['x'],
					expires_at: 1,
					granted_by_proof_hash: 'a'.repeat(64)
				})
			).rejects.toThrow(/scope-widens-parent/);
		});
	});

	describe('orchestration.revokeDelegation()', () => {
		it('posts a delegation.revoke envelope and returns the cascade list', async () => {
			const revokeResult = { revoked: true, revokedAt: 1800000000, cascadedIds: ['del-child-1'] };
			mockA2AResult(revokeResult);

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.orchestration.revokeDelegation({
				delegation_id: 'del-42',
				reason: 'user-request'
			});
			expect(result).toEqual(revokeResult);

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			const inner = JSON.parse(JSON.parse(fetchCall[1].body as string).params.message.parts[0].text);
			expect(inner.action).toBe('delegation.revoke');
			expect(inner.delegation_id).toBe('del-42');
			expect(inner.reason).toBe('user-request');
		});
	});

	describe('orchestration.checkDelegation()', () => {
		it('posts a delegation.check envelope and returns the validity payload', async () => {
			const checkResult = {
				valid: true,
				revoked: false,
				expired: false,
				expiresAt: 1900000000,
				credentialSubject: { grantedToDid: 'did:key:child', grantedByDid: 'did:key:parent', scope: ['tool:search'] }
			};
			mockA2AResult(checkResult);

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.orchestration.checkDelegation('del-42');
			expect(result.valid).toBe(true);
			expect(result.credentialSubject.scope).toEqual(['tool:search']);

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			const inner = JSON.parse(JSON.parse(fetchCall[1].body as string).params.message.parts[0].text);
			expect(inner.action).toBe('delegation.check');
			expect(inner.delegation_id).toBe('del-42');
		});

		it('rejects empty delegation IDs', async () => {
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.orchestration.checkDelegation('')).rejects.toThrow(NnnError);
		});

		it('throws NnnError when the A2A response lacks a text part', async () => {
			mockFetch({
				status: 200,
				body: { jsonrpc: '2.0', id: 'test', result: { role: 'agent', parts: [] } }
			});
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.orchestration.checkDelegation('del-42')).rejects.toThrow(/malformed A2A response/);
		});
	});

	describe('orchestration.listPatterns()', () => {
		it('lists patterns without filters', async () => {
			const patterns = [{ id: 'p1', name: 'Sequential', description: null, category: 'basic', dagTemplate: { nodes: [], edges: [] }, inputSchema: null, tags: [], isBuiltin: 1 }];
			mockFetch({ status: 200, body: { patterns } });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.orchestration.listPatterns();
			expect(result.patterns).toHaveLength(1);

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/orchestration/patterns');
			expect(fetchCall[0]).not.toContain('?');
		});

		it('passes filter params', async () => {
			mockFetch({ status: 200, body: { patterns: [] } });
			const client = new NnnClient(BASE_CONFIG);
			await client.orchestration.listPatterns({ category: 'advanced', builtin: true });

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('category=advanced');
			expect(fetchCall[0]).toContain('builtin=true');
		});
	});

	describe('orchestration.createPattern()', () => {
		it('posts a new pattern', async () => {
			const pattern = { id: 'p2', name: 'Fan-out', description: 'Parallel', category: 'advanced', dagTemplate: { nodes: [], edges: [] }, inputSchema: null, tags: ['parallel'], isBuiltin: 0 };
			mockFetch({ status: 201, body: { status: 'created', pattern } });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.orchestration.createPattern({ name: 'Fan-out', dag_template: { nodes: [], edges: [] }, tags: ['parallel'] });
			expect(result.status).toBe('created');
			expect(result.pattern.name).toBe('Fan-out');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/orchestration/patterns');
			expect(fetchCall[1].method).toBe('POST');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 400, body: 'bad request' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.orchestration.createPattern({ name: '', dag_template: { nodes: [], edges: [] } })).rejects.toThrow(NnnError);
		});
	});

	describe('orchestration.listConflicts()', () => {
		it('lists conflicts without filters', async () => {
			const conflicts = [{ id: 'c1', workflow_id: 'wf-1', run_id: null, step_id: null, conflict_type: 'competing_response', strategy: 'highest_score', candidates: [], winner_agent_id: null, winner_response: null, resolution_score: null, resolved: false, resolved_at: null, created_at: '2026-01-01' }];
			mockFetch({ status: 200, body: { conflicts, total: 1 } });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.orchestration.listConflicts();
			expect(result.conflicts).toHaveLength(1);
			expect(result.total).toBe(1);

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/orchestration/conflicts');
		});

		it('passes filter params', async () => {
			mockFetch({ status: 200, body: { conflicts: [], total: 0 } });
			const client = new NnnClient(BASE_CONFIG);
			await client.orchestration.listConflicts({ workflow_id: 'wf-1', pending_only: true });

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('workflow_id=wf-1');
			expect(fetchCall[0]).toContain('pending_only=true');
		});
	});

	describe('orchestration.raiseConflict()', () => {
		it('raises and resolves a conflict', async () => {
			const outcome = { conflict_id: 'c1', resolved: true, winner_agent_id: 'a1', winner_response: { result: 'ok' }, resolution_score: 0.95, strategy: 'highest_score' };
			mockFetch({ status: 200, body: outcome });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.orchestration.raiseConflict({
				workflow_id: 'wf-1',
				candidates: [
					{ agent_id: 'a1', response: { result: 'ok' }, score: 0.95, timestamp: Date.now() },
					{ agent_id: 'a2', response: { result: 'meh' }, score: 0.7, timestamp: Date.now() }
				]
			});
			expect(result.resolved).toBe(true);
			expect(result.winner_agent_id).toBe('a1');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/orchestration/conflicts');
			expect(fetchCall[1].method).toBe('POST');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 500, body: 'error' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.orchestration.raiseConflict({ workflow_id: 'wf-1', candidates: [] })).rejects.toThrow(NnnError);
		});
	});

	// ── Resolution & Trust ────────────────────────────────────────

	describe('trust.resolveAgent()', () => {
		it('resolves an agent by ID', async () => {
			const addr = { agent_id: 'agent-1', agent_url: 'https://agent.example.com', api_url: null, facts_url: null, ttl_seconds: 300, signature: 'sig123', signed_at: 1700000000 };
			mockFetch({ status: 200, body: addr });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.trust.resolveAgent('agent-1');
			expect(result.agent_id).toBe('agent-1');
			expect(result.ttl_seconds).toBe(300);

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/resolve/agent-1');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 404, body: 'not found' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.trust.resolveAgent('unknown')).rejects.toThrow(NnnError);
		});
	});

	describe('trust.adaptiveResolve()', () => {
		it('performs adaptive resolution with context', async () => {
			const resolution = { agent_id: 'agent-1', endpoints: [{ url: 'https://a.com', protocol: 'a2a', score: 0.9, latency_ms: 50, trust_score: 0.85 }], strategy_used: 'trust-weighted', resolved_at: '2026-01-01' };
			mockFetch({ status: 200, body: resolution });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.trust.adaptiveResolve('agent-1', { min_trust_score: 0.8, protocol_preference: 'a2a' });
			expect(result.endpoints).toHaveLength(1);
			expect(result.strategy_used).toBe('trust-weighted');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/resolve');
			expect(fetchCall[1].method).toBe('POST');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 500, body: 'error' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.trust.adaptiveResolve('agent-1')).rejects.toThrow(NnnError);
		});
	});

	describe('trust.getReputation()', () => {
		it('fetches reputation data', async () => {
			const rep = { agents: [{ agent_id: 'a1', reputation: 0.95, availability: 0.99, error_rate: 0.01, fraud_rate: 0, p95_latency_ms: 120, probe_success: 1, cert_score: 0.9, actions: ['chat'], snapshot_at: '2026-01-01', cert_grade: 'A', cert_capability: null, cert_issued_at: null }], total: 1, fetchedAt: '2026-01-01' };
			mockFetch({ status: 200, body: rep });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.trust.getReputation();
			expect(result.agents).toHaveLength(1);
			expect(result.total).toBe(1);
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 500, body: 'error' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.trust.getReputation()).rejects.toThrow(NnnError);
		});
	});

	describe('trust.getScores()', () => {
		it('fetches trust scores without filters', async () => {
			mockFetch({ status: 200, body: { agents: [], total: 0, fetchedAt: '2026-01-01' } });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.trust.getScores();
			expect(result).toHaveProperty('agents');
		});

		it('passes agent filter', async () => {
			mockFetch({ status: 200, body: { agent: { agent_id: 'a1', trust_score: 0.9 }, fetchedAt: '2026-01-01' } });
			const client = new NnnClient(BASE_CONFIG);
			await client.trust.getScores({ agent: 'a1' });

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('agent=a1');
		});
	});

	describe('trust.getFrameworks()', () => {
		it('fetches all frameworks', async () => {
			mockFetch({ status: 200, body: { frameworks: [], total: 0, fetchedAt: '2026-01-01' } });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.trust.getFrameworks();
			expect(result).toHaveProperty('frameworks');
		});

		it('fetches a specific framework by ID', async () => {
			mockFetch({ status: 200, body: { framework: { id: 'fw-1', name: 'OWASP' }, fetchedAt: '2026-01-01' } });
			const client = new NnnClient(BASE_CONFIG);
			await client.trust.getFrameworks({ id: 'fw-1' });

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('id=fw-1');
		});
	});

	describe('trust.syncCrossRegistry()', () => {
		it('triggers cross-registry trust sync', async () => {
			mockFetch({ status: 200, body: { ok: true, fetch: { peer_url: 'https://peer.com', agents_fetched: 5, errors: 0, duration_ms: 1200 }, compute: { scores_computed: 5, errors: 0 } } });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.trust.syncCrossRegistry('admin-key-123');
			expect(result).toHaveProperty('ok', true);

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/trust/cross-registry');
			expect(fetchCall[1].method).toBe('POST');
			expect(fetchCall[1].headers['Authorization']).toBe('Bearer admin-key-123');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 403, body: 'forbidden' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.trust.syncCrossRegistry()).rejects.toThrow(NnnError);
		});
	});

	// ── Billing, Webhooks & Federation ───────────────────────────

	describe('billing.getSubscription()', () => {
		it('fetches subscription by key ID', async () => {
			mockFetch({ status: 200, body: { subscription: { id: 'sub-1' }, plan: 'pro', plans: [] } });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.billing.getSubscription('key-1');
			expect(result).toHaveProperty('subscription');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/subscriptions');
			expect(fetchCall[0]).toContain('keyId=key-1');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 404, body: 'not found' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.billing.getSubscription('bad')).rejects.toThrow(NnnError);
		});
	});

	describe('billing.createSubscription()', () => {
		it('creates a subscription', async () => {
			mockFetch({ status: 201, body: { status: 'created', subscription: { id: 'sub-1' }, charged_np: 100 } });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.billing.createSubscription({ key_id: 'key-1', plan: 'pro' });
			expect(result).toHaveProperty('status', 'created');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[1].method).toBe('POST');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 400, body: 'bad request' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.billing.createSubscription({ key_id: 'bad', plan: 'pro' })).rejects.toThrow(NnnError);
		});
	});

	describe('billing.listInvoices()', () => {
		it('lists invoices by key ID', async () => {
			mockFetch({ status: 200, body: { invoices: [{ id: 'inv-1' }] } });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.billing.listInvoices('key-1');
			expect(result).toHaveProperty('invoices');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('keyId=key-1');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 500, body: 'error' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.billing.listInvoices('bad')).rejects.toThrow(NnnError);
		});
	});

	describe('billing.createInvoice()', () => {
		it('creates an invoice', async () => {
			mockFetch({ status: 201, body: { status: 'created', invoice: { id: 'inv-1' } } });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.billing.createInvoice({ key_id: 'key-1' });
			expect(result).toHaveProperty('status', 'created');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[1].method).toBe('POST');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 500, body: 'error' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.billing.createInvoice({ key_id: 'bad' })).rejects.toThrow(NnnError);
		});
	});

	describe('billing.createCheckoutSession()', () => {
		it('creates a checkout session', async () => {
			const session = { id: 'cs-1', status: 'open', client_agent_id: null, line_items: [], totals: { subtotal: 100, discount: 0, tax: 0, total: 100, currency: 'NP' }, payment: null, metadata: null, created_at: 1700000000, updated_at: 1700000000, expires_at: 1700003600 };
			mockFetch({ status: 201, body: session });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.billing.createCheckoutSession({ capabilities: [{ id: 'cap-1', quantity: 1 }] });
			expect(result.id).toBe('cs-1');
			expect(result.status).toBe('open');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/ucp/checkout-sessions');
			expect(fetchCall[1].method).toBe('POST');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 400, body: 'bad request' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.billing.createCheckoutSession({ capabilities: [] })).rejects.toThrow(NnnError);
		});
	});

	describe('billing.getCheckoutSession()', () => {
		it('gets a checkout session by ID', async () => {
			const session = { id: 'cs-1', status: 'open', client_agent_id: null, line_items: [], totals: { subtotal: 0, discount: 0, tax: 0, total: 0, currency: 'NP' }, payment: null, metadata: null, created_at: 0, updated_at: 0, expires_at: 0 };
			mockFetch({ status: 200, body: session });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.billing.getCheckoutSession('cs-1');
			expect(result.id).toBe('cs-1');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('id=cs-1');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 404, body: 'not found' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.billing.getCheckoutSession('bad')).rejects.toThrow(NnnError);
		});
	});

	describe('billing.submitCheckoutPayment()', () => {
		it('submits payment for a session', async () => {
			mockFetch({ status: 200, body: { id: 'cs-1', status: 'completed', payment: { method: 'crypto', amount: 100 }, settlement_id: 'stl-1' } });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.billing.submitCheckoutPayment('cs-1', { method: 'crypto', amount: 100 });
			expect(result).toHaveProperty('status', 'completed');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/ucp/checkout-sessions/cs-1');
			expect(fetchCall[1].method).toBe('PATCH');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 402, body: 'payment required' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.billing.submitCheckoutPayment('cs-1', {})).rejects.toThrow(NnnError);
		});
	});

	describe('billing.cancelCheckoutSession()', () => {
		it('cancels a checkout session', async () => {
			mockFetch({ status: 200, body: { id: 'cs-1', status: 'cancelled' } });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.billing.cancelCheckoutSession('cs-1');
			expect(result.status).toBe('cancelled');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[1].method).toBe('DELETE');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 404, body: 'not found' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.billing.cancelCheckoutSession('bad')).rejects.toThrow(NnnError);
		});
	});

	describe('webhooks.list()', () => {
		it('lists webhook subscriptions', async () => {
			mockFetch({ status: 200, body: { subscriptions: [{ id: 'wh-1', callback_url: 'https://hook.example.com', events: 'agent.registered', status: 'active', owner_id: 'o1', created_at: '2026-01-01', updated_at: '2026-01-01' }] } });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.webhooks.list();
			expect(result.subscriptions).toHaveLength(1);
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 500, body: 'error' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.webhooks.list()).rejects.toThrow(NnnError);
		});
	});

	describe('webhooks.create()', () => {
		it('creates a webhook', async () => {
			mockFetch({ status: 201, body: { id: 'wh-1', secret: 'sec-123', callback_url: 'https://hook.example.com', events: ['agent.registered'], status: 'active', message: 'created' } });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.webhooks.create({ callback_url: 'https://hook.example.com', events: ['agent.registered'] });
			expect(result.id).toBe('wh-1');
			expect(result.secret).toBe('sec-123');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[1].method).toBe('POST');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 400, body: 'bad request' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.webhooks.create({ callback_url: '', events: [] })).rejects.toThrow(NnnError);
		});
	});

	describe('webhooks.get()', () => {
		it('gets a single webhook', async () => {
			mockFetch({ status: 200, body: { subscription: { id: 'wh-1', callback_url: 'https://hook.example.com', events: 'agent.registered', status: 'active', owner_id: 'o1', created_at: '2026-01-01', updated_at: '2026-01-01' } } });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.webhooks.get('wh-1');
			expect(result.subscription.id).toBe('wh-1');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 404, body: 'not found' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.webhooks.get('bad')).rejects.toThrow(NnnError);
		});
	});

	describe('webhooks.update()', () => {
		it('pauses a webhook', async () => {
			mockFetch({ status: 200, body: { id: 'wh-1', status: 'paused' } });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.webhooks.update('wh-1', 'pause');
			expect(result).toHaveProperty('status', 'paused');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[1].method).toBe('PATCH');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 404, body: 'not found' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.webhooks.update('bad', 'pause')).rejects.toThrow(NnnError);
		});
	});

	describe('webhooks.delete()', () => {
		it('deletes a webhook', async () => {
			mockFetch({ status: 200, body: { ok: true, deleted: 'wh-1' } });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.webhooks.delete('wh-1');
			expect(result.ok).toBe(true);

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[1].method).toBe('DELETE');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 404, body: 'not found' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.webhooks.delete('bad')).rejects.toThrow(NnnError);
		});
	});

	describe('developers.getEarnings()', () => {
		it('fetches developer earnings', async () => {
			mockFetch({ status: 200, body: { developerId: 'dev-1', totalEarnings: 1000 } });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.developers.getEarnings('dev-1');
			expect(result).toHaveProperty('totalEarnings', 1000);

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('developerId=dev-1');
		});

		it('passes view param', async () => {
			mockFetch({ status: 200, body: { settlements: [] } });
			const client = new NnnClient(BASE_CONFIG);
			await client.developers.getEarnings('dev-1', 'settlements');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('view=settlements');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 500, body: 'error' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.developers.getEarnings('bad')).rejects.toThrow(NnnError);
		});
	});

	describe('developers.earningsAction()', () => {
		it('performs an earnings action', async () => {
			mockFetch({ status: 200, body: { ok: true, action: 'settle' } });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.developers.earningsAction({ action: 'settle', developerId: 'dev-1', periodId: 'p-1' });
			expect(result).toHaveProperty('ok', true);

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[1].method).toBe('POST');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 400, body: 'bad action' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.developers.earningsAction({ action: 'settle' })).rejects.toThrow(NnnError);
		});
	});

	describe('federation.getPeers()', () => {
		it('fetches federation peers', async () => {
			mockFetch({ status: 200, body: { peers: [{ url: 'https://peer.example.com' }], summary: { total: 1 } } });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.federation.getPeers();
			expect(result).toHaveProperty('peers');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 500, body: 'error' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.federation.getPeers()).rejects.toThrow(NnnError);
		});
	});

	describe('federation.getStatus()', () => {
		it('fetches federation status', async () => {
			mockFetch({ status: 200, body: { configured_peer: 'https://peer.example.com', peers: [] } });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.federation.getStatus();
			expect(result).toHaveProperty('configured_peer');
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 500, body: 'error' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.federation.getStatus()).rejects.toThrow(NnnError);
		});
	});

	describe('federation.getAgents()', () => {
		it('fetches federated agents', async () => {
			mockFetch({ status: 200, body: { count: 5, agents: [{ agent_id: 'a1' }] } });
			const client = new NnnClient(BASE_CONFIG);
			const result = await client.federation.getAgents();
			expect(result).toHaveProperty('count', 5);
		});

		it('throws NnnError on failure', async () => {
			mockFetch({ status: 500, body: 'error' });
			const client = new NnnClient(BASE_CONFIG);
			await expect(client.federation.getAgents()).rejects.toThrow(NnnError);
		});
	});

	// ── Federation A2A, Agent Lifecycle, Orchestration Ops ──────────

	describe('federation.sendA2ARequest()', () => {
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
			const result = await client.federation.sendA2ARequest({
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
			const result = await client.federation.sendA2ARequest({
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

	describe('agents.update()', () => {
		it('sends PUT request to update agent', async () => {
			const updated = { agent_id: 'agent-1', agent_url: 'https://updated.example.com', capabilities: ['a2a', 'mcp'] };
			mockFetch({ status: 200, body: updated });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.agents.update('agent-1', { capabilities: ['a2a', 'mcp'] });
			expect(result.capabilities).toEqual(['a2a', 'mcp']);

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/agents/agent-1');
			expect(fetchCall[1].method).toBe('PUT');
		});
	});

	describe('agents.updateStatus()', () => {
		it('sends PUT request to update agent status', async () => {
			mockFetch({ status: 200, body: { status: 'updated' } });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.agents.updateStatus('agent-1', 'alive', ['a2a']);
			expect(result.status).toBe('updated');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/agents/agent-1/status');
			expect(fetchCall[1].method).toBe('PUT');
		});
	});

	describe('agents.delete()', () => {
		it('sends DELETE request', async () => {
			mockFetch({ status: 200, body: { status: 'deleted' } });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.agents.delete('agent-1');
			expect(result.status).toBe('deleted');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/agents/agent-1');
			expect(fetchCall[1].method).toBe('DELETE');
		});
	});

	describe('agents.refresh()', () => {
		it('sends POST to refresh agent card', async () => {
			mockFetch({ status: 200, body: { status: 'refreshed', message: 'Card re-crawled' } });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.agents.refresh('agent-1');
			expect(result.status).toBe('refreshed');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/agents/agent-1/refresh');
			expect(fetchCall[1].method).toBe('POST');
		});
	});

	describe('orchestration.routeRequest()', () => {
		it('routes request to best-matching agent', async () => {
			const routeResult = {
				targetAgent: { agent_id: 'agent-best', agent_url: 'https://best.example.com' },
				score: 0.95,
				protocol: 'a2a',
				latencyEstimateMs: 120
			};
			mockFetch({ status: 200, body: routeResult });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.orchestration.routeRequest({
				skill: 'code-review',
				min_trust: 0.8,
				strategy: 'best-match'
			});

			expect(result.targetAgent.agent_id).toBe('agent-best');
			expect(result.score).toBe(0.95);

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/orchestration/route');
			expect(fetchCall[1].method).toBe('POST');
		});
	});

	describe('orchestration.getWorkflowStatus()', () => {
		it('fetches workflow run status', async () => {
			const statusBody = {
				run: { id: 'run-1', workflow_id: 'wf-1', status: 'running', started_at: '2026-01-01' },
				stepRuns: [{ id: 'sr-1', run_id: 'run-1', step_id: 'step-1', status: 'pending' }]
			};
			mockFetch({ status: 200, body: statusBody });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.orchestration.getWorkflowStatus('run-1');
			expect(result.run.status).toBe('running');
			expect(result.run.id).toBe('run-1');
			expect(result.stepRuns).toHaveLength(1);

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/orchestration/runs/run-1');
		});
	});

	describe('orchestration.cancelWorkflowRun()', () => {
		it('cancels an in-progress workflow run', async () => {
			mockFetch({ status: 200, body: { status: 'cancelled', run_id: 'run-1' } });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.orchestration.cancelWorkflowRun('run-1');
			expect(result.status).toBe('cancelled');

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/api/orchestration/runs/run-1/cancel');
			expect(fetchCall[1].method).toBe('POST');
		});
	});

	describe('orchestration.diffIndex()', () => {
		it('fetches index diff since a timestamp', async () => {
			const diff = {
				since: '2026-01-01T00:00:00.000Z',
				added: [{ agent_id: 'new-agent', agent_url: 'https://new.example.com' }],
				removed: ['old-agent'],
				updated: []
			};
			mockFetch({ status: 200, body: diff });

			const client = new NnnClient(BASE_CONFIG);
			const result = await client.orchestration.diffIndex(new Date('2026-01-01'));
			expect(result.added).toHaveLength(1);
			expect(result.removed).toEqual(['old-agent']);

			const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(fetchCall[0]).toContain('/.well-known/nanda-index/diff');
			expect(fetchCall[0]).toContain('since=');
		});
	});

	describe('orchestration.subscribeToIndex()', () => {
		it('returns an unsubscribe function', () => {
			const client = new NnnClient(BASE_CONFIG);
			// Mock fetch to prevent actual polling
			globalThis.fetch = vi.fn().mockImplementation(() =>
				new Promise(() => {}) // never resolves — simulates long poll
			);
			const callback = vi.fn();
			const unsubscribe = client.orchestration.subscribeToIndex(callback, 60_000);
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

			// Third should be fast-failed by circuit breaker (per-endpoint)
			await expect(client.health()).rejects.toThrow(/Circuit breaker is open for/);
			// fetch should only have been called twice (not three times)
			expect(globalThis.fetch).toHaveBeenCalledTimes(2);
		});

		it('isolates failures per endpoint group', async () => {
			let callCount = 0;
			globalThis.fetch = vi.fn().mockImplementation((url: string) => {
				callCount++;
				if (url.includes('/health')) {
					return Promise.reject(new Error('health endpoint down'));
				}
				// /api/agents endpoints succeed
				return Promise.resolve(new Response(JSON.stringify([{ agent_id: 'a1' }]), { status: 200 }));
			});

			const client = new NnnClient({
				...BASE_CONFIG,
				circuitBreaker: { failureThreshold: 2, cooldownMs: 60_000 }
			});

			// Trip the circuit for /health
			await expect(client.health()).rejects.toThrow();
			await expect(client.health()).rejects.toThrow();

			// /health should now be fast-failed
			await expect(client.health()).rejects.toThrow(/Circuit breaker is open for/);

			// /api/agents should still work — different endpoint group
			const result = await client.agents.search();
			expect(result).toEqual([{ agent_id: 'a1' }]);
		});

		it('groups endpoints with the same prefix into a shared circuit', async () => {
			globalThis.fetch = vi.fn().mockRejectedValue(new Error('server down'));

			// With groupingDepth: 1, /lookup/a1 and /lookup/a2 share key origin/lookup
			const client = new NnnClient({
				...BASE_CONFIG,
				circuitBreaker: { failureThreshold: 2, cooldownMs: 60_000, groupingDepth: 1 }
			});

			// Trip the circuit via /lookup/a1
			await expect(client.agents.lookup('a1')).rejects.toThrow();
			await expect(client.agents.lookup('a1')).rejects.toThrow();

			// /lookup/a2 shares the same group → should be fast-failed
			await expect(client.agents.lookup('a2')).rejects.toThrow(/Circuit breaker is open for/);
			// fetch should only have been called twice (the two a1 calls)
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

	// ── Auto-pagination Tests ────────────────────────────────────────

	describe('agents.searchAll()', () => {
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
			for await (const agent of client.agents.searchAll({ q: 'test', limit: 2 })) {
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
			for await (const agent of client.agents.searchAll()) {
				agents.push(agent);
			}

			expect(agents).toHaveLength(0);
		});
	});

	describe('agents.listAll()', () => {
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
			for await (const agent of client.agents.listAll({ limit: 1 })) {
				agents.push(agent);
			}

			expect(agents).toHaveLength(2);
			expect(agents.map(a => a.agent_id)).toEqual(['x1', 'x2']);
		});
	});

	// ── Namespace Getter Tests ──────────────────────────────────────

	describe('namespace getters', () => {
		it('exposes agents namespace as lazy singleton', () => {
			const client = new NnnClient(BASE_CONFIG);
			expect(client.agents).toBeDefined();
			expect(client.agents).toBe(client.agents);
		});

		it('exposes orchestration namespace as lazy singleton', () => {
			const client = new NnnClient(BASE_CONFIG);
			expect(client.orchestration).toBeDefined();
			expect(client.orchestration).toBe(client.orchestration);
		});

		it('exposes trust namespace as lazy singleton', () => {
			const client = new NnnClient(BASE_CONFIG);
			expect(client.trust).toBeDefined();
			expect(client.trust).toBe(client.trust);
		});

		it('exposes federation namespace as lazy singleton', () => {
			const client = new NnnClient(BASE_CONFIG);
			expect(client.federation).toBeDefined();
			expect(client.federation).toBe(client.federation);
		});

		it('exposes webhooks namespace as lazy singleton', () => {
			const client = new NnnClient(BASE_CONFIG);
			expect(client.webhooks).toBeDefined();
			expect(client.webhooks).toBe(client.webhooks);
		});

		it('exposes developers namespace as lazy singleton', () => {
			const client = new NnnClient(BASE_CONFIG);
			expect(client.developers).toBeDefined();
			expect(client.developers).toBe(client.developers);
		});

		it('exposes billing namespace as lazy singleton', () => {
			const client = new NnnClient(BASE_CONFIG);
			expect(client.billing).toBeDefined();
			expect(client.billing).toBe(client.billing);
		});

			it('keeps switchboard and payments aliases compatible', () => {
				const client = new NnnClient(BASE_CONFIG);
				expect(client.switchboard).toBe(client.orchestration);
				expect(client.payments).toBe(client.billing);
			});
	});
});

