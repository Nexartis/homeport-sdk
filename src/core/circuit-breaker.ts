// SPDX-License-Identifier: Apache-2.0
/**
 * Circuit Breaker
 *
 * Per-endpoint circuit breaker with configurable path-based grouping.
 * Implements a three-state circuit breaker (closed → open → half-open)
 * per endpoint group so that a failing endpoint does not fast-fail
 * unrelated healthy endpoints.
 *
 * @module core/circuit-breaker
 */

import type { NnnCircuitBreakerConfig } from './types.js';
import { NnnError, NnnErrorCode } from './errors.js';
import type { NnnLogger } from './logger.js';

export interface CircuitBreakerState {
	failures: number;
	lastFailureTime: number;
	state: 'closed' | 'open' | 'half-open';
}

export const DEFAULT_CIRCUIT_BREAKER: Required<NnnCircuitBreakerConfig> = {
	failureThreshold: 5,
	cooldownMs: 30_000,
	groupingDepth: 2,
	maxEndpoints: 256
};

export class CircuitBreaker {
	private endpoints = new Map<string, CircuitBreakerState>();
	private config: Required<NnnCircuitBreakerConfig> | null;
	private logger: NnnLogger;
	/**
	 * Maximum number of endpoint keys tracked simultaneously.
	 * When exceeded, the oldest (least-recently-created) entries are evicted.
	 */
	private readonly maxEndpoints: number;

	constructor(
		config: NnnCircuitBreakerConfig | false | undefined,
		logger: NnnLogger
	) {
		if (config === false) {
			this.config = null;
		} else {
			this.config = { ...DEFAULT_CIRCUIT_BREAKER, ...config };
		}
		this.logger = logger;
		const rawMax = this.config?.maxEndpoints ?? 256;
		this.maxEndpoints = Number.isFinite(rawMax) ? Math.max(1, rawMax) : 256;
	}

	/**
	 * Derive a circuit key from a URL (scheme + host + leading path segments).
	 * The number of path segments used is controlled by `groupingDepth` (default: 2).
	 * e.g. with depth 2: `https://nanda.nexartis.com/api/agents/search` → `https://nanda.nexartis.com/api/agents`
	 */
	private keyFor(url: string): string {
		try {
			const u = new URL(url);
			const depth = Number.isFinite(this.config!.groupingDepth) && this.config!.groupingDepth! >= 0
				? this.config!.groupingDepth!
				: 2;
			const segments = u.pathname.split('/').filter(Boolean).slice(0, depth);
			return `${u.origin}/${segments.join('/')}`;
		} catch {
			return url;
		}
	}

	private getState(key: string): CircuitBreakerState {
		if (!this.endpoints.has(key)) {
			// Evict the oldest entry when at capacity
			if (this.endpoints.size >= this.maxEndpoints) {
				const oldestKey = this.endpoints.keys().next().value;
				if (oldestKey !== undefined) {
					this.logger.debug('Circuit breaker evicting oldest endpoint key', { key: oldestKey });
					this.endpoints.delete(oldestKey);
				}
			}
			this.endpoints.set(key, { failures: 0, lastFailureTime: 0, state: 'closed' });
		}
		return this.endpoints.get(key)!;
	}

	/** Check if a request to `url` is allowed through. Throws if circuit is open. */
	check(url?: string): void {
		if (!this.config) return;
		const key = url ? this.keyFor(url) : '__global__';
		const cb = this.getState(key);
		const cfg = this.config;

		if (cb.state === 'open') {
			const elapsed = Date.now() - cb.lastFailureTime;
			if (elapsed >= cfg.cooldownMs) {
				cb.state = 'half-open';
				this.logger.debug('Circuit breaker half-open, allowing probe request', { key });
			} else {
				throw new NnnError(
					NnnErrorCode.NETWORK_ERROR,
					`Circuit breaker is open for ${key}. ${cfg.cooldownMs - elapsed}ms remaining in cooldown.`
				);
			}
		}
	}

	/** Record a successful request — resets the failure counter. */
	recordSuccess(url?: string): void {
		if (!this.config) return;
		const key = url ? this.keyFor(url) : '__global__';
		const cb = this.getState(key);
		cb.failures = 0;
		cb.state = 'closed';
	}

	/** Record a failed request — may trip the circuit open. */
	recordFailure(url?: string): void {
		if (!this.config) return;
		const key = url ? this.keyFor(url) : '__global__';
		const cb = this.getState(key);
		const cfg = this.config;
		cb.failures++;
		cb.lastFailureTime = Date.now();

		if (cb.failures >= cfg.failureThreshold) {
			cb.state = 'open';
			this.logger.warn('Circuit breaker tripped', { key, failures: cb.failures, cooldownMs: cfg.cooldownMs });
		}
	}

	/** Whether the circuit breaker is enabled. */
	get enabled(): boolean {
		return this.config !== null;
	}

	/**
	 * Backward-compatible getter — returns the state of the first tracked endpoint,
	 * or a default closed state if no endpoints have been recorded yet.
	 * @deprecated Prefer `currentStateFor(url)` for per-endpoint diagnostics.
	 */
	get currentState(): CircuitBreakerState {
		if (!this.config) return { failures: 0, lastFailureTime: 0, state: 'closed' };
		const first = this.endpoints.values().next().value;
		return first ? { ...first } : { failures: 0, lastFailureTime: 0, state: 'closed' };
	}

	/** Current circuit breaker state for the endpoint group that `url` belongs to (read-only, does not create entries). */
	currentStateFor(url: string): CircuitBreakerState {
		if (!this.config) return { failures: 0, lastFailureTime: 0, state: 'closed' };
		const key = this.keyFor(url);
		const existing = this.endpoints.get(key);
		return existing ? { ...existing } : { failures: 0, lastFailureTime: 0, state: 'closed' };
	}

	/** Reset all circuit states. */
	reset(): void {
		this.endpoints.clear();
	}
}

