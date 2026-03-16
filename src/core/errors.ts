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

export class NnnError extends Error {
	constructor(
		public code: NnnErrorCode,
		message: string,
		public statusCode?: number,
		public originalError?: unknown
	) {
		super(message);
		this.name = 'NnnError';
	}

	/**
	 * Create an NnnError from an HTTP response status code.
	 */
	static fromStatus(status: number, message: string): NnnError {
		const code = statusToErrorCode(status);
		return new NnnError(code, message, status);
	}

	/**
	 * Create an NnnError from a caught network/fetch error.
	 */
	static fromNetworkError(err: unknown): NnnError {
		const message = err instanceof Error ? err.message : String(err);
		return new NnnError(NnnErrorCode.NETWORK_ERROR, `Network error: ${message}`, undefined, err);
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

