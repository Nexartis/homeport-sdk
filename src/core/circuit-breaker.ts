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

import type { NnnCircuitBreakerConfig } from './types';
import { NnnError, NnnErrorCode } from './errors';
import type { NnnLogger } from './logger';

export interface CircuitBreakerState {
	failures: number;
	lastFailureTime: number;
	state: 'closed' | 'open' | 'half-open';
}

export const DEFAULT_CIRCUIT_BREAKER: Required<NnnCircuitBreakerConfig> = {
	failureThreshold: 5,
	cooldownMs: 30_000,
	groupingDepth: 2
};

export class CircuitBreaker {
	private endpoints = new Map<string, CircuitBreakerState>();
	private config: Required<NnnCircuitBreakerConfig> | null;
	private logger: NnnLogger;

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
	}

	/**
	 * Derive a circuit key from a URL (scheme + host + leading path segments).
	 * The number of path segments used is controlled by `groupingDepth` (default: 2).
	 * e.g. with depth 2: `https://nanda.nexartis.com/api/agents/search` → `https://nanda.nexartis.com/api/agents`
	 */
	private keyFor(url: string): string {
		try {
			const u = new URL(url);
			const segments = u.pathname.split('/').filter(Boolean).slice(0, this.config!.groupingDepth);
			return `${u.origin}/${segments.join('/')}`;
		} catch {
			return url;
		}
	}

	private getState(key: string): CircuitBreakerState {
		if (!this.endpoints.has(key)) {
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

	/** Current state for a specific URL or the first endpoint (diagnostics). */
	currentStateFor(url: string): CircuitBreakerState {
		if (!this.config) return { failures: 0, lastFailureTime: 0, state: 'closed' };
		const key = this.keyFor(url);
		return { ...this.getState(key) };
	}

	/** Reset all circuit states. */
	reset(): void {
		this.endpoints.clear();
	}
}

