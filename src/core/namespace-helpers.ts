/**
 * NNN SDK — Namespace Helpers
 *
 * Internal interface that namespace classes use to delegate HTTP calls
 * back to the parent NnnClient. This preserves circuit breaker, caching,
 * deduplication, idempotency, and retry logic.
 *
 * @internal — not part of the public API.
 * @module core/namespace-helpers
 */

import type { NnnLogger } from './logger';

/**
 * Internal HTTP helpers exposed by NnnClient to namespace classes.
 * Each method mirrors the private helper on NnnClient.
 */
export interface NnnClientInternals {
	getJson<T>(path: string, ctx: string, skipCache?: boolean): Promise<T>;
	postJson<T>(path: string, body: unknown, ctx: string): Promise<T>;
	putJson<T>(path: string, body: unknown, ctx: string): Promise<T>;
	deleteJson<T>(path: string, ctx: string): Promise<T>;
	patchJson<T>(path: string, body: unknown, ctx: string): Promise<T>;
	fetch(url: string, init: RequestInit, context: string, skipBreaker?: boolean): Promise<Response>;
	readonly baseUrl: string;
	readonly logger: NnnLogger;
	headers(): Record<string, string>;
	externalHeaders(): Record<string, string>;
	safeParseJson<T>(res: Response, ctx: string, skipBreaker?: boolean): Promise<T>;
}

/**
 * Base class for namespace classes providing access to client internals.
 * @internal
 */
export abstract class BaseNamespace {
	/** @internal */
	constructor(protected readonly _client: NnnClientInternals) {}
}

