// SPDX-License-Identifier: Apache-2.0
/**
 * Coverage for TrustNamespace — resolution, reputation, scores, frameworks,
 * cross-registry sync, graph, path, compliance, and behavior analytics.
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

const BASE_CONFIG = {
	baseUrl: 'https://homeport.test.com',
	apiKey: 'test-key',
	retryConfig: { maxRetries: 0, timeoutMs: 5000 }
};

describe('TrustNamespace', () => {
	const originalFetch = globalThis.fetch;
	afterEach(() => { globalThis.fetch = originalFetch; });

	describe('resolveAgent()', () => {
		it('GETs /resolve/:id and URL-encodes the id', async () => {
			mockFetch({ status: 200, body: { agent_id: 'agent-1', addr: '1.2.3.4' } });
			const client = new HomeportClient(BASE_CONFIG);
			const res = await client.trust.resolveAgent('agent one');
			expect((res as unknown as { agent_id: string }).agent_id).toBe('agent-1');
			const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('/resolve/agent%20one');
		});
	});

	describe('adaptiveResolve()', () => {
		it('POSTs /resolve with agent_id + context', async () => {
			mockFetch({ status: 200, body: { chosen: { agent_id: 'x' } } });
			const client = new HomeportClient(BASE_CONFIG);
			await client.trust.adaptiveResolve('agent-1', { intent: 'run' });
			const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('/resolve');
			expect((init as RequestInit).method).toBe('POST');
			expect(JSON.parse((init as RequestInit).body as string)).toEqual({
				agent_id: 'agent-1',
				context: { intent: 'run' }
			});
		});
	});

	describe('getReputation()', () => {
		it('GETs /reputation', async () => {
			mockFetch({ status: 200, body: { agents: [], total: 0, fetchedAt: 't' } });
			const client = new HomeportClient(BASE_CONFIG);
			const res = await client.trust.getReputation();
			expect(res.total).toBe(0);
		});
	});

	describe('getScores()', () => {
		it('builds query params for agent/offset/limit', async () => {
			mockFetch({ status: 200, body: { scores: [] } });
			const client = new HomeportClient(BASE_CONFIG);
			await client.trust.getScores({ agent: 'agent-1', offset: 10, limit: 5 });
			const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('/api/trust/scores?');
			expect(url).toContain('agent=agent-1');
			expect(url).toContain('offset=10');
			expect(url).toContain('limit=5');
		});

		it('omits query string when no options provided', async () => {
			mockFetch({ status: 200, body: { scores: [] } });
			const client = new HomeportClient(BASE_CONFIG);
			await client.trust.getScores();
			const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url as string).toMatch(/\/api\/trust\/scores$/);
		});
	});

	describe('getFrameworks()', () => {
		it('passes id as query param when provided', async () => {
			mockFetch({ status: 200, body: { frameworks: [] } });
			const client = new HomeportClient(BASE_CONFIG);
			await client.trust.getFrameworks({ id: 'fw-1' });
			const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('id=fw-1');
		});
	});

	describe('syncCrossRegistry()', () => {
		it('POSTs /api/trust/cross-registry with an empty body', async () => {
			mockFetch({ status: 200, body: { synced: true } });
			const client = new HomeportClient(BASE_CONFIG);
			await client.trust.syncCrossRegistry();
			const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('/api/trust/cross-registry');
			expect((init as RequestInit).method).toBe('POST');
			expect((init as RequestInit).body).toBe('{}');
		});

		it('includes Authorization header when an admin key is provided', async () => {
			mockFetch({ status: 200, body: { synced: true } });
			const client = new HomeportClient(BASE_CONFIG);
			await client.trust.syncCrossRegistry('admin-token');
			const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			const headers = (init as RequestInit).headers as Record<string, string>;
			expect(headers.Authorization).toBe('Bearer admin-token');
		});
	});

	describe('getGraph()/getPath()', () => {
		it('GETs graph endpoint with did', async () => {
			mockFetch({ status: 200, body: { edges: [] } });
			const client = new HomeportClient(BASE_CONFIG);
			await client.trust.getGraph('did:example:1');
			const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('did=did%3Aexample%3A1');
		});

		it('GETs graph endpoint with from + to for path', async () => {
			mockFetch({ status: 200, body: { path: [] } });
			const client = new HomeportClient(BASE_CONFIG);
			await client.trust.getPath('did:a', 'did:b');
			const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('from=did%3Aa');
			expect(url).toContain('to=did%3Ab');
		});
	});

	describe('scanCompliance()', () => {
		it('POSTs /api/compliance/scan', async () => {
			mockFetch({ status: 200, body: { scanned: 0, findings: [] } });
			const client = new HomeportClient(BASE_CONFIG);
			await client.trust.scanCompliance();
			const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('/api/compliance/scan');
			expect((init as RequestInit).method).toBe('POST');
		});
	});

	describe('getBehaviorAnalytics()', () => {
		it('sets agent + period + limit query params', async () => {
			mockFetch({ status: 200, body: { agent_id: 'agent-1', metrics: [] } });
			const client = new HomeportClient(BASE_CONFIG);
			await client.trust.getBehaviorAnalytics('agent-1', { period: 'weekly', limit: 7 });
			const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('/api/analytics/behavior?');
			expect(url).toContain('agent=agent-1');
			expect(url).toContain('period=weekly');
			expect(url).toContain('limit=7');
		});
	});

	describe('getBadges()', () => {
		it('GETs /trust/badges without a query string when no agentId is given', async () => {
			mockFetch({
				status: 200,
				body: {
					agents: [],
					total: 0,
					badge_distribution: { none: 0, bronze: 0, silver: 0, gold: 0 },
					fetchedAt: '2026-01-01T00:00:00.000Z'
				}
			});
			const client = new HomeportClient(BASE_CONFIG);
			const res = await client.trust.getBadges();
			expect(res.total).toBe(0);
			expect(res.agents).toEqual([]);
			const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url as string).toMatch(/\/trust\/badges$/);
		});

		it('passes agentId as the agent query param', async () => {
			mockFetch({
				status: 200,
				body: {
					agents: [
						{
							agent_id: 'agent-1',
							badge: {
								tier: 'gold',
								reputation: 0.92,
								label: 'Gold',
								emoji: '',
								requirements_met: ['reputation >= 0.85'],
								next_tier: null,
								next_tier_gap: null
							},
							reputation_snapshot: { reputation: 0.92, cert_score: 0.8 }
						}
					],
					total: 1
				}
			});
			const client = new HomeportClient(BASE_CONFIG);
			const res = await client.trust.getBadges('agent-1');
			expect(res.agents).toHaveLength(1);
			expect(res.agents[0].badge.tier).toBe('gold');
			const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(url).toContain('/trust/badges?');
			expect(url).toContain('agent=agent-1');
		});
	});
});
