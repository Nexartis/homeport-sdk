// SPDX-License-Identifier: Apache-2.0
/**
 * Coverage for AgentsNamespace methods not exercised by client.test.ts.
 * Mirrors the mocked-fetch pattern in ../client.test.ts.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { HomeportClient } from '../client';

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

function mockFetchSequence(responses: Array<{ status: number; body: unknown }>) {
	let i = 0;
	globalThis.fetch = vi.fn().mockImplementation(() => {
		const r = responses[Math.min(i, responses.length - 1)];
		i += 1;
		return Promise.resolve(
			new Response(JSON.stringify(r.body), {
				status: r.status,
				headers: { 'Content-Type': 'application/json' }
			})
		);
	});
}

const BASE_CONFIG = {
	baseUrl: 'https://homeport.test.com',
	apiKey: 'test-key',
	retryConfig: { maxRetries: 0, timeoutMs: 5000 }
};

describe('AgentsNamespace', () => {
	const originalFetch = globalThis.fetch;
	afterEach(() => { globalThis.fetch = originalFetch; });

	describe('register()', () => {
		it('POSTs to /register and returns the response envelope', async () => {
			mockFetch({ status: 200, body: { status: 'registered', agent_id: 'agent-1' } });
			const client = new HomeportClient(BASE_CONFIG);
			const res = await client.agents.register({
				agent_id: 'agent-1',
				agent_url: 'https://a.example.com',
				capabilities: ['a2a']
			});
			expect(res.status).toBe('registered');
			const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toBe('https://homeport.test.com/register');
			expect((init as RequestInit).method).toBe('POST');
		});
	});

	describe('list()', () => {
		it('GETs /list', async () => {
			mockFetch({ status: 200, body: [{ agent_id: 'a' }, { agent_id: 'b' }] });
			const client = new HomeportClient(BASE_CONFIG);
			const res = await client.agents.list();
			expect(res).toHaveLength(2);
		});
	});

	describe('getCard()', () => {
		it('GETs /.well-known/agent-card.json', async () => {
			mockFetch({ status: 200, body: { name: 'node-card', protocols: ['a2a'] } });
			const client = new HomeportClient(BASE_CONFIG);
			const card = await client.agents.getCard();
			expect((card as unknown as { name: string }).name).toBe('node-card');
			const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('/.well-known/agent-card.json');
		});
	});

	describe('update()/updateStatus()/delete()/refresh()', () => {
		it('PUTs to /agents/:id', async () => {
			mockFetch({ status: 200, body: { agent_id: 'agent-1', metadata: { updated: true } } });
			const client = new HomeportClient(BASE_CONFIG);
			await client.agents.update('agent-1', { metadata: { updated: true } });
			const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('/agents/agent-1');
			expect((init as RequestInit).method).toBe('PUT');
		});

		it('PUTs to /agents/:id/status with capabilities', async () => {
			mockFetch({ status: 200, body: { status: 'active' } });
			const client = new HomeportClient(BASE_CONFIG);
			const res = await client.agents.updateStatus('agent-1', 'active', ['a2a']);
			expect(res.status).toBe('active');
			const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('/agents/agent-1/status');
			expect(JSON.parse((init as RequestInit).body as string)).toEqual({
				status: 'active',
				capabilities: ['a2a']
			});
		});

		it('DELETEs /agents/:id', async () => {
			mockFetch({ status: 200, body: { status: 'deleted' } });
			const client = new HomeportClient(BASE_CONFIG);
			const res = await client.agents.delete('agent-1');
			expect(res.status).toBe('deleted');
			const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('/agents/agent-1');
			expect((init as RequestInit).method).toBe('DELETE');
		});

		it('POSTs to /agents/:id/refresh', async () => {
			mockFetch({ status: 200, body: { agent_id: 'agent-1', refreshed: true } });
			const client = new HomeportClient(BASE_CONFIG);
			await client.agents.refresh('agent-1');
			const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('/agents/agent-1/refresh');
			expect((init as RequestInit).method).toBe('POST');
		});
	});

	describe('deprecate/tombstone/versions', () => {
		it('POSTs to /api/agents/:id/deprecate', async () => {
			mockFetch({ status: 200, body: { agent_id: 'agent-1', deprecated: true } });
			const client = new HomeportClient(BASE_CONFIG);
			await client.agents.deprecate('agent-1', { reason: 'retired' });
			const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('/api/agents/agent-1/deprecate');
		});

		it('POSTs to /api/agents/:id/tombstone', async () => {
			mockFetch({ status: 200, body: { agent_id: 'agent-1', tombstoned: true } });
			const client = new HomeportClient(BASE_CONFIG);
			await client.agents.tombstone('agent-1');
			const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('/api/agents/agent-1/tombstone');
			expect((init as RequestInit).method).toBe('POST');
		});

		it('GETs /api/agents/:id/versions', async () => {
			mockFetch({ status: 200, body: { agent_id: 'agent-1', count: 0, versions: [] } });
			const client = new HomeportClient(BASE_CONFIG);
			const res = await client.agents.listVersions('agent-1');
			expect(res.count).toBe(0);
		});

		it('POSTs to /api/agents/:id/versions', async () => {
			mockFetch({
				status: 200,
				body: { status: 'created', version: { version: '1.0.0', created_at: 't' } }
			});
			const client = new HomeportClient(BASE_CONFIG);
			const res = await client.agents.createVersion('agent-1', { version: '1.0.0' });
			expect(res.status).toBe('created');
		});
	});

	describe('searchAll()', () => {
		it('iterates paginated results', async () => {
			mockFetchSequence([
				{ status: 200, body: { data: [{ agent_id: 'a' }], hasMore: true, cursor: 'c1' } },
				{ status: 200, body: { data: [{ agent_id: 'b' }], hasMore: false, cursor: undefined } }
			]);
			const client = new HomeportClient(BASE_CONFIG);
			const seen: string[] = [];
			for await (const a of client.agents.searchAll({ q: 'x' })) {
				seen.push((a as { agent_id: string }).agent_id);
			}
			expect(seen).toEqual(['a', 'b']);
		});

		it('treats a bare array as a single non-paginated page', async () => {
			mockFetch({ status: 200, body: [{ agent_id: 'only' }] });
			const client = new HomeportClient(BASE_CONFIG);
			const seen: string[] = [];
			for await (const a of client.agents.searchAll()) {
				seen.push((a as { agent_id: string }).agent_id);
			}
			expect(seen).toEqual(['only']);
		});
	});
});
