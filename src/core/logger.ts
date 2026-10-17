// SPDX-License-Identifier: Apache-2.0
/**
 * Homeport SDK — Portable Logger
 *
 * Framework-agnostic logger with structured output.
 * No external dependencies — uses console directly.
 * Configurable via HomeportClient constructor (verbose flag).
 *
 * @module core/logger
 */

export interface HomeportLogger {
	debug(message: string, data?: Record<string, unknown>): void;
	info(message: string, data?: Record<string, unknown>): void;
	warn(message: string, data?: Record<string, unknown>): void;
	error(message: string, data?: Record<string, unknown>): void;
}

/**
 * Create a portable logger instance.
 *
 * When `enabled` is false, all methods are no-ops.
 * When `enabled` is true, logs to console with a `[homeport-sdk]` prefix.
 */
export function createHomeportLogger(enabled: boolean): HomeportLogger {
	if (!enabled) {
		const noop = () => {};
		return { debug: noop, info: noop, warn: noop, error: noop };
	}

	const prefix = '[homeport-sdk]';
	return {
		debug(message: string, data?: Record<string, unknown>) {
			console.debug(prefix, message, data ?? '');
		},
		info(message: string, data?: Record<string, unknown>) {
			console.info(prefix, message, data ?? '');
		},
		warn(message: string, data?: Record<string, unknown>) {
			console.warn(prefix, message, data ?? '');
		},
		error(message: string, data?: Record<string, unknown>) {
			console.error(prefix, message, data ?? '');
		}
	};
}

