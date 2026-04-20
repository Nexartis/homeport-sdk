// SPDX-License-Identifier: Apache-2.0
/**
 * NNN SDK — NnnClient
 *
 * Typed HTTP client for the Nexartis NANDA Node.
 * Wraps registry, orchestration, health, stats, agent facts,
 * and NANDA index endpoints with retry logic.
 *
 * Config injection: all credentials and URLs via constructor — no env reads.
 *
 * @module core/client
 */

import type {
	NnnConfig,
	NnnHealthStatus,
	NnnHooks
} from './types.js';

import { fetchWithRetry, normalizeBaseUrl } from './retry.js';
import { createNnnLogger, type NnnLogger } from './logger.js';
import { NnnError, NnnErrorCode } from './errors.js';
import { SDK_VERSION } from './version.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { generateRequestId } from './sse.js';
import type { NnnClientInternals } from './namespace-helpers.js';
import {
	AgentsNamespace,
	OrchestrationNamespace,
	TrustNamespace,
	FederationNamespace,
	WebhooksNamespace,
	DevelopersNamespace,
	BillingNamespace
} from './namespaces/index.js';

export { SDK_VERSION } from './version.js';



/**
 * Detect whether a request targets an SSE (text/event-stream) endpoint.
 * Handles plain-object headers, `Headers` instances, and case-insensitive
 * Accept values so detection remains reliable even if a `beforeRequest` hook
 * mutates the headers.
 */
function isStreamingRequest(init: RequestInit): boolean {
	if (!init.headers) return false;

	let accept: string | null | undefined;
	if (init.headers instanceof Headers) {
		accept = init.headers.get('Accept');
	} else if (Array.isArray(init.headers)) {
		// Tuple array form: [['Accept', 'text/event-stream'], ...]
		const entry = (init.headers as string[][]).find(
			([k]) => k.toLowerCase() === 'accept'
		);
		accept = entry?.[1];
	} else if (typeof init.headers === 'object') {
		// Plain object — try common casings
		const h = init.headers as Record<string, string>;
		accept = h['Accept'] ?? h['accept'] ?? h['ACCEPT'];
	}

	if (!accept) return false;
	// Handle combined values like "text/event-stream, application/json"
	return accept.toLowerCase().includes('text/event-stream');
}

// ── Response Cache (B-4) ─────────────────────────────────────────────

/** Simple TTL-based response cache with LRU eviction and pattern invalidation. */
class ResponseCache {
	private cache = new Map<string, { data: unknown; expiresAt: number }>();
	private defaultTtlMs: number;
	private maxEntries: number;

	constructor(defaultTtlMs: number, maxEntries: number = 256) {
		this.defaultTtlMs = defaultTtlMs;
		this.maxEntries = Number.isFinite(maxEntries) ? Math.max(1, maxEntries) : 256;
	}

	get<T>(key: string): T | undefined {
		const entry = this.cache.get(key);
		if (!entry) return undefined;
		if (Date.now() > entry.expiresAt) {
			this.cache.delete(key);
			return undefined;
		}
		// Move to end (most recently used) for LRU
		this.cache.delete(key);
		this.cache.set(key, entry);
		return entry.data as T;
	}

	set(key: string, data: unknown, ttlMs?: number): void {
		// Refresh LRU position if key already exists
		if (this.cache.has(key)) {
			this.cache.delete(key);
		} else if (this.cache.size >= this.maxEntries) {
			// Evict oldest entry if at capacity
			const oldestKey = this.cache.keys().next().value;
			if (oldestKey !== undefined) {
				this.cache.delete(oldestKey);
			}
		}
		this.cache.set(key, {
			data,
			expiresAt: Date.now() + (ttlMs ?? this.defaultTtlMs)
		});
	}

	/** Invalidate entries matching a pattern, or clear all if no pattern given. */
	invalidate(pattern?: string | RegExp): void {
		if (!pattern) {
			this.cache.clear();
			return;
		}
		const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
		for (const key of this.cache.keys()) {
			// Reset lastIndex before each test() call so RegExps with g/y
			// flags don't skip matches due to stateful lastIndex.
			regex.lastIndex = 0;
			if (regex.test(key)) this.cache.delete(key);
		}
	}

	/** Number of entries currently in the cache. */
	get size(): number {
		return this.cache.size;
	}
}

export class NnnClient {
	readonly baseUrl: string;
	private apiKey: string | null;
	private logger: NnnLogger;
	private retryConfig: NnnConfig['retryConfig'];
	private hooks: NnnHooks;
	private traceContext: { traceparent?: string; tracestate?: string };
	private circuitBreaker: CircuitBreaker;

