/**
 * NNN SDK — SSE (Server-Sent Events) Parser
 *
 * Shared async generator for parsing `text/event-stream` responses.
 * Used by both orchestration (workflow event streams) and federation (A2A streaming).
 *
 * @internal — not part of the public API.
 * @module core/sse
 */

import type { NnnLogger } from './logger';

/**
 * Parse an SSE stream into JSON objects.
 *
 * Handles `data:` lines, multi-line events, comment lines (`:` prefix),
 * and the `[DONE]` sentinel. Unparseable events are logged and skipped.
 */
export async function* parseSSEStream<T = Record<string, unknown>>(
	body: ReadableStream<Uint8Array>,
	logger: NnnLogger
): AsyncGenerator<T, void, unknown> {
	const reader = body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	try {
		const dataLines: string[] = [];
		let streamDone = false;

		const flushEvent = function* () {
			if (dataLines.length === 0) return;
			const payload = dataLines.splice(0).join('\n');
			if (payload === '[DONE]') { streamDone = true; return; }
			try { yield JSON.parse(payload) as T; }
			catch { logger.warn('Failed to parse SSE event', { data: payload }); }
		};

		while (!streamDone) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop() ?? '';
			for (const line of lines) {
				const trimmed = line.trim();
				if (trimmed.startsWith(':')) continue;
				if (!trimmed) { yield* flushEvent(); if (streamDone) break; continue; }
				if (trimmed.startsWith('data:')) {
					dataLines.push(trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed.slice(5));
				}
			}
		}
		if (!streamDone) yield* flushEvent();
	} finally {
		reader.cancel().catch(() => {});
		reader.releaseLock();
	}
}

/** Generate a unique request ID, safe across all JS runtimes. */
export function generateRequestId(): string {
	try {
		if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
			return globalThis.crypto.randomUUID();
		}
	} catch { /* crypto.randomUUID unavailable — fall back to timestamp+random */ }
	return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

