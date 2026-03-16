import { describe, it, expect, vi, afterEach } from 'vitest';
import { NnnClient } from './client';
import { NnnError, NnnErrorCode } from './errors';

/** Helper to mock globalThis.fetch */
function mockFetch(response: { status: number; body: unknown }) {
	globalThis.fetch = vi.fn().mockResolvedValue(
		new Response(JSON.stringify(response.body), {
			status: response.status,
			headers: { 'Content-Type': 'application/json' }
		})
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
});

