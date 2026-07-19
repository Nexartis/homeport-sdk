// SPDX-License-Identifier: Apache-2.0
/**
 * Homeport SDK — Typed Error Classes
 *
 * Following sentinel-sdk pattern for typed error handling.
 * Provides specific error codes for NNN API failures so consumers
 * can handle different error conditions programmatically.
 *
 * @module core/errors
 */

export enum HomeportErrorCode {
	NETWORK_ERROR = 'NETWORK_ERROR',
	UNAUTHORIZED = 'UNAUTHORIZED',
	FORBIDDEN = 'FORBIDDEN',
	NOT_FOUND = 'NOT_FOUND',
	VALIDATION_ERROR = 'VALIDATION_ERROR',
	RATE_LIMITED = 'RATE_LIMITED',
	SERVER_ERROR = 'SERVER_ERROR',
	CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
	TIMEOUT = 'TIMEOUT'
}

/** Structured error context for observability. */
export interface HomeportErrorContext {
	/** Request ID from response headers (e.g. x-request-id). */
	requestId?: string;
	/** Number of retry attempts made before failure. */
	retryCount?: number;
	/** Total wall-clock time in milliseconds. */
	durationMs?: number;
	/** Target agent ID (for A2A calls). */
	agentId?: string;
}

export class HomeportError extends Error {
	/** Structured context for observability. */
	context: HomeportErrorContext;

	/**
	 * Clone of the last HTTP response that caused this error, if available.
	 * Attached by fetchWithRetry on the final failed attempt so that hooks
	 * (e.g. afterResponse) can still inspect headers/status.
	 */
	lastResponse?: Response;

	constructor(
		public code: HomeportErrorCode,
		message: string,
		public statusCode?: number,
		public originalError?: unknown,
		context?: HomeportErrorContext
	) {
		super(message);
		this.name = 'HomeportError';
		this.context = context ?? {};
	}

	/**
	 * Create an HomeportError from an HTTP response status code.
	 */
	static fromStatus(status: number, message: string, context?: HomeportErrorContext): HomeportError {
		const code = statusToErrorCode(status);
		return new HomeportError(code, message, status, undefined, context);
	}

	/**
	 * Create an HomeportError from a caught network/fetch error.
	 */
	static fromNetworkError(err: unknown, context?: HomeportErrorContext): HomeportError {
		const message = err instanceof Error ? err.message : String(err);
		return new HomeportError(HomeportErrorCode.NETWORK_ERROR, `Network error: ${message}`, undefined, err, context);
	}
}

/**
 * Map an HTTP status code to an HomeportErrorCode.
 */
function statusToErrorCode(status: number): HomeportErrorCode {
	switch (status) {
		case 401:
			return HomeportErrorCode.UNAUTHORIZED;
		case 403:
			return HomeportErrorCode.FORBIDDEN;
		case 404:
			return HomeportErrorCode.NOT_FOUND;
		case 422:
			return HomeportErrorCode.VALIDATION_ERROR;
		case 429:
			return HomeportErrorCode.RATE_LIMITED;
		default:
			if (status >= 500) return HomeportErrorCode.SERVER_ERROR;
			if (status >= 400) return HomeportErrorCode.VALIDATION_ERROR;
			return HomeportErrorCode.NETWORK_ERROR;
	}
}