	/** In-flight GET request deduplication map (B-3). Stores parsed results, not Response objects, so multiple callers don't fight over consuming the body. */
	private inflightGets = new Map<string, Promise<unknown>>();

	/** Opt-in response cache (B-4). */
	private responseCache: ResponseCache | null;

	// ── Namespace instances (D-1) ────────────────────────────────────
	private _agents: AgentsNamespace | null = null;
	private _orchestration: OrchestrationNamespace | null = null;
	private _trust: TrustNamespace | null = null;
	private _federation: FederationNamespace | null = null;
	private _webhooks: WebhooksNamespace | null = null;
	private _developers: DevelopersNamespace | null = null;
	private _billing: BillingNamespace | null = null;

	/** Internal bridge object shared with namespace classes. */
	private _internals: NnnClientInternals | null = null;

	constructor(config: NnnConfig) {
		if (!config.baseUrl) {
			throw new NnnError(NnnErrorCode.CONFIGURATION_ERROR, 'NnnClient requires config.baseUrl');
		}
		this.baseUrl = normalizeBaseUrl(config.baseUrl);
		this.apiKey = config.apiKey ?? null;
		this.logger = createNnnLogger(config.verbose ?? false);
		this.retryConfig = config.retryConfig;
		this.hooks = config.hooks ?? {};
		this.traceContext = config.traceContext ?? {};
		this.circuitBreaker = new CircuitBreaker(config.circuitBreaker, this.logger);

		// Response cache — disabled by default
		if (config.cache) {
			this.responseCache = new ResponseCache(
				config.cache.defaultTtlMs ?? 60_000,
				config.cache.maxEntries ?? 256
			);
		} else {
			this.responseCache = null;
		}
	}

	// ── Namespace accessors (Sprint D) ────────────────────────────────

	/** @internal — Lazily build the internals bridge. */
	private internals(): NnnClientInternals {
		if (!this._internals) {
			this._internals = {
				getJson: this.getJson.bind(this),
				postJson: this.postJson.bind(this),
				putJson: this.putJson.bind(this),
				deleteJson: this.deleteJson.bind(this),
				patchJson: this.patchJson.bind(this),
				fetch: this.fetch.bind(this),
				get baseUrl() { return ''; }, // replaced below
				logger: this.logger,
				headers: this.headers.bind(this),
				externalHeaders: this.externalHeaders.bind(this),
				safeParseJson: this.safeParseJson.bind(this)
			};
			// Use Object.defineProperty so baseUrl reflects the actual value
			Object.defineProperty(this._internals, 'baseUrl', { get: () => this.baseUrl });
		}
		return this._internals;
	}

	/** Agent registration, lookup, search, lifecycle, facts, and versioning. */
	get agents(): AgentsNamespace {
		return (this._agents ??= new AgentsNamespace(this.internals()));
	}

	/** Workflows, runs, delegation, patterns, conflicts, routing, and index sync. */
	get orchestration(): OrchestrationNamespace {
		return (this._orchestration ??= new OrchestrationNamespace(this.internals()));
	}

	/** Resolution, reputation, trust scores/frameworks/graph, compliance, and analytics. */
	get trust(): TrustNamespace {
		return (this._trust ??= new TrustNamespace(this.internals()));
	}

	/** Federation peers, status, agents, and A2A communication. */
	get federation(): FederationNamespace {
		return (this._federation ??= new FederationNamespace(this.internals()));
	}

	/** Webhook subscription management. */
	get webhooks(): WebhooksNamespace {
		return (this._webhooks ??= new WebhooksNamespace(this.internals()));
	}

	/** Developer key management and earnings. */
	get developers(): DevelopersNamespace {
		return (this._developers ??= new DevelopersNamespace(this.internals()));
	}

	/** Subscriptions, invoices, checkout sessions, and NP payment verification. */
	get billing(): BillingNamespace {
		return (this._billing ??= new BillingNamespace(this.internals()));
	}

	// ── HTTP helpers ──────────────────────────────────────────────────

	private headers(): Record<string, string> {
		const h: Record<string, string> = {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			'User-Agent': `@nexartis/nexartis-nanda-node-sdk/${SDK_VERSION}`
		};
		if (this.apiKey) h['Authorization'] = `Bearer ${this.apiKey}`;
		// OpenTelemetry trace context propagation (2.2)
		if (this.traceContext.traceparent) h['traceparent'] = this.traceContext.traceparent;
		if (this.traceContext.tracestate) h['tracestate'] = this.traceContext.tracestate;
		return h;
	}

