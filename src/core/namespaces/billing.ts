/**
 * NNN SDK — Billing Namespace
 *
 * Accessed via `client.billing.*`.
 * Covers subscriptions, invoices, checkout sessions, and NP payment verification.
 *
 * @module core/namespaces/billing
 */

import type { NnnClientInternals } from '../namespace-helpers';
import type {
	CreateSubscriptionRequest,
	CreateInvoiceRequest,
	CreateCheckoutRequest,
	CheckoutSession,
	VerifyNpPaymentRequest,
	VerifyNpPaymentResponse
} from '../types';

export class BillingNamespace {
	/** @internal */
	constructor(private readonly _client: NnnClientInternals) {}

	// ── Subscriptions ───────────────────────────────────────────

	/** GET /api/subscriptions?keyId= — Get subscription for a key. */
	async getSubscription(keyId: string): Promise<Record<string, unknown>> {
		return this._client.getJson(`/api/subscriptions?keyId=${encodeURIComponent(keyId)}`, 'billing.getSubscription');
	}

	/** POST /api/subscriptions — Create a new subscription. */
	async createSubscription(params: CreateSubscriptionRequest): Promise<Record<string, unknown>> {
		this._client.logger.debug('Creating subscription', { keyId: params.key_id, plan: params.plan });
		return this._client.postJson('/api/subscriptions', params, 'billing.createSubscription');
	}

	// ── Invoices ────────────────────────────────────────────────

	/** GET /api/invoices?keyId= — List invoices for a key. */
	async listInvoices(keyId: string): Promise<Record<string, unknown>> {
		return this._client.getJson(`/api/invoices?keyId=${encodeURIComponent(keyId)}`, 'billing.listInvoices');
	}

	/** POST /api/invoices — Create a new invoice. */
	async createInvoice(params: CreateInvoiceRequest): Promise<Record<string, unknown>> {
		this._client.logger.debug('Creating invoice', { keyId: params.key_id });
		return this._client.postJson('/api/invoices', params, 'billing.createInvoice');
	}

	// ── Checkout Sessions ───────────────────────────────────────

	/** POST /api/ucp/checkout-sessions — Create a checkout session. */
	async createCheckoutSession(params: CreateCheckoutRequest): Promise<CheckoutSession> {
		this._client.logger.debug('Creating checkout session', { capabilities: params.capabilities.length });
		return this._client.postJson('/api/ucp/checkout-sessions', params, 'billing.createCheckoutSession');
	}

	/** GET /api/ucp/checkout-sessions?id= — Get a checkout session. */
	async getCheckoutSession(sessionId: string): Promise<CheckoutSession> {
		return this._client.getJson(`/api/ucp/checkout-sessions?id=${encodeURIComponent(sessionId)}`, 'billing.getCheckoutSession');
	}

	/** PATCH /api/ucp/checkout-sessions/:id — Submit payment for a checkout session. */
	async submitCheckoutPayment(sessionId: string, payment: Record<string, unknown>): Promise<Record<string, unknown>> {
		this._client.logger.debug('Submitting checkout payment', { sessionId });
		return this._client.patchJson(`/api/ucp/checkout-sessions/${encodeURIComponent(sessionId)}`, { payment }, 'billing.submitCheckoutPayment');
	}

	/** DELETE /api/ucp/checkout-sessions/:id — Cancel a checkout session. */
	async cancelCheckoutSession(sessionId: string): Promise<{ id: string; status: string }> {
		this._client.logger.debug('Cancelling checkout session', { sessionId });
		return this._client.deleteJson(`/api/ucp/checkout-sessions/${encodeURIComponent(sessionId)}`, 'billing.cancelCheckoutSession');
	}

	// ── NP Payments ─────────────────────────────────────────────

	/** POST /api/payments/verify-np — Verify a Nanda Point payment. */
	async verifyNpPayment(req: VerifyNpPaymentRequest): Promise<VerifyNpPaymentResponse> {
		this._client.logger.debug('Verifying NP payment', { agent: req.agent, tx_id: req.tx_id });
		return this._client.postJson('/api/payments/verify-np', req, 'billing.verifyNpPayment');
	}
}

