// SPDX-License-Identifier: Apache-2.0
/**
 * Homeport SDK — Namespace Helpers
 *
 * Internal interface that namespace classes use to delegate HTTP calls
 * back to the parent HomeportClient. This preserves circuit breaker, caching,
 * deduplication, idempotency, and retry logic.
 *
 * @internal — not part of the public API.
 * @module core/namespace-helpers
 */

import type { HomeportLogger } from './logger.js';

/**
 * Internal HTTP helpers exposed by HomeportClient to namespace classes.
 * Each method mirrors the private helper on HomeportClient.
 */
export interface HomeportClientInternals {
	getJson<T>(path: string, ctx: string, skipCache?: boolean): Promise<T>;
	postJson<T>(path: string, body: unknown, ctx: string): Promise<T>;
	putJson<T>(path: string, body: unknown, ctx: string): Promise<T>;
	deleteJson<T>(path: string, ctx: string): Promise<T>;
	patchJson<T>(path: string, body: unknown, ctx: string): Promise<T>;
	fetch(url: string, init: RequestInit, context: string, skipBreaker?: boolean): Promise<Response>;
	readonly baseUrl: string;
	readonly logger: HomeportLogger;
	headers(): Record<string, string>;
	externalHeaders(): Record<string, string>;
	safeParseJson<T>(res: Response, ctx: string, skipBreaker?: boolean, requestUrl?: string): Promise<T>;
}
