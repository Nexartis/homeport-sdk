/**
 * NNN SDK — Retry with Exponential Backoff
 *
 * Provides fetchWithRetry() used by all NNN API operations.
 * Handles transient errors (network, 5xx, 429) with
 * exponential backoff and jitter.
 *
 * @module core/retry
 */

import type { NnnRetryConfig } from './types';
import { NnnError, NnnErrorCode } from './errors';

/** Strip trailing slashes from an API base URL to prevent double-slash paths. */
export function normalizeBaseUrl(url: string): string {
	return url.replace(/\/+$/, '');
}

const DEFAULT_RETRY_CONFIG: Required<NnnRetryConfig> = {
	maxRetries: 3,
	baseDelayMs: 1000,
	maxDelayMs: 10000,
	timeoutMs: 8000
};

/**
 * Calculate exponential backoff delay with jitter (±25%).
 */
export function calculateBackoffDelay(attempt: number, config: Required<NnnRetryConfig>): number {
	const exponentialDelay = Math.pow(2, attempt) * config.baseDelayMs;
	const jitter = exponentialDelay * (0.75 + Math.random() * 0.5);
	return Math.min(jitter, config.maxDelayMs);
}

/**
 * Determine whether an error is transient (retryable).
 */
export function isTransientError(err: unknown): boolean {
	if (!err || typeof err !== 'object') return false;
	const e = err as Record<string, unknown>;
	const msg = String(e.message || '');

	if (e.name === 'AbortError') return false;

	if (
		msg.includes('fetch failed') ||
		msg.includes('ECONNREFUSED') ||
		msg.includes('ECONNRESET') ||
		msg.includes('ETIMEDOUT') ||
		msg.includes('UND_ERR_CONNECT_TIMEOUT') ||
		msg.includes('ENOTFOUND')
	) {
		return true;
	}

	const status = (e.statusCode ?? e.status) as number | undefined;
	if (status === 429 || (status !== undefined && status >= 500 && status < 600)) {
		return true;
	}

	if (e.cause && typeof e.cause === 'object') {
		const causeCode = (e.cause as Record<string, unknown>).code;
		if (
			causeCode === 'ECONNREFUSED' ||
			causeCode === 'ECONNRESET' ||
			causeCode === 'ETIMEDOUT' ||
			causeCode === 'ENOTFOUND' ||
			causeCode === 'UND_ERR_CONNECT_TIMEOUT'
		) {
			return true;
		}
	}

	return false;
}

/**
 * Fetch with retry and exponential backoff.
 */
export async function fetchWithRetry(
	url: string,
	options: RequestInit = {},
	context = 'request',
	retryConfig?: NnnRetryConfig
): Promise<Response> {
	const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig } as Required<NnnRetryConfig>;
	const { maxRetries, timeoutMs } = config;
	let lastError: unknown;

	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		const callerSignal = options.signal;
		const onCallerAbort = callerSignal
			? () => controller.abort(callerSignal.reason)
			: undefined;
		if (callerSignal && !callerSignal.aborted) {
			callerSignal.addEventListener('abort', onCallerAbort!, { once: true });
		} else if (callerSignal?.aborted) {
			controller.abort(callerSignal.reason);
		}

		try {
			const response = await fetch(url, {
				...options,
				signal: controller.signal
			});

			if (response.status >= 500 || response.status === 429) {
				// On the final attempt, return the raw response so the caller
				// can fire afterResponse hooks before handling the error.
				if (attempt >= maxRetries) {
					return response;
				}
				let bodyText = '';
				try {
					bodyText = await response.text();
				} catch {
					/* drain best-effort */
				}
				throw NnnError.fromStatus(
					response.status,
					`[${context}] HTTP ${response.status}: ${bodyText || '(no body)'}`
				);
			}

			return response;
		} catch (err) {
			lastError = err;

			const isAbort = err instanceof Error && err.name === 'AbortError';
			if (isAbort && callerSignal?.aborted) {
				throw err;
			}
			const isTransient = isAbort ? true : isTransientError(err);
			const isLastAttempt = attempt >= maxRetries;

			if (!isTransient || isLastAttempt) {
				if (!(err instanceof NnnError)) {
					throw NnnError.fromNetworkError(err);
				}
				throw err;
			}

			const delay = calculateBackoffDelay(attempt, config);
			await new Promise((resolve) => setTimeout(resolve, delay));
		} finally {
			clearTimeout(timeoutId);
			if (callerSignal && onCallerAbort) {
				callerSignal.removeEventListener('abort', onCallerAbort);
			}
		}
	}

	throw lastError;
}

export { DEFAULT_RETRY_CONFIG };

