// SPDX-License-Identifier: Apache-2.0
import { describe, it, expect, vi } from 'vitest';
import { createHomeportLogger, type HomeportLogger } from './logger';

describe('createHomeportLogger', () => {
	it('returns no-op logger when disabled', () => {
		const logger = createHomeportLogger(false);
		// Should not throw — just no-ops
		logger.debug('test');
		logger.info('test');
		logger.warn('test');
		logger.error('test');
	});

	it('logs to console when enabled', () => {
		const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
		const logger = createHomeportLogger(true);
		logger.info('hello', { key: 'val' });
		expect(spy).toHaveBeenCalledWith('[homeport-sdk]', 'hello', { key: 'val' });
		spy.mockRestore();
	});

	it('logs with empty string when no data provided', () => {
		const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		const logger = createHomeportLogger(true);
		logger.debug('no data');
		expect(spy).toHaveBeenCalledWith('[homeport-sdk]', 'no data', '');
		spy.mockRestore();
	});

	it('logs all levels with [homeport-sdk] prefix', () => {
		const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const logger = createHomeportLogger(true);
		logger.debug('d');
		logger.info('i');
		logger.warn('w');
		logger.error('e');

		expect(debugSpy).toHaveBeenCalledWith('[homeport-sdk]', 'd', '');
		expect(infoSpy).toHaveBeenCalledWith('[homeport-sdk]', 'i', '');
		expect(warnSpy).toHaveBeenCalledWith('[homeport-sdk]', 'w', '');
		expect(errorSpy).toHaveBeenCalledWith('[homeport-sdk]', 'e', '');

		debugSpy.mockRestore();
		infoSpy.mockRestore();
		warnSpy.mockRestore();
		errorSpy.mockRestore();
	});
});

