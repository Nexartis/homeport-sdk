// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { NnnError, NnnErrorCode } from './errors';

describe('NnnError', () => {
	it('constructs with code and message', () => {
		const err = new NnnError(NnnErrorCode.NETWORK_ERROR, 'connection failed');
		expect(err).toBeInstanceOf(Error);
		expect(err.name).toBe('NnnError');
		expect(err.code).toBe(NnnErrorCode.NETWORK_ERROR);
		expect(err.message).toBe('connection failed');
		expect(err.statusCode).toBeUndefined();
		expect(err.originalError).toBeUndefined();
	});

	it('constructs with statusCode and originalError', () => {
		const original = new Error('underlying');
		const err = new NnnError(NnnErrorCode.SERVER_ERROR, 'server down', 500, original);
		expect(err.statusCode).toBe(500);
		expect(err.originalError).toBe(original);
	});

	describe('fromStatus', () => {
		it.each([
			[401, NnnErrorCode.UNAUTHORIZED],
			[403, NnnErrorCode.FORBIDDEN],
			[404, NnnErrorCode.NOT_FOUND],
			[422, NnnErrorCode.VALIDATION_ERROR],
			[429, NnnErrorCode.RATE_LIMITED],
			[500, NnnErrorCode.SERVER_ERROR],
			[502, NnnErrorCode.SERVER_ERROR],
			[503, NnnErrorCode.SERVER_ERROR],
			[400, NnnErrorCode.VALIDATION_ERROR],
			[418, NnnErrorCode.VALIDATION_ERROR],
			[200, NnnErrorCode.NETWORK_ERROR]
		])('maps HTTP %i to %s', (status, expectedCode) => {
			const err = NnnError.fromStatus(status, `HTTP ${status}`);
			expect(err.code).toBe(expectedCode);
			expect(err.statusCode).toBe(status);
		});
	});

	describe('fromNetworkError', () => {
		it('wraps an Error instance', () => {
			const original = new Error('ECONNREFUSED');
			const err = NnnError.fromNetworkError(original);
			expect(err.code).toBe(NnnErrorCode.NETWORK_ERROR);
			expect(err.message).toContain('ECONNREFUSED');
			expect(err.originalError).toBe(original);
		});

		it('wraps a non-Error value', () => {
			const err = NnnError.fromNetworkError('string error');
			expect(err.code).toBe(NnnErrorCode.NETWORK_ERROR);
			expect(err.message).toContain('string error');
		});
	});
});

