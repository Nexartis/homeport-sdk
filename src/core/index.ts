// SPDX-License-Identifier: Apache-2.0
/**
 * @nexartis/homeport-sdk/core
 *
 * Main entry point for the Homeport SDK core module.
 * Re-exports all public types, classes, and utility functions.
 */

// Client
export { HomeportClient, SDK_VERSION } from './client.js';

// Namespace classes
export {
	AgentsNamespace,
	OrchestrationNamespace,
	TrustNamespace,
	FederationNamespace,
	WebhooksNamespace,
	DevelopersNamespace,
	BillingNamespace,
	SwitchboardNamespace,
	PaymentsNamespace
} from './namespaces/index.js';

// Circuit Breaker (standalone utility)
export { CircuitBreaker } from './circuit-breaker.js';
export type { CircuitBreakerState } from './circuit-breaker.js';

// Types
export type {
	HomeportConfig,
	HomeportRetryConfig,
	HomeportCacheConfig,
	HomeportHealthStatus,
	HomeportAgent,
	RegisterAgentRequest,
	RegisterAgentResponse,
	SearchAgentsParams,
	AgentCardSkill,
	AgentCard,
	AgentFacts,
	NandaIndex,
	HomeportStats,
	DagNode,
	DagEdge,
	DagDefinition,
	CreateWorkflowRequest,
	WorkflowRecord,
	WorkflowRunResult,
	RoutingRequest,
	RoutingResult,
	RouteRequestParams,
	A2ARequest,
	A2AResponse,
	SendA2ARequestParams,
	UpdateAgentRequest,
	AgentRefreshResult,
	WorkflowRunStatus,
	WorkflowRun,
	StepRun,
	IndexDiffResult,
	IndexChangeCallback,
	IndexChangeEvent,
	HomeportHooks,
	HomeportCircuitBreakerConfig,
	PaginatedResponse,
	WorkflowStep,
	WorkflowDetail,
	UpdateWorkflowRequest,
	DelegateTaskRequest,
	DelegationResult,
	DelegationGrantRequest,
	DelegationGrantResult,
	DelegationRevokeRequest,
	DelegationRevokeResult,
	DelegationCheckResult,
	ListPatternsOptions,
	OrchestratorPattern,
	CreatePatternRequest,
	ListConflictsParams,
	ConflictCandidate,
	OrchestrationConflict,
	RaiseConflictRequest,
	ConflictOutcome,
	AgentAddr,
	ResolutionContext,
	ResolvedEndpoint,
	ResolutionResult,
	ReputationEntry,
	TrustScoresOptions,
	TrustFrameworksOptions,
	SubscriptionPlan,
	CreateSubscriptionRequest,
	CreateInvoiceRequest,
	CreateCheckoutRequest,
	CheckoutLineItem,
	CheckoutTotals,
	CheckoutPayment,
	CheckoutSession,
	CreateWebhookRequest,
	WebhookSubscription,
	CreateWebhookResponse,
	EarningsActionRequest,
	// Sprint C types
	DeveloperApiKey,
	CreateDeveloperKeyRequest,
	CreateDeveloperKeyResponse,
	RevokeDeveloperKeyResponse,
	DeprecateAgentRequest,
	DeprecateAgentResponse,
	TombstoneAgentResponse,
	CreateAgentVersionRequest,
	AgentVersion,
	ComplianceScanResult,
	TrustEdge,
	TrustGraphResponse,
	TrustPathResponse,
	BehaviorMetric,
	BehaviorAnalyticsResponse,
	VerifyNpPaymentRequest,
	VerifyNpPaymentResponse,
	ProtocolType,
	DetectedProtocol,
	SwitchboardLookupResult,
	SwitchboardDiscoverRequest,
	SwitchboardExportFormat,
	SwitchboardExportRequest,
	SwitchboardExportResponse,
	SwitchboardResyncRequest,
	SwitchboardResyncResponse,
	ProtocolAdapterRecord,
	AdapterInfo,
	SwitchboardAdaptersResponse,
	CurrencyDefinition,
	ExchangeRate,
	ConvertCurrencyRequest,
	ConvertCurrencyResponse,
	WalletBalancesResponse,
	ExchangeRateMatrixResponse,
	CurrenciesResponse
} from './types.js';

// Errors
export { HomeportError, HomeportErrorCode } from './errors.js';
export type { HomeportErrorContext } from './errors.js';

// Logger
export { createHomeportLogger } from './logger.js';
export type { HomeportLogger } from './logger.js';

// Retry (standalone utility)
export { fetchWithRetry, normalizeBaseUrl, calculateBackoffDelay, isTransientError, DEFAULT_RETRY_CONFIG } from './retry.js';

