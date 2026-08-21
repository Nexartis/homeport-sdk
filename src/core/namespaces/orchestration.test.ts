// SPDX-License-Identifier: Apache-2.0
/**
 * Coverage for OrchestrationNamespace — workflows, runs, delegation (grant/
 * revoke/check via A2A envelope), and the SSE streaming path
 * (streamWorkflowEvents).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { HomeportClient } from '../client';

function mockJsonFetch(response: { status: number; body: unknown }) {
	globalThis.fetch = vi.fn().mockImplementation(() =>
		Promise.resolve(
			new Response(JSON.stringify(response.body), {
				status: response.status,
				headers: { 'Content-Type': 'application/json' }
			})
		)
	);
}

function sseStreamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
	const enc = new TextEncoder();
	return new ReadableStream<Uint8Array>({
		start(controller) {
			for (const c of chunks) controller.enqueue(enc.encode(c));
			controller.close();
		}
	});
}

function mockSseFetch(chunks: string[]) {
	globalThis.fetch = vi.fn().mockImplementation(() =>
		Promise.resolve(
			new Response(sseStreamFromChunks(chunks), {
				status: 200,
				headers: { 'Content-Type': 'text/event-stream' }
			})
		)
	);
}

const BASE_CONFIG = {
	baseUrl: 'https://homeport.test.com',
	apiKey: 'test-key',
	retryConfig: { maxRetries: 0, timeoutMs: 5000 }
};

describe('OrchestrationNamespace', () => {
	const originalFetch = globalThis.fetch;
	afterEach(() => { globalThis.fetch = originalFetch; });

	describe('stats()', () => {
		it('GETs /stats', async () => {
			mockJsonFetch({ status: 200, body: { agents: 1, workflows: 2 } });
			const client = new HomeportClient(BASE_CONFIG);
			const res = await client.orchestration.stats();
			expect((res as unknown as { agents: number }).agents).toBe(1);
		});
	});

	describe('workflow CRUD', () => {
		it('lists workflows with query params', async () => {
			mockJsonFetch({ status: 200, body: { workflows: [] } });
			const client = new HomeportClient(BASE_CONFIG);
			await client.orchestration.listWorkflows({ ownerId: 'o1', status: 'active' });
			const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('owner_id=o1');
			expect(url).toContain('status=active');
		});

		it('gets a single workflow', async () => {
			mockJsonFetch({ status: 200, body: { id: 'wf-1' } });
			const client = new HomeportClient(BASE_CONFIG);
			await client.orchestration.getWorkflow('wf-1');
			const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('/api/orchestration/wf-1');
		});

		it('PATCHes a workflow update', async () => {
			mockJsonFetch({ status: 200, body: { ok: true, workflow: { id: 'wf-1' } } });
			const client = new HomeportClient(BASE_CONFIG);
			await client.orchestration.updateWorkflow('wf-1', { name: 'renamed' });
			const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('/api/orchestration/wf-1');
			expect((init as RequestInit).method).toBe('PATCH');
		});

		it('DELETEs a workflow', async () => {
			mockJsonFetch({ status: 200, body: { ok: true, deleted: 'wf-1' } });
			const client = new HomeportClient(BASE_CONFIG);
			await client.orchestration.deleteWorkflow('wf-1');
			const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect((init as RequestInit).method).toBe('DELETE');
		});
	});

	describe('runs', () => {
		it('POSTs to run a workflow', async () => {
			mockJsonFetch({ status: 200, body: { run_id: 'r-1' } });
			const client = new HomeportClient(BASE_CONFIG);
			await client.orchestration.runWorkflow('wf-1', { foo: 'bar' });
			const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('/api/orchestration/wf-1/runs');
			expect((init as RequestInit).method).toBe('POST');
			expect(JSON.parse((init as RequestInit).body as string)).toEqual({ foo: 'bar' });
		});

		it('clamps listWorkflowRuns limit into [1,100]', async () => {
			mockJsonFetch({ status: 200, body: { runs: [] } });
			const client = new HomeportClient(BASE_CONFIG);
			await client.orchestration.listWorkflowRuns('wf-1', 500);
			const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('limit=100');
		});

		it('cancels a workflow run', async () => {
			mockJsonFetch({ status: 200, body: { status: 'cancelled', run_id: 'r-1' } });
			const client = new HomeportClient(BASE_CONFIG);
			const res = await client.orchestration.cancelWorkflowRun('r-1');
			expect(res.status).toBe('cancelled');
		});
	});

	describe('streamWorkflowEvents() [SSE]', () => {
		it('yields JSON events parsed from the SSE stream and stops on [DONE]', async () => {
			mockSseFetch([
				'data: {"type":"start","step":"s1"}\n\n',
				'data: {"type":"progress","pct":42}\n\n',
				'data: [DONE]\n\n'
			]);
			const client = new HomeportClient(BASE_CONFIG);
			const events: Record<string, unknown>[] = [];
			for await (const ev of client.orchestration.streamWorkflowEvents('run-1')) {
				events.push(ev);
			}
			expect(events).toHaveLength(2);
			expect(events[0]).toEqual({ type: 'start', step: 's1' });
			expect(events[1]).toEqual({ type: 'progress', pct: 42 });
		});

		it('sends Accept: text/event-stream and hits the /events path', async () => {
			mockSseFetch(['data: [DONE]\n\n']);
			const client = new HomeportClient(BASE_CONFIG);
			for await (const _ of client.orchestration.streamWorkflowEvents('run-2')) {
				void _;
			}
			const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('/api/orchestration/runs/run-2/events');
			const headers = (init as RequestInit).headers as Record<string, string>;
			expect(headers.Accept).toBe('text/event-stream');
		});
	});

	describe('delegation (A2A envelope)', () => {
		function a2aOk(text: unknown) {
			return {
				jsonrpc: '2.0',
				id: 'x',
				result: { parts: [{ text: JSON.stringify(text) }] }
			};
		}

		it('delegateTask() POSTs /api/orchestration/delegate', async () => {
			mockJsonFetch({ status: 200, body: { delegation_id: 'd-1', status: 'accepted' } });
			const client = new HomeportClient(BASE_CONFIG);
			await client.orchestration.delegateTask({
				delegator_id: 'did:a',
				delegate_id: 'did:b',
				action: 'run'
			} as unknown as Parameters<typeof client.orchestration.delegateTask>[0]);
			const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('/api/orchestration/delegate');
			expect((init as RequestInit).method).toBe('POST');
		});

		it('grantDelegation() wraps the payload in an A2A JSON-RPC envelope', async () => {
			mockJsonFetch({ status: 200, body: a2aOk({ delegation_id: 'd-1' }) });
			const client = new HomeportClient(BASE_CONFIG);
			const res = await client.orchestration.grantDelegation({
				granted_by_did: 'did:a',
				granted_to_did: 'did:b',
				granted_scope: ['run'],
				expires_at: 1900000000,
				granted_by_proof_hash: 'a'.repeat(64),
				proof: {
					principalPk: 'principal',
					deviceDid: 'did:key:z6Mkdevice',
					requestId: 'req-1',
					boundAt: 1794000000000,
					issuedAt: 1794000000500,
					signature: 'sig'
				}
			});
			expect((res as unknown as { delegation_id: string }).delegation_id).toBe('d-1');
			const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('/a2a');
			const envelope = JSON.parse((init as RequestInit).body as string);
			expect(envelope.jsonrpc).toBe('2.0');
			expect(envelope.method).toBe('message/send');
			const inner = JSON.parse(envelope.params.message.parts[0].text);
			expect(inner.action).toBe('delegation.grant');
			expect(inner.granted_by_did).toBe('did:a');
			expect(inner.proof.signature).toBe('sig');
		});

		it('revokeDelegation() sets action=delegation.revoke', async () => {
			mockJsonFetch({ status: 200, body: a2aOk({ revoked: true }) });
			const client = new HomeportClient(BASE_CONFIG);
			await client.orchestration.revokeDelegation({
				delegation_id: 'd-1'
			} as unknown as Parameters<typeof client.orchestration.revokeDelegation>[0]);
			const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			const envelope = JSON.parse((init as RequestInit).body as string);
			const inner = JSON.parse(envelope.params.message.parts[0].text);
			expect(inner.action).toBe('delegation.revoke');
			expect(inner.delegation_id).toBe('d-1');
		});

		it('checkDelegation() sets action=delegation.check and returns the inner text as JSON', async () => {
			mockJsonFetch({ status: 200, body: a2aOk({ valid: true }) });
			const client = new HomeportClient(BASE_CONFIG);
			const res = await client.orchestration.checkDelegation('d-1');
			expect((res as unknown as { valid: boolean }).valid).toBe(true);
			const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			const envelope = JSON.parse((init as RequestInit).body as string);
			const inner = JSON.parse(envelope.params.message.parts[0].text);
			expect(inner.action).toBe('delegation.check');
			expect(inner.delegation_id).toBe('d-1');
		});

		it('checkDelegation() throws on empty delegationId', async () => {
			const client = new HomeportClient(BASE_CONFIG);
			await expect(client.orchestration.checkDelegation('')).rejects.toThrow(/delegationId/);
		});
	});
});
