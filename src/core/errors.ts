/**
 * NNN SDK — Typed Error Classes
 *
 * Following sentinel-sdk pattern for typed error handling.
 * Provides specific error codes for NNN API failures so consumers
 * can handle different error conditions programmatically.
 *
 * @module core/errors
 */

export enum NnnErrorCode {
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
export interface NnnErrorContext {
	/** Request ID from response headers (e.g. x-request-id). */
	requestId?: string;
	/** Number of retry attempts made before failure. */
	retryCount?: number;
	/** Total wall-clock time in milliseconds. */
	durationMs?: number;
	/** Target agent ID (for A2A calls). */
	agentId?: string;
}

export class NnnError extends Error {
	/** Structured context for observability. */
	context: NnnErrorContext;

	/**
	 * Clone of the last HTTP response that caused this error, if available.
	 * Attached by fetchWithRetry on the final failed attempt so that hooks
	 * (e.g. afterResponse) can still inspect headers/status.
	 */
	lastResponse?: Response;

	constructor(
		public code: NnnErrorCode,
		message: string,
		public statusCode?: number,
		public originalError?: unknown,
		context?: NnnErrorContext
	) {
		super(message);
		this.name = 'NnnError';
		this.context = context ?? {};
	}

	/**
	 * Create an NnnError from an HTTP response status code.
	 */
	static fromStatus(status: number, message: string, context?: NnnErrorContext): NnnError {
		const code = statusToErrorCode(status);
		return new NnnError(code, message, status, undefined, context);
	}

	/**
	 * Create an NnnError from a caught network/fetch error.
	 */
	static fromNetworkError(err: unknown, context?: NnnErrorContext): NnnError {
		const message = err instanceof Error ? err.message : String(err);
		return new NnnError(NnnErrorCode.NETWORK_ERROR, `Network error: ${message}`, undefined, err, context);
	}
}

/**
 * Map an HTTP status code to an NnnErrorCode.
 */
function statusToErrorCode(status: number): NnnErrorCode {
	switch (status) {
		case 401:
			return NnnErrorCode.UNAUTHORIZED;
		case 403:
			return NnnErrorCode.FORBIDDEN;
		case 404:
			return NnnErrorCode.NOT_FOUND;
		case 422:
			return NnnErrorCode.VALIDATION_ERROR;
		case 429:
			return NnnErrorCode.RATE_LIMITED;
		default:
			if (status >= 500) return NnnErrorCode.SERVER_ERROR;
			if (status >= 400) return NnnErrorCode.VALIDATION_ERROR;
			return NnnErrorCode.NETWORK_ERROR;
	}
}

