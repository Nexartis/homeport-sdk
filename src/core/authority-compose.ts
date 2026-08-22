// SPDX-License-Identifier: Apache-2.0
/**
 * Compose Homeport A2A grant fields from an authority-grant/1 body.
 * Structural — no GPR runtime dependency (this SDK publishes to npmjs).
 */

export type AuthorityGrantComposeInput = {
	schemaVersion: 'authority-grant/1';
	grantId: string;
	delegator: { id: string };
	delegate: { id: string };
	expiresAt: string;
};

export type HomeportA2AGrantFields = {
	grant_id: string;
	delegator_id: string;
	delegate_id: string;
	expires_at: string;
};

function requireNonEmpty(value: unknown, field: string): string {
	if (typeof value !== 'string' || value.trim().length === 0) {
		throw new Error(`homeport_authority_compose: ${field} is required`);
	}
	return value.trim();
}

export function composeHomeportA2AFields(grant: AuthorityGrantComposeInput): HomeportA2AGrantFields {
	if (grant.schemaVersion !== 'authority-grant/1') {
		throw new Error('homeport_authority_compose: schemaVersion must be authority-grant/1');
	}
	return {
		grant_id: requireNonEmpty(grant.grantId, 'grantId'),
		delegator_id: requireNonEmpty(grant.delegator?.id, 'delegator.id'),
		delegate_id: requireNonEmpty(grant.delegate?.id, 'delegate.id'),
		expires_at: requireNonEmpty(grant.expiresAt, 'expiresAt')
	};
}
