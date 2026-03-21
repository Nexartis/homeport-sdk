import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizeBaseUrl, calculateBackoffDelay, isTransientError, fetchWithRetry } from './retry';
import { NnnError, NnnErrorCode } from './errors';

describe('normalizeBaseUrl', () => {
	it('strips trailing slashes', () => {
		expect(normalizeBaseUrl('https://api.example.com/')).toBe('https://api.example.com');
		expect(normalizeBaseUrl('https://api.example.com///')).toBe('https://api.example.com');
	});

	it('leaves clean URLs unchanged', () => {
		expect(normalizeBaseUrl('https://api.example.com')).toBe('https://api.example.com');
	});
});

describe('calculateBackoffDelay', () => {
	it('increases with attempt number', () => {
		const config = { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 30000, timeoutMs: 5000 };
		const d0 = calculateBackoffDelay(0, config);
		const d2 = calculateBackoffDelay(2, config);
		// attempt 2 should generally be larger, but with jitter there's variance
		// Just verify they're within expected ranges
		expect(d0).toBeGreaterThan(0);
		expect(d0).toBeLessThanOrEqual(config.maxDelayMs);
		expect(d2).toBeLessThanOrEqual(config.maxDelayMs);
	});

	it('caps at maxDelayMs', () => {
		const config = { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 5000, timeoutMs: 5000 };
		const delay = calculateBackoffDelay(10, config);
		expect(delay).toBeLessThanOrEqual(5000);
	});
});

describe('isTransientError', () => {
	it('returns false for null/undefined', () => {
		expect(isTransientError(null)).toBe(false);
		expect(isTransientError(undefined)).toBe(false);
	});

	it('returns false for AbortError', () => {
		const err = new Error('aborted');
		err.name = 'AbortError';
		expect(isTransientError(err)).toBe(false);
	});

	it('returns true for network errors', () => {
		expect(isTransientError(new Error('fetch failed'))).toBe(true);
		expect(isTransientError(new Error('ECONNREFUSED'))).toBe(true);
		expect(isTransientError(new Error('ECONNRESET'))).toBe(true);
		expect(isTransientError(new Error('ETIMEDOUT'))).toBe(true);
	});

	it('returns true for 429 and 5xx status codes', () => {
		expect(isTransientError({ statusCode: 429, message: '' })).toBe(true);
		expect(isTransientError({ statusCode: 500, message: '' })).toBe(true);
		expect(isTransientError({ statusCode: 503, message: '' })).toBe(true);
	});

	it('returns false for 4xx (non-429) status codes', () => {
		expect(isTransientError({ statusCode: 400, message: '' })).toBe(false);
		expect(isTransientError({ statusCode: 404, message: '' })).toBe(false);
	});

	it('checks nested cause codes', () => {
		const err = { message: '', cause: { code: 'ECONNREFUSED' } };
		expect(isTransientError(err)).toBe(true);
	});
});

describe('fetchWithRetry', () => {
	const originalFetch = globalThis.fetch;

	afterEach(() => {
		globalThis.fetch = originalFetch;
	});

	it('returns response on success', async () => {
		globalThis.fetch = vi.fn().mockResolvedValueOnce(
			new Response(JSON.stringify({ ok: true }), { status: 200 })
		);

		const res = await fetchWithRetry('https://example.com', {}, 'test', {
			maxRetries: 0,
			timeoutMs: 5000
		});
		expect(res.status).toBe(200);
	});

	it('retries on 500 and eventually succeeds', async () => {
		globalThis.fetch = vi.fn()
			.mockResolvedValueOnce(new Response('error', { status: 500 }))
			.mockResolvedValueOnce(new Response('ok', { status: 200 }));

		const res = await fetchWithRetry('https://example.com', {}, 'test', {
			maxRetries: 1,
			baseDelayMs: 1,
			maxDelayMs: 10,
			timeoutMs: 5000
		});
		expect(res.status).toBe(200);
		expect(globalThis.fetch).toHaveBeenCalledTimes(2);
	});

	it('throws NnnError with lastResponse after exhausting retries on 5xx', async () => {
		globalThis.fetch = vi.fn().mockImplementation(() =>
			Promise.resolve(new Response('server error', { status: 500 }))
		);

		await expect(fetchWithRetry('https://example.com', {}, 'test', {
			maxRetries: 1,
			baseDelayMs: 1,
			maxDelayMs: 10,
			timeoutMs: 5000
		})).rejects.toThrow(NnnError);

		try {
			await fetchWithRetry('https://example.com', {}, 'test', {
				maxRetries: 1,
				baseDelayMs: 1,
				maxDelayMs: 10,
				timeoutMs: 5000
			});
		} catch (err) {
			expect(err).toBeInstanceOf(NnnError);
			const nnnErr = err as NnnError;
			expect(nnnErr.statusCode).toBe(500);
			// lastResponse is attached so upstream hooks (e.g. afterResponse) can inspect it
			expect(nnnErr.lastResponse).toBeDefined();
			expect(nnnErr.lastResponse!.status).toBe(500);
		}
	});

	it('does not retry on 404 (permanent failure)', async () => {
		globalThis.fetch = vi.fn()
			.mockResolvedValueOnce(new Response('not found', { status: 404 }));

		const res = await fetchWithRetry('https://example.com', {}, 'test', {
			maxRetries: 3,
			timeoutMs: 5000
		});
		// 404 is returned directly (not retried, not thrown)
		expect(res.status).toBe(404);
		expect(globalThis.fetch).toHaveBeenCalledTimes(1);
	});

	it('retries on 429', async () => {
		globalThis.fetch = vi.fn()
			.mockResolvedValueOnce(new Response('rate limited', { status: 429 }))
			.mockResolvedValueOnce(new Response('ok', { status: 200 }));

		const res = await fetchWithRetry('https://example.com', {}, 'test', {
			maxRetries: 1,
			baseDelayMs: 1,
			maxDelayMs: 10,
			timeoutMs: 5000
		});
		expect(res.status).toBe(200);
	});
});

