import { describe, it, expect, vi } from 'vitest';
import { createNnnLogger, type NnnLogger } from './logger';

describe('createNnnLogger', () => {
	it('returns no-op logger when disabled', () => {
		const logger = createNnnLogger(false);
		// Should not throw — just no-ops
		logger.debug('test');
		logger.info('test');
		logger.warn('test');
		logger.error('test');
	});

	it('logs to console when enabled', () => {
		const spy = vi.spyOn(console, 'info').mockImplementation(() => {});
		const logger = createNnnLogger(true);
		logger.info('hello', { key: 'val' });
		expect(spy).toHaveBeenCalledWith('[nnn-sdk]', 'hello', { key: 'val' });
		spy.mockRestore();
	});

	it('logs with empty string when no data provided', () => {
		const spy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		const logger = createNnnLogger(true);
		logger.debug('no data');
		expect(spy).toHaveBeenCalledWith('[nnn-sdk]', 'no data', '');
		spy.mockRestore();
	});

	it('logs all levels with [nnn-sdk] prefix', () => {
		const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
		const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		const logger = createNnnLogger(true);
		logger.debug('d');
		logger.info('i');
		logger.warn('w');
		logger.error('e');

		expect(debugSpy).toHaveBeenCalledWith('[nnn-sdk]', 'd', '');
		expect(infoSpy).toHaveBeenCalledWith('[nnn-sdk]', 'i', '');
		expect(warnSpy).toHaveBeenCalledWith('[nnn-sdk]', 'w', '');
		expect(errorSpy).toHaveBeenCalledWith('[nnn-sdk]', 'e', '');

		debugSpy.mockRestore();
		infoSpy.mockRestore();
		warnSpy.mockRestore();
		errorSpy.mockRestore();
	});
});

