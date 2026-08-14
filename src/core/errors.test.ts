// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { HomeportError, HomeportErrorCode } from './errors';

describe('HomeportError', () => {
	it('constructs with code and message', () => {
		const err = new HomeportError(HomeportErrorCode.NETWORK_ERROR, 'connection failed');
		expect(err).toBeInstanceOf(Error);
		expect(err.name).toBe('HomeportError');
		expect(err.code).toBe(HomeportErrorCode.NETWORK_ERROR);
		expect(err.message).toBe('connection failed');
		expect(err.statusCode).toBeUndefined();
		expect(err.originalError).toBeUndefined();
	});

	it('constructs with statusCode and originalError', () => {
		const original = new Error('underlying');
		const err = new HomeportError(HomeportErrorCode.SERVER_ERROR, 'server down', 500, original);
		expect(err.statusCode).toBe(500);
		expect(err.originalError).toBe(original);
	});

	describe('fromStatus', () => {
		it.each([
			[401, HomeportErrorCode.UNAUTHORIZED],
			[403, HomeportErrorCode.FORBIDDEN],
			[404, HomeportErrorCode.NOT_FOUND],
			[422, HomeportErrorCode.VALIDATION_ERROR],
			[429, HomeportErrorCode.RATE_LIMITED],
			[500, HomeportErrorCode.SERVER_ERROR],
			[502, HomeportErrorCode.SERVER_ERROR],
			[503, HomeportErrorCode.SERVER_ERROR],
			[400, HomeportErrorCode.VALIDATION_ERROR],
			[418, HomeportErrorCode.VALIDATION_ERROR],
			[200, HomeportErrorCode.NETWORK_ERROR]
		])('maps HTTP %i to %s', (status, expectedCode) => {
			const err = HomeportError.fromStatus(status, `HTTP ${status}`);
			expect(err.code).toBe(expectedCode);
			expect(err.statusCode).toBe(status);
		});
	});

	describe('fromNetworkError', () => {
		it('wraps an Error instance', () => {
			const original = new Error('ECONNREFUSED');
			const err = HomeportError.fromNetworkError(original);
			expect(err.code).toBe(HomeportErrorCode.NETWORK_ERROR);
			expect(err.message).toContain('ECONNREFUSED');
			expect(err.originalError).toBe(original);
		});

		it('wraps a non-Error value', () => {
			const err = HomeportError.fromNetworkError('string error');
			expect(err.code).toBe(HomeportErrorCode.NETWORK_ERROR);
			expect(err.message).toContain('string error');
		});
	});
});

