/**
 * NNN SDK — Payments Namespace
 *
 * Accessed via `client.payments.*`.
 * Covers multi-currency support: currencies, exchange rates, conversion, and wallets.
 *
 * @module core/namespaces/payments
 */

import type { NnnClientInternals } from '../namespace-helpers.js';
import type {
	CurrenciesResponse,
	ExchangeRate,
	ExchangeRateMatrixResponse,
	ConvertCurrencyRequest,
	ConvertCurrencyResponse,
	WalletBalancesResponse
} from '../types.js';

export class PaymentsNamespace {
	/** @internal */
	constructor(private readonly _client: NnnClientInternals) {}

	/**
	 * GET /api/payments/currencies — List all supported currencies.
	 *
	 * Returns the active currency definitions (NP, USDC, USDT, DAI, EURC).
	 */
	async getCurrencies(): Promise<CurrenciesResponse> {
		return this._client.getJson('/api/payments/currencies', 'payments.getCurrencies');
	}

	/**
	 * GET /api/payments/rates — Get exchange rates.
	 *
	 * With `from` and `to` params, returns a single pair rate.
	 * Without params, returns the full rate matrix for all active currencies.
	 */
	async getRates(): Promise<ExchangeRateMatrixResponse>;
	async getRates(from: string, to: string): Promise<ExchangeRate>;
	async getRates(from?: string, to?: string): Promise<ExchangeRateMatrixResponse | ExchangeRate> {
		if (from && to) {
			const sp = new URLSearchParams({ from, to });
			return this._client.getJson(`/api/payments/rates?${sp.toString()}`, 'payments.getRates');
		}
		return this._client.getJson('/api/payments/rates', 'payments.getRates');
	}

	/**
	 * POST /api/payments/convert — Convert an amount between currencies.
	 *
	 * Returns the converted amount and the rate used.
	 */
	async convert(req: ConvertCurrencyRequest): Promise<ConvertCurrencyResponse> {
		this._client.logger.debug('Converting currency', { from: req.from, to: req.to, amount: req.amount });
		return this._client.postJson('/api/payments/convert', req, 'payments.convert');
	}

	/**
	 * GET /api/payments/wallets/:agent_id — Get multi-currency wallet balances.
	 *
	 * Returns all currency balances for the specified agent.
	 */
	async getWalletBalances(agentId: string): Promise<WalletBalancesResponse> {
		return this._client.getJson(
			`/api/payments/wallets/${encodeURIComponent(agentId)}`,
			'payments.getWalletBalances'
		);
	}

	// ── A2A Typed Actions ────────────────────────────────────────────

	/**
	 * A2A action: `payment.rates` — Get exchange rate via JSON-RPC.
	 */
	async a2aGetRate(from: string, to: string): Promise<{ from: string; to: string; rate: number }> {
		return this._client.postJson('/a2a', {
			jsonrpc: '2.0',
			id: Date.now().toString(),
			method: 'payment.rates',
			params: { from, to }
		}, 'payments.a2aGetRate') as Promise<{ from: string; to: string; rate: number }>;
	}

	/**
	 * A2A action: `payment.balance` — Get wallet balances via JSON-RPC.
	 */
	async a2aGetBalance(agentId: string): Promise<WalletBalancesResponse> {
		return this._client.postJson('/a2a', {
			jsonrpc: '2.0',
			id: Date.now().toString(),
			method: 'payment.balance',
			params: { agent_id: agentId }
		}, 'payments.a2aGetBalance') as Promise<WalletBalancesResponse>;
	}

	/**
	 * A2A action: `payment.convert` — Convert currency via JSON-RPC.
	 */
	async a2aConvert(from: string, to: string, amount: number): Promise<ConvertCurrencyResponse> {
		return this._client.postJson('/a2a', {
			jsonrpc: '2.0',
			id: Date.now().toString(),
			method: 'payment.convert',
			params: { from, to, amount }
		}, 'payments.a2aConvert') as Promise<ConvertCurrencyResponse>;
	}
}
