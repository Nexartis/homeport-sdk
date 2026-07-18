// SPDX-License-Identifier: Apache-2.0
/**
 * Homeport SDK — Webhooks Namespace
 *
 * Accessed via `client.webhooks.*`.
 *
 * @module core/namespaces/webhooks
 */

import type { HomeportClientInternals } from '../namespace-helpers.js';
import type {
	CreateWebhookRequest,
	CreateWebhookResponse,
	WebhookSubscription
} from '../types.js';

export class WebhooksNamespace {
	/** @internal */
	constructor(private readonly _client: HomeportClientInternals) {}

	/** GET /api/webhooks — List webhook subscriptions. */
	async list(): Promise<{ subscriptions: WebhookSubscription[] }> {
		return this._client.getJson('/api/webhooks', 'webhooks.list');
	}

	/** POST /api/webhooks — Create a webhook subscription. */
	async create(params: CreateWebhookRequest): Promise<CreateWebhookResponse> {
		return this._client.postJson('/api/webhooks', params, 'webhooks.create');
	}

	/** GET /api/webhooks/:id — Get a single webhook subscription. */
	async get(webhookId: string): Promise<{ subscription: WebhookSubscription }> {
		return this._client.getJson(`/api/webhooks/${encodeURIComponent(webhookId)}`, 'webhooks.get');
	}

	/** PATCH /api/webhooks/:id — Update a webhook (pause/resume). */
	async update(webhookId: string, action: 'pause' | 'resume'): Promise<Record<string, unknown>> {
		return this._client.patchJson(`/api/webhooks/${encodeURIComponent(webhookId)}`, { action }, 'webhooks.update');
	}

	/** DELETE /api/webhooks/:id — Delete a webhook subscription. */
	async delete(webhookId: string): Promise<{ ok: boolean; deleted: string }> {
		return this._client.deleteJson(`/api/webhooks/${encodeURIComponent(webhookId)}`, 'webhooks.delete');
	}
}