	/**
	 * Return headers safe for third-party (off-domain) requests.
	 * Strips the registry Authorization token to prevent credential leakage.
	 */
	private externalHeaders(): Record<string, string> {
		const h = this.headers();
		delete h['Authorization'];
		return h;
	}

	/** Update trace context for subsequent requests. */
	setTraceContext(ctx: { traceparent?: string; tracestate?: string }): void {
		this.traceContext = ctx;
	}

	/** Invalidate cache entries matching the given pattern. */
	invalidateCache(pattern?: string | RegExp): void {
		this.responseCache?.invalidate(pattern);
	}

	/**
	 * Internal fetch with circuit breaker, hooks, idempotency, and retry logic.
	 * Set `skipBreaker` to true for external (A2A) calls that should not
	 * affect the registry circuit breaker state.
	 */
	private async fetch(url: string, init: RequestInit, context: string, skipBreaker = false): Promise<Response> {
		if (!skipBreaker) this.circuitBreaker.check(url);

		const startTime = Date.now();

		try {
			// Run beforeRequest inside try so hook failures are handled
			// consistently with request failures (onError, circuit breaker).
			await this.hooks.beforeRequest?.(url, init);

			const response = await fetchWithRetry(url, init, context, this.retryConfig);
			const durationMs = Date.now() - startTime;

			const isSSE = isStreamingRequest(init);

			// Fire afterResponse for non-streaming responses.
			// For SSE (text/event-stream) responses, skip cloning — clone() tees
			// the ReadableStream, and if the hook doesn't fully consume the
			// cloned branch it will buffer indefinitely for long-lived streams.
			if (!isSSE) {
				await this.hooks.afterResponse?.(url, response.clone(), durationMs);
			}

			if (!response.ok) {
				// HTTP error — record failure only for server errors (5xx),
				// not client errors (4xx) which indicate caller issues, not
				// service degradation.
				const bodyText = await response.text();
				const error = NnnError.fromStatus(
					response.status,
					`${context} failed (${response.status}): ${bodyText}`
				);
				error.context.durationMs = durationMs;
				if (!skipBreaker && response.status >= 500) this.circuitBreaker.recordFailure(url);
				await this.hooks.onError?.(url, error);
				throw error;
			}

			// Note: recordSuccess is deferred to safeParseJson() for JSON callers
			// so that a JSON parse failure doesn't prematurely reset the streak.
			// Streaming callers bypass safeParseJson, so record success here.
			if (!skipBreaker && isSSE) {
				this.circuitBreaker.recordSuccess(url);
			}
			return response;
		} catch (err) {
			// Re-throw errors already handled above (HTTP errors)
			if (err instanceof NnnError && err.context.durationMs !== undefined) {
				throw err;
			}
			const durationMs = Date.now() - startTime;

			// 429 (rate-limit) is a client-side throttle, not a server failure —
			// don't let it trip the circuit breaker.
			const is429 = err instanceof NnnError && err.statusCode === 429;
			if (!skipBreaker && !is429) this.circuitBreaker.recordFailure(url);

			// Enrich NnnError with duration context before firing onError
			// so hook consumers can access timing information
			if (err instanceof NnnError) {
				err.context.durationMs = durationMs;

				// Fire afterResponse for retried-out 5xx/429 errors that carry
				// the last HTTP response, honouring the "fires for every response"
				// contract documented on NnnHooks.afterResponse.
				// Clone the response so afterResponse body consumption doesn't
				// prevent onError from inspecting the same response.
				if (err.lastResponse) {
					await this.hooks.afterResponse?.(url, err.lastResponse.clone(), durationMs);
				}
			}
			await this.hooks.onError?.(url, err);
			throw err;
		}
	}

	/** Attach Idempotency-Key header for mutating requests (B-2). */
	private mutatingHeaders(): Record<string, string> {
		const h = this.headers();
		h['Idempotency-Key'] = generateRequestId();
		return h;
	}

	/**
	 * GET JSON helper with deduplication and optional caching.
	 * Concurrent identical GETs share a single in-flight request (B-3).
	 * Results are optionally cached (B-4).
	 */
	private async getJson<T>(path: string, ctx: string, skipCache = false): Promise<T> {
		const url = `${this.baseUrl}${path}`;

		// Check cache first (B-4)
		if (!skipCache && this.responseCache) {
			const cached = this.responseCache.get<T>(url);
			if (cached !== undefined) return cached;
		}

		// Dedup concurrent GETs (B-3).
		// The map stores Promise<unknown> (parsed JSON), not Promise<Response>,
		// so multiple concurrent callers share the parsed result without
		// hitting a "body already used" error.
		let inflight = this.inflightGets.get(url);
		if (!inflight) {
			inflight = (async () => {
				const res = await this.fetch(url, { headers: this.headers() }, ctx);
				return this.safeParseJson<T>(res, ctx, false, url);
			})();
			this.inflightGets.set(url, inflight);
		}

		try {
			const data = (await inflight) as T;

			// Store in cache (B-4)
			if (!skipCache && this.responseCache) {
				this.responseCache.set(url, data);
			}

			return data;
		} finally {
			this.inflightGets.delete(url);
		}
	}

