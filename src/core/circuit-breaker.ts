/**
 * Circuit Breaker
 *
 * Extracted from client.ts for testability and reuse.
 * Implements a simple three-state circuit breaker (closed → open → half-open).
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
	cooldownMs: 30_000
};

export class CircuitBreaker {
	private cbState: CircuitBreakerState;
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
		this.cbState = { failures: 0, lastFailureTime: 0, state: 'closed' };
		this.logger = logger;
	}

	/** Check if a request is allowed through. Throws if circuit is open. */
	check(): void {
		if (!this.config) return;
		const cb = this.cbState;
		const cfg = this.config;

		if (cb.state === 'open') {
			const elapsed = Date.now() - cb.lastFailureTime;
			if (elapsed >= cfg.cooldownMs) {
				cb.state = 'half-open';
				this.logger.debug('Circuit breaker half-open, allowing probe request');
			} else {
				throw new NnnError(
					NnnErrorCode.NETWORK_ERROR,
					`Circuit breaker is open. ${cfg.cooldownMs - elapsed}ms remaining in cooldown.`
				);
			}
		}
	}

	/** Record a successful request — resets the failure counter. */
	recordSuccess(): void {
		if (!this.config) return;
		this.cbState.failures = 0;
		this.cbState.state = 'closed';
	}

	/** Record a failed request — may trip the circuit open. */
	recordFailure(): void {
		if (!this.config) return;
		const cb = this.cbState;
		const cfg = this.config;
		cb.failures++;
		cb.lastFailureTime = Date.now();

		if (cb.failures >= cfg.failureThreshold) {
			cb.state = 'open';
			this.logger.warn('Circuit breaker tripped', { failures: cb.failures, cooldownMs: cfg.cooldownMs });
		}
	}

	/** Whether the circuit breaker is enabled. */
	get enabled(): boolean {
		return this.config !== null;
	}

	/** Current state for diagnostics. */
	get currentState(): CircuitBreakerState {
		return { ...this.cbState };
	}
}

