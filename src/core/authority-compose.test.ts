import { describe, expect, it } from 'vitest';
import { composeHomeportA2AFields } from './authority-compose.js';

describe('composeHomeportA2AFields', () => {
	it('maps authority-grant/1 ids onto Homeport A2A fields', () => {
		expect(
			composeHomeportA2AFields({
				schemaVersion: 'authority-grant/1',
				grantId: 'g1',
				delegator: { id: 'did:key:alice' },
				delegate: { id: 'did:key:agent' },
				expiresAt: '2026-08-22T00:00:00.000Z'
			})
		).toEqual({
			grant_id: 'g1',
			delegator_id: 'did:key:alice',
			delegate_id: 'did:key:agent',
			expires_at: '2026-08-22T00:00:00.000Z'
		});
	});

	it('refuses a missing grant id', () => {
		expect(() =>
			composeHomeportA2AFields({
				schemaVersion: 'authority-grant/1',
				grantId: '',
				delegator: { id: 'a' },
				delegate: { id: 'b' },
				expiresAt: '2026-08-22T00:00:00.000Z'
			})
		).toThrow(/grantId/);
	});
});
