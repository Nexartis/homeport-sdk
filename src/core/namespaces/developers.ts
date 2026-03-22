/**
 * NNN SDK — Developers Namespace
 *
 * Accessed via `client.developers.*`.
 * Covers developer key management and earnings.
 *
 * @module core/namespaces/developers
 */

import type { NnnClientInternals } from '../namespace-helpers.js';
import type {
	DeveloperApiKey,
	CreateDeveloperKeyRequest,
	CreateDeveloperKeyResponse,
	RevokeDeveloperKeyResponse,
	EarningsActionRequest
} from '../types.js';

export class DevelopersNamespace {
	/** @internal */
	constructor(private readonly _client: NnnClientInternals) {}

	// ── API Keys ──────────────────────────────────────────────────────

	/** GET /api/developers/keys — List all API keys for the authenticated user. */
	async listKeys(): Promise<{ keys: DeveloperApiKey[] }> {
		return this._client.getJson('/api/developers/keys', 'developers.listKeys');
	}

	/** POST /api/developers/keys — Generate a new developer API key. */
	async createKey(req: CreateDeveloperKeyRequest): Promise<CreateDeveloperKeyResponse> {
		return this._client.postJson('/api/developers/keys', req, 'developers.createKey');
	}

	/** DELETE /api/developers/keys/:id — Revoke a developer API key. */
	async revokeKey(keyId: string): Promise<RevokeDeveloperKeyResponse> {
		return this._client.deleteJson(
			`/api/developers/keys/${encodeURIComponent(keyId)}`,
			'developers.revokeKey'
		);
	}

	// ── Earnings ──────────────────────────────────────────────────────

	/** GET /api/developer/earnings — Get developer earnings. */
	async getEarnings(developerId: string, view?: string): Promise<Record<string, unknown>> {
		const sp = new URLSearchParams({ developerId });
		if (view) sp.set('view', view);
		return this._client.getJson(`/api/developer/earnings?${sp.toString()}`, 'developers.getEarnings');
	}

	/** POST /api/developer/earnings — Perform an earnings action. */
	async earningsAction(params: EarningsActionRequest): Promise<Record<string, unknown>> {
		return this._client.postJson('/api/developer/earnings', params, 'developers.earningsAction');
	}
}