	/**
	 * POST JSON helper with idempotency key.
	 */
	private async postJson<T>(path: string, body: unknown, ctx: string): Promise<T> {
		const requestUrl = `${this.baseUrl}${path}`;
		const res = await this.fetch(
			requestUrl,
			{ method: 'POST', headers: this.mutatingHeaders(), body: JSON.stringify(body) },
			ctx
		);
		return this.safeParseJson<T>(res, ctx, false, requestUrl);
	}

	/**
	 * PUT JSON helper with idempotency key.
	 */
	private async putJson<T>(path: string, body: unknown, ctx: string): Promise<T> {
		const requestUrl = `${this.baseUrl}${path}`;
		const res = await this.fetch(
			requestUrl,
			{ method: 'PUT', headers: this.mutatingHeaders(), body: JSON.stringify(body) },
			ctx
		);
		return this.safeParseJson<T>(res, ctx, false, requestUrl);
	}

	/**
	 * DELETE JSON helper with idempotency key.
	 */
	private async deleteJson<T>(path: string, ctx: string): Promise<T> {
		const requestUrl = `${this.baseUrl}${path}`;
		const res = await this.fetch(
			requestUrl,
			{ method: 'DELETE', headers: this.mutatingHeaders() },
			ctx
		);
		return this.safeParseJson<T>(res, ctx, false, requestUrl);
	}

	/**
	 * PATCH JSON helper with idempotency key.
	 */
	private async patchJson<T>(path: string, body: unknown, ctx: string): Promise<T> {
		const requestUrl = `${this.baseUrl}${path}`;
		const res = await this.fetch(
			requestUrl,
			{ method: 'PATCH', headers: this.mutatingHeaders(), body: JSON.stringify(body) },
			ctx
		);
		return this.safeParseJson<T>(res, ctx, false, requestUrl);
	}

	/**
	 * Parse JSON from a response, recording failure and firing onError if parsing throws.
	 * Records success only after the body is successfully parsed, so that a JSON parse
	 * failure doesn't prematurely reset a circuit breaker failure streak.
	 * Pass `skipBreaker` to avoid recording state for external (A2A) calls.
	 */
	private async safeParseJson<T>(res: Response, ctx: string, skipBreaker = false, requestUrl?: string): Promise<T> {
		// Use the original request URL for circuit breaker keying so redirects
		// don't update a different circuit than the one that was checked.
		const cbUrl = requestUrl ?? res.url;
		try {
			const data = await res.json() as T;
			if (!skipBreaker) this.circuitBreaker.recordSuccess(cbUrl);
			return data;
		} catch (err) {
			if (!skipBreaker) this.circuitBreaker.recordFailure(cbUrl);
			const parseError = new NnnError(
				NnnErrorCode.SERVER_ERROR,
				`${ctx}: failed to parse response body as JSON`
			);
			await this.hooks.onError?.(cbUrl, parseError);
			throw parseError;
		}
	}

	// ── Health ────────────────────────────────────────────────────────

	/** GET /health */
	async health(): Promise<NnnHealthStatus> {
		return this.getJson('/health', 'health');
	}

	/**
	 * Convenience: is NNN healthy? Never throws.
	 * Uses deepHealth() so the result is consistent — a service with degraded
	 * subsystems is not considered healthy.
	 */
	async isHealthy(): Promise<boolean> {
		try {
			const dh = await this.deepHealth();
			return dh.healthy;
		} catch {
			return false;
		}
	}

	/**
	 * Deep health check — returns full health status including individual subsystem checks.
	 * Unlike health(), this provides a summary `healthy` boolean and per-check details.
	 */
	async deepHealth(): Promise<NnnHealthStatus & { healthy: boolean; degradedChecks: string[] }> {
		const h = await this.health();
		const degradedChecks = Object.entries(h.checks ?? {})
			.filter(([, v]) => v !== 'ok')
			.map(([k]) => k);
		return {
			...h,
			healthy: h.status === 'ok' && degradedChecks.length === 0,
			degradedChecks
		};
	}
}
