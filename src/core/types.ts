// SPDX-License-Identifier: Apache-2.0
/**
 * Homeport SDK — Type Definitions
 *
 * TypeScript contracts for the Homeport REST + A2A API.
 * Portable — no framework dependencies.
 *
 * @module core/types
 */

// ── Client Configuration ────────────────────────────────────────────

/** Lifecycle hooks for request/response interception. */
export interface HomeportHooks {
	/** Called before every request. Can inspect the URL and mutate `init` (e.g. headers). */
	beforeRequest?: (url: string, init: RequestInit) => void | Promise<void>;
	/**
	 * Called after every response (including 4xx/5xx). Fires before error handling.
	 * The response passed to this hook is a **clone** — reading its body will not
	 * affect the caller. However, avoid heavy body reads in hot paths.
	 *
	 * **Note:** For SSE (`text/event-stream`) responses this hook is intentionally
	 * skipped because `response.clone()` tees the underlying `ReadableStream` and,
	 * if the cloned branch is not fully consumed, buffers indefinitely for
	 * long-lived streams.
	 */
	afterResponse?: (url: string, response: Response, durationMs: number) => void | Promise<void>;
	/** Called on request failure (after retries exhausted). */
	onError?: (url: string, error: unknown) => void | Promise<void>;
}

/** Circuit breaker configuration. */
export interface HomeportCircuitBreakerConfig {
	/** Number of consecutive failures before tripping the circuit. Default: 5. */
	failureThreshold?: number;
	/** Cooldown period in ms before allowing a probe request. Default: 30000. */
	cooldownMs?: number;
	/**
	 * Number of leading URL path segments used to group endpoints into circuits.
	 * Default: 2 (e.g. `/api/agents/search` and `/api/agents` share a circuit).
	 *
	 * A lower depth groups more sub-paths together. A higher depth isolates
	 * sub-paths but increases the number of independent circuits.
	 *
	 * @default 2
	 * Set to `Infinity` to give every unique pathname its own circuit.
	 */
	groupingDepth?: number;
	/**
	 * Maximum number of endpoint keys tracked simultaneously.
	 * When exceeded, the oldest (least-recently-created) entry is evicted.
	 * @default 256
	 */
	maxEndpoints?: number;
}

/** Response cache configuration. */
export interface HomeportCacheConfig {
	/** Default TTL in milliseconds. Default: 60000 (1 minute). */
	defaultTtlMs?: number;
	/** Maximum number of cached entries. Default: 256. Oldest entries are evicted when exceeded. */
	maxEntries?: number;
}

export interface HomeportConfig {
	/** Homeport base URL (e.g. 'https://homeport.example.com') */
	baseUrl: string;
	/** Bearer API key for authenticated endpoints */
	apiKey?: string;
	/** Enable debug logging */
	verbose?: boolean;
	/** Override default retry configuration */
	retryConfig?: HomeportRetryConfig;
	/** Request/response lifecycle hooks */
	hooks?: HomeportHooks;
	/** Circuit breaker configuration. Pass `false` to disable. */
	circuitBreaker?: HomeportCircuitBreakerConfig | false;
	/** OpenTelemetry trace context to propagate. */
	traceContext?: { traceparent?: string; tracestate?: string };
	/** Opt-in response caching for GET requests. */
	cache?: HomeportCacheConfig;
}

export interface HomeportRetryConfig {
	maxRetries?: number;
	baseDelayMs?: number;
	maxDelayMs?: number;
	timeoutMs?: number;
}

// ── Health ───────────────────────────────────────────────────────────

export interface HomeportHealthStatus {
	status: 'ok' | 'degraded';
	timestamp: string;
	environment: string;
	agents: number;
	checks: {
		db: 'ok' | 'error';
		r2: 'ok' | 'error';
		kv: 'ok' | 'error';
		queues: 'ok' | 'error';
	};
}

// ── Agent Registry ──────────────────────────────────────────────────

export interface HomeportAgent {
	agent_id: string;
	agent_url: string;
	api_url?: string;
	facts_url?: string;
	capabilities?: string[];
	tags?: string[];
	source?: string;
	protocols?: string[];
	created_at?: string;
	updated_at?: string;
	/** Visibility lifecycle state (Sprint D). */
	visibility?: AgentVisibility;
	/** Structured capability manifest (Sprint D). */
	capability_manifest?: CapabilityManifestEntry[];
	/** MCP server metadata (Sprint D). */
	mcp_metadata?: McpMetadata;
	/** Pricing descriptor (Sprint D). */
	pricing?: PricingDescriptor;
}

export interface RegisterAgentRequest {
	agent_id: string;
	agent_url: string;
	api_url?: string;
	facts_url?: string;
	capabilities?: string[];
	tags?: string[];
	/** Visibility lifecycle state (Sprint D). */
	visibility?: AgentVisibility;
	/** Structured capability manifest (Sprint D). */
	capability_manifest?: CapabilityManifestEntry[];
	/** MCP server metadata (Sprint D). */
	mcp_metadata?: McpMetadata;
	/** Pricing descriptor (Sprint D). */
	pricing?: PricingDescriptor;
	/** Signed AgentAddr passthrough - Ed25519 public key of the record signer (hex). */
	public_key_hex?: string;
	/** Signed AgentAddr passthrough - Ed25519 signature over the canonical record (hex). */
	signature_hex?: string;
	/** Signed AgentAddr passthrough - DID or registry ID of the signer. */
	signer_id?: string;
	/** Signed AgentAddr passthrough - record TTL in seconds. */
	ttl_seconds?: number;
}

export interface RegisterAgentResponse {
	status: 'success';
	message: string;
}

export interface SearchAgentsParams {
	q?: string;
	capabilities?: string[];
	tags?: string[];
	min_trust?: number;
	jurisdiction?: string;
	protocol?: string;
	/** Filter by visibility lifecycle state (Sprint D). */
	visibility?: AgentVisibility;
	/** Filter to agents available for hire (Sprint D). */
	for_hire?: boolean;
	/** Pagination: number of results per page. */
	limit?: number;
	/** Pagination: cursor or offset for the next page. */
	cursor?: string;
}

/** Paginated response wrapper for search endpoints. */
export interface PaginatedResponse<T> {
	data: T[];
	cursor?: string;
	hasMore: boolean;
}

// ── Agent Card (A2A Discovery) ──────────────────────────────────────

export interface AgentCardSkill {
	id: string;
	name: string;
	description: string;
	tags?: string[];
	inputModes?: string[];
	outputModes?: string[];
}

export interface AgentCard {
	name: string;
	description: string;
	url: string;
	version: string;
	protocolVersion?: string;
	capabilities?: Record<string, boolean>;
	skills: AgentCardSkill[];
	securitySchemes?: Record<string, unknown>;
	defaultInputModes?: string[];
	defaultOutputModes?: string[];
}

// ── Agent Facts ─────────────────────────────────────────────────────

export interface AgentFacts {
	agent_id: string;
	schema_version?: string;
	[key: string]: unknown;
}

// ── NANDA Index (.well-known/nanda-index) ───────────────────────────

export interface NandaIndex {
	node_id: string;
	version: string;
	supported_protocols: string[];
	quilt_types: string[];
	agent_count: number;
	agntcy_interop: boolean;
	oasf_compatible: boolean;
	signing_algorithm: string;
	resolution_endpoint: string;
	well_known_keys_endpoint: string;
	privacy_endpoint?: string;
}

// ── Stats ───────────────────────────────────────────────────────────

export interface HomeportStats {
	totalAgents: number;
	totalCapabilities: number;
	recentRegistrations: number;
	[key: string]: unknown;
}

// ── DAG / Orchestration ─────────────────────────────────────────────

export interface DagNode {
	id: string;
	type: string;
	data?: Record<string, unknown>;
}

export interface DagEdge {
	source: string;
	target: string;
	label?: string;
}

export interface DagDefinition {
	nodes: DagNode[];
	edges: DagEdge[];
}

export interface CreateWorkflowRequest {
	name: string;
	description?: string;
	owner_id: string;
	dag: DagDefinition;
	template_id?: string;
	metadata?: Record<string, unknown>;
}

export interface WorkflowRecord {
	id: string;
	name: string;
	description?: string;
	owner_id: string;
	status: string;
	dag_json?: string;
	template_id?: string;
	metadata?: string;
	created_at: string;
	updated_at: string;
}

/** Response from POST /api/orchestration/:id/runs (201). */
export interface WorkflowRunResult {
	status: string;
	run_id: string;
}

// ── Routing ─────────────────────────────────────────────────────────

export interface RoutingRequest {
	source_agent_id: string;
	action: string;
	required_capabilities?: string[];
	preferred_protocol?: string;
	min_trust_score?: number;
	max_latency_ms?: number;
	exclude_agents?: string[];
}

export interface RoutingResult {
	targetAgent: HomeportAgent;
	score: number;
	protocol: string;
	latencyEstimateMs?: number;
}

/** Parameters for the smart routing engine. */
export interface RouteRequestParams {
	skill: string;
	min_trust?: number;
	strategy?: 'best-match' | 'round-robin' | 'least-latency';
	exclude_agents?: string[];
	preferred_protocol?: string;
}

// ── A2A JSON-RPC ────────────────────────────────────────────────────

export interface A2ARequest {
	jsonrpc: '2.0';
	id: string | number;
	method: string;
	params?: Record<string, unknown>;
}

export interface A2AResponse {
	jsonrpc: '2.0';
	id: string | number;
	result?: unknown;
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
}

/** Parameters for sending an A2A JSON-RPC request. */
export interface SendA2ARequestParams {
	/** Target agent ID — will be auto-resolved to a URL via lookupAgent(). */
	target_agent_id: string;
	/** Optional direct URL — skips agent lookup if provided. */
	target_url?: string;
	/** JSON-RPC method name (e.g. 'tasks/send', 'tasks/sendSubscribe'). */
	method: string;
	/** JSON-RPC params payload. */
	params?: Record<string, unknown>;
}

// ── Agent Lifecycle ─────────────────────────────────────────────

export interface UpdateAgentRequest {
	agent_url?: string;
	api_url?: string;
	facts_url?: string;
	capabilities?: string[];
	tags?: string[];
	/** Visibility lifecycle state (Sprint D). */
	visibility?: AgentVisibility;
	/** Structured capability manifest (Sprint D). */
	capability_manifest?: CapabilityManifestEntry[];
	/** MCP server metadata (Sprint D). */
	mcp_metadata?: McpMetadata;
	/** Pricing descriptor (Sprint D). */
	pricing?: PricingDescriptor;
}

export interface AgentRefreshResult {
	status: string;
	message: string;
	agent?: HomeportAgent;
}

// ── Workflow Execution & Monitoring ─────────────────────────────

/** Response from GET /api/orchestration/runs/:runId. */
export interface WorkflowRunStatus {
	run: WorkflowRun;
	stepRuns: StepRun[];
}

/** A single workflow run record as returned by the backend. */
export interface WorkflowRun {
	id: string;
	workflow_id: string;
	status: string;
	trigger_type?: string;
	input?: Record<string, unknown>;
	output?: Record<string, unknown> | null;
	started_at?: string;
	completed_at?: string | null;
	created_at?: string;
}

/** A single step run within a workflow run. */
export interface StepRun {
	id: string;
	run_id: string;
	step_id: string;
	status: string;
	input?: Record<string, unknown> | null;
	output?: Record<string, unknown> | null;
	error?: string | null;
	started_at?: string | null;
	completed_at?: string | null;
	duration_ms?: number | null;
}

// ── NANDA Index Sync ────────────────────────────────────────────

export interface IndexDiffResult {
	since: string;
	added: HomeportAgent[];
	removed: string[];
	updated: HomeportAgent[];
}

export type IndexChangeCallback = (event: IndexChangeEvent) => void | Promise<void>;

/** Discriminated union for index change events. 'removed' only carries the agentId. */
export type IndexChangeEvent =
	| { type: 'added'; agent: HomeportAgent; timestamp: string }
	| { type: 'updated'; agent: HomeportAgent; timestamp: string }
	| { type: 'removed'; agentId: string; timestamp: string };

// ── Sprint 1: Orchestration CRUD ──────────────────────────────────

export interface WorkflowStep {
	id: string;
	workflowId: string;
	agentId: string;
	action: string;
	order: number;
	config: Record<string, unknown>;
	dependsOn: string[];
	condition: Record<string, unknown> | null;
}

export interface WorkflowDetail {
	workflow: WorkflowRecord & {
		dag: { nodes: unknown[]; edges: unknown[] };
		metadata: Record<string, unknown>;
	};
	steps: WorkflowStep[];
}

export interface UpdateWorkflowRequest {
	name?: string;
	description?: string;
	status?: 'draft' | 'active' | 'archived';
	dag?: { nodes: unknown[]; edges: unknown[] };
	metadata?: Record<string, unknown>;
}

export interface DelegateTaskRequest {
	delegator_id: string;
	action: string;
	input?: Record<string, unknown>;
	parent_workflow_id?: string;
	parent_step_id?: string;
	required_capabilities?: string[];
	target_agent_id?: string;
	timeout_ms?: number;
	max_retries?: number;
}

export interface DelegationResult {
	id: string;
	status: 'pending' | 'completed' | 'failed';
	delegator_id: string;
	action: string;
	target_agent_id?: string;
	result?: unknown;
	error?: string;
	created_at: string;
}

// ── Delegation Grants (A2A actions: delegation.grant/.revoke/.check) ──

/**
 * PUH proof envelope required on every `delegation.grant` (WC-P0-04).
 *
 * Field names are **camelCase** on the wire. The Homeport server accepts
 * camel or snake when reconstructing the envelope, but camelCase is the
 * documented shape: it mirrors the server's `PuhProof` and the canonical
 * envelope that `granted_by_proof_hash` hashes and `signature` signs.
 */
export interface DelegationGrantProof {
	/** Yanez biometric principal (Ed25519 SPKI, base64 or hex). */
	principalPk: string;
	/** Ed25519 DID of the signing device. */
	deviceDid: string;
	/** Yanez preapproval request ID. */
	requestId: string;
	/** Unix milliseconds at which the PUH binding was minted. */
	boundAt: number;
	/** Unix milliseconds at which the grant was constructed on-device. */
	issuedAt: number;
	/**
	 * Ed25519 signature (base64, url-safe base64, or hex) over the canonical
	 * proof envelope, verified server-side against `principalPk`.
	 */
	signature: string;
}

/** Parameters for `delegation.grant` — issue a scoped delegation. */
export interface DelegationGrantRequest {
	/** DID issuing the grant (grantedByDid). */
	granted_by_did: string;
	/** DID receiving the grant (grantedToDid). */
	granted_to_did: string;
	/** Action ID the grant authorizes (defaults to 'delegated' server-side). */
	action_id?: string;
	/** Capability classes / tool IDs the delegate may exercise. */
	granted_scope: string[];
	/** Unix seconds at which the grant expires. */
	expires_at: number;
	/** SHA-256 hex of the WebAuthn authenticatorData||clientDataJSON that authorized the grant. */
	granted_by_proof_hash: string;
	/**
	 * PUH proof envelope (WC-P0-04). Required — the Homeport server verifies
	 * `proof.signature` and re-derives `granted_by_proof_hash` from the
	 * canonical envelope before any grant write. The SDK validates presence
	 * and shape client-side and fails closed before the POST.
	 */
	proof: DelegationGrantProof;
	/** If this grant is a child of another grant, the parent delegation ID (enables chain-narrowing). */
	parent_delegation_id?: string | null;
	/** Whether this grant may be revoked. Defaults to true when omitted. */
	revocable?: boolean;
}

export interface DelegationGrantResult {
	delegationId: string;
	kymVcId: string | null;
	expiresAt: number;
}

/** Parameters for `delegation.revoke`. */
export interface DelegationRevokeRequest {
	delegation_id: string;
	reason?: string;
}

export interface DelegationRevokeResult {
	revoked: true;
	revokedAt: number;
	/** IDs of descendant delegations revoked in the same cascade. */
	cascadedIds: string[];
}

export interface DelegationCheckResult {
	valid: boolean;
	revoked: boolean;
	revokedAt?: number;
	expired: boolean;
	expiresAt?: number;
	credentialSubject: {
		grantedToDid: string;
		grantedByDid: string;
		scope: string[];
	};
}

export interface ListPatternsOptions {
	category?: string;
	builtin?: boolean;
}

export interface OrchestratorPattern {
	id: string;
	name: string;
	description: string | null;
	category: string;
	dagTemplate: { nodes: unknown[]; edges: unknown[] };
	inputSchema: Record<string, unknown> | null;
	tags: string[];
	isBuiltin: number;
}

export interface CreatePatternRequest {
	name: string;
	description?: string;
	category?: string;
	dag_template: { nodes: unknown[]; edges: unknown[] };
	input_schema?: Record<string, unknown>;
	tags?: string[];
}

export interface ListConflictsParams {
	workflow_id?: string;
	run_id?: string;
	pending_only?: boolean;
}

export interface ConflictCandidate {
	agent_id: string;
	response: unknown;
	score: number;
	timestamp: number;
	metadata?: Record<string, unknown>;
}

export interface OrchestrationConflict {
	id: string;
	workflow_id: string;
	run_id: string | null;
	step_id: string | null;
	conflict_type: 'competing_response' | 'timeout_race' | 'capability_overlap';
	strategy: 'highest_score' | 'first_wins' | 'voting' | 'manual';
	candidates: ConflictCandidate[];
	winner_agent_id: string | null;
	winner_response: unknown;
	resolution_score: number | null;
	resolved: boolean;
	resolved_at: string | null;
	created_at: string;
}

export interface RaiseConflictRequest {
	workflow_id: string;
	run_id?: string;
	step_id?: string;
	conflict_type?: 'competing_response' | 'timeout_race' | 'capability_overlap';
	strategy?: 'highest_score' | 'first_wins' | 'voting' | 'manual';
	candidates: ConflictCandidate[];
	metadata?: Record<string, unknown>;
}

export interface ConflictOutcome {
	conflict_id: string;
	resolved: boolean;
	winner_agent_id: string | null;
	winner_response: unknown;
	resolution_score: number | null;
	strategy: string;
}

// ── Sprint 2: Resolution & Trust ──────────────────────────────────

export interface AgentAddr {
	agent_id: string;
	agent_url: string;
	api_url: string | null;
	facts_url: string | null;
	ttl_seconds: number;
	signature: string;
	signed_at: number;
}

export interface ResolutionContext {
	min_trust_score?: number;
	required_capabilities?: string[];
	protocol_preference?: 'a2a' | 'mcp' | 'https' | 'nlweb' | 'any';
	caller_region?: string;
}

export interface ResolvedEndpoint {
	url: string;
	protocol: string;
	score: number;
	latency_ms: number | null;
	trust_score: number | null;
}

export interface ResolutionResult {
	agent_id: string;
	endpoints: ResolvedEndpoint[];
	strategy_used: string;
	resolved_at: string;
}

export interface ReputationEntry {
	agent_id: string;
	reputation: number | null;
	availability: number | null;
	error_rate: number | null;
	fraud_rate: number | null;
	p95_latency_ms: number | null;
	probe_success: number | null;
	cert_score: number | null;
	actions: string[];
	snapshot_at: string | null;
	cert_grade: string | null;
	cert_capability: string | null;
	cert_issued_at: string | null;
}

export interface TrustScoresOptions {
	agent?: string;
	offset?: number;
	limit?: number;
}

export interface TrustFrameworksOptions {
	id?: string;
}


// ── Sprint 3: Billing, Webhooks & Federation ──────────────────────

export type SubscriptionPlan = 'starter' | 'pro' | 'enterprise';

export interface CreateSubscriptionRequest {
	key_id: string;
	plan: SubscriptionPlan;
}

export interface CreateInvoiceRequest {
	key_id: string;
	period_id?: string;
	subscription_id?: string;
	line_items?: Array<{
		description: string;
		quantity: number;
		unit_price_np: number;
		total_np: number;
	}>;
	overage_call_count?: number;
}

export interface CreateCheckoutRequest {
	capabilities: Array<{ id: string; quantity: number }>;
	client_agent_id?: string;
}

export interface CheckoutLineItem {
	capability_id: string;
	quantity: number;
	unit_price: number;
	total: number;
}

export interface CheckoutTotals {
	subtotal: number;
	discount: number;
	tax: number;
	total: number;
	currency: string;
}

export interface CheckoutPayment {
	method: string;
	status: string;
	provider_ref: string | null;
	amount: number;
	currency: string;
}

export interface CheckoutSession {
	id: string;
	status: 'open' | 'pending_payment' | 'completed' | 'paid' | 'expired' | 'cancelled';
	client_agent_id: string | null;
	line_items: CheckoutLineItem[];
	totals: CheckoutTotals;
	payment: CheckoutPayment | null;
	metadata: Record<string, unknown> | null;
	created_at: number;
	updated_at: number;
	expires_at: number;
}

export interface CreateWebhookRequest {
	callback_url: string;
	events: string[];
}

export interface WebhookSubscription {
	id: string;
	callback_url: string;
	events: string;
	status: string;
	owner_id: string;
	created_at: string;
	updated_at: string;
}

export interface CreateWebhookResponse {
	id: string;
	secret: string;
	callback_url: string;
	events: string[];
	status: string;
	message: string;
}

export interface EarningsActionRequest {
	action: 'register-split' | 'compute-shares' | 'settle';
	developerId?: string;
	agentId?: string;
	splitPct?: number;
	periodId?: string;
}


// ── Sprint C: Missing Endpoint Types ────────────────────────────────

/** Developer API key as returned by the backend. */
export interface DeveloperApiKey {
	id: string;
	key_prefix: string;
	name: string;
	status: string;
	tier: string;
	rate_limit_monthly?: number;
	usage_count_monthly?: number;
	last_used_at?: string | null;
	created_at: string;
	revoked_at?: string | null;
	expires_at?: string | null;
}

/** Response from POST /api/developers/keys (201). */
export interface CreateDeveloperKeyResponse {
	message: string;
	key: {
		id: string;
		raw_key: string;
		key_prefix: string;
		name: string;
		tier: string;
		rate_limit_monthly: number;
		created_at: string;
	};
}

/** Response from DELETE /api/developers/keys/:id. */
export interface RevokeDeveloperKeyResponse {
	message: string;
	key: {
		id: string;
		key_prefix: string;
		name: string;
		status: string;
		revoked_at: string;
	};
}

/** Request body for POST /api/developers/keys. */
export interface CreateDeveloperKeyRequest {
	name: string;
	tier?: 'free' | 'pro' | 'enterprise';
}

/** Request body for POST /api/agents/:agentId/deprecate. */
export interface DeprecateAgentRequest {
	reason: string;
	grace_period_days?: number;
	notify_consumers?: boolean;
}

/** Response from POST /api/agents/:agentId/deprecate. */
export interface DeprecateAgentResponse {
	agent_id: string;
	deprecated_at: string;
	sunset_at: string;
	notified: boolean;
}

/** Response from POST /api/agents/:agentId/tombstone. */
export interface TombstoneAgentResponse {
	agent_id: string;
	tombstoned: boolean;
}

/** Request body for POST /api/agents/:agentId/versions. */
export interface CreateAgentVersionRequest {
	version: string;
	agent_url: string;
	api_url?: string | null;
	facts_url?: string | null;
	changelog?: string | null;
	capabilities?: string[];
}

/** A single agent version record. */
export interface AgentVersion {
	id: string;
	agent_id: string;
	version: string;
	agent_url: string;
	api_url?: string | null;
	facts_url?: string | null;
	capabilities?: string | null;
	changelog?: string | null;
	created_at: string;
}

/** Response from compliance scan. */
export interface ComplianceScanResult {
	ok: boolean;
	scanned: number;
	results: unknown[];
}

/** Trust graph edge. */
export interface TrustEdge {
	from_did: string;
	to_did: string;
	trust_type: string;
	score: number;
	created_at: string;
}

/** Response from GET /api/trust/framework/graph?did=. */
export interface TrustGraphResponse {
	did: string;
	incoming: TrustEdge[];
	outgoing: TrustEdge[];
	totalEdges: number;
	fetchedAt: string;
}

/** Response from GET /api/trust/framework/graph?from=&to=. */
export interface TrustPathResponse {
	path: unknown | null;
	message?: string;
	fetchedAt: string;
}

/** Behavior analytics metric record. */
export interface BehaviorMetric {
	period: string;
	reputationScore?: number | null;
	uptimePct?: number | null;
	[key: string]: unknown;
}

/** Response from GET /api/analytics/behavior. */
export interface BehaviorAnalyticsResponse {
	agent: string;
	period: string;
	metrics: BehaviorMetric[];
	trends: Record<string, unknown>;
	anomalies: Record<string, unknown>;
	fetchedAt: string;
}

/** Request body for POST /api/payments/verify-np. */
export interface VerifyNpPaymentRequest {
	agent: string;
	tx_id: string;
	amount: number;
	timestamp: number;
	signature: string;
	payee?: string;
}

/** Response from POST /api/payments/verify-np. */
export interface VerifyNpPaymentResponse {
	verified: boolean;
	settlement_id?: string;
	recon?: unknown | null;
}

// ── Sprint D: Open-Core Convergence (visibility + agent metadata) ──

/**
 * Agent visibility lifecycle state.
 *
 * Node discovery rules:
 * - Search/list surfaces return only `public` and `for_hire` agents.
 * - Lookup serves `public`, `unlisted`, and `for_hire` agents; `private` resolves to 404.
 * - Federation gossip propagates only `public` and `for_hire` agents.
 */
export type AgentVisibility = 'private' | 'unlisted' | 'public' | 'for_hire';

/** Pricing model descriptor for an agent, capability, or MCP tool. */
export interface PricingDescriptor {
	/** Pricing model. */
	model: 'free' | 'per_request' | 'subscription' | 'usage';
	/** Currency code (e.g. 'USD'). */
	currency?: string;
	/** Numeric price in the given currency. */
	price?: number;
	/** Pricing unit (e.g. 'request', 'month', '1k_tokens'). */
	unit?: string;
}

/** Authentication scheme required by a capability. */
export type CapabilityAuthScheme = 'none' | 'bearer' | 'oauth2' | 'api_key' | 'custom';

/** A single entry in an agent's structured capability manifest. */
export interface CapabilityManifestEntry {
	/** Stable capability identifier. */
	id: string;
	/** Human-readable name. */
	name?: string;
	/** Human-readable description. */
	description?: string;
	/** Authentication scheme required to invoke the capability. */
	auth?: CapabilityAuthScheme;
	/** Per-capability pricing. */
	pricing?: PricingDescriptor;
}

/** Metadata for a single MCP tool exposed by an agent. */
export interface McpToolMetadata {
	/** Tool name. */
	name: string;
	/** Human-readable description. */
	description?: string;
	/** Whether invoking the tool requires authentication. */
	auth_required?: boolean;
	/** Per-tool pricing. */
	pricing?: PricingDescriptor;
}

/** MCP server metadata descriptor attached to an agent. */
export interface McpMetadata {
	/** MCP endpoint URL. */
	endpoint?: string;
	/** MCP transport. */
	transport?: 'streamable-http' | 'sse' | 'stdio';
	/** MCP endpoint authentication scheme. */
	authentication?: 'none' | 'bearer' | 'oauth2' | 'api_key' | 'custom';
	/** Tool-level metadata. */
	tools?: McpToolMetadata[];
}

/** Trust badge tier identifiers (GET /trust/badges). */
export type TrustBadgeTier = 'none' | 'bronze' | 'silver' | 'gold';

/** Computed trust badge with gamification data. */
export interface TrustBadge {
	/** Badge tier. */
	tier: TrustBadgeTier;
	/** The agent's reputation score. */
	reputation: number;
	/** Human-readable tier label. */
	label: string;
	/** Emoji for the badge tier. */
	emoji: string;
	/** Requirements that are currently satisfied. */
	requirements_met: string[];
	/** Next tier to aim for, or null if already at the top tier. */
	next_tier: TrustBadgeTier | null;
	/** Gap to the next tier threshold, or null if already at the top tier. */
	next_tier_gap: number | null;
	[key: string]: unknown;
}

/** A single agent's badge entry as served by GET /trust/badges. */
export interface TrustBadgeEntry {
	agent_id: string;
	badge: TrustBadge;
	/** Point-in-time reputation snapshot used for badge computation. */
	reputation_snapshot?: Record<string, unknown>;
	[key: string]: unknown;
}

/** Response from GET /trust/badges. */
export interface TrustBadgeResponse {
	/** Badge entries (filtered by `?agent=` when requested). */
	agents: TrustBadgeEntry[];
	/** Number of entries in `agents`. */
	total: number;
	/** Badge tier distribution across all agents (unfiltered). */
	badge_distribution?: Partial<Record<TrustBadgeTier, number>>;
	/** ISO timestamp of the response. */
	fetchedAt?: string;
	[key: string]: unknown;
}

// ── Compatibility Types: Switchboard / Payments ───────────────────────

export type ProtocolType = 'a2a' | 'mcp' | 'https' | 'nlweb' | 'openapi' | 'grpc' | (string & {});

export interface DetectedProtocol {
	type: ProtocolType;
	url?: string;
	confidence?: number;
	metadata?: Record<string, unknown>;
}

export interface SwitchboardLookupResult {
	agent_id: string;
	protocols: DetectedProtocol[];
	endpoints?: ResolvedEndpoint[];
	adapter?: string;
	metadata?: Record<string, unknown>;
}

export interface SwitchboardDiscoverRequest {
	agent_id?: string;
	url?: string;
	preferred_protocol?: ProtocolType;
	metadata?: Record<string, unknown>;
}

export type SwitchboardExportFormat = 'agent-card' | 'nanda-index' | 'oasf' | (string & {});

export interface SwitchboardExportRequest {
	format?: SwitchboardExportFormat;
	agent_ids?: string[];
	protocol?: ProtocolType;
}

export interface SwitchboardExportResponse {
	format: string;
	exported_at: string;
	data: unknown;
}

export interface SwitchboardResyncRequest {
	agent_id?: string;
	force?: boolean;
}

export interface SwitchboardResyncResponse {
	ok: boolean;
	resynced: number;
	errors?: Array<{ agent_id?: string; message: string }>;
}

export interface ProtocolAdapterRecord {
	id: string;
	protocol: ProtocolType;
	name: string;
	version?: string;
	enabled?: boolean;
	metadata?: Record<string, unknown>;
}

export interface AdapterInfo {
	protocol: ProtocolType;
	name: string;
	version?: string;
	capabilities?: string[];
}

export interface SwitchboardAdaptersResponse {
	adapters: AdapterInfo[];
}

export interface CurrencyDefinition {
	code: string;
	name?: string;
	symbol?: string;
	decimals?: number;
	network?: string;
	metadata?: Record<string, unknown>;
}

export interface ExchangeRate {
	from: string;
	to: string;
	rate: number;
	asOf?: string;
	source?: string;
}

export interface ConvertCurrencyRequest {
	from: string;
	to: string;
	amount: number;
}

export interface ConvertCurrencyResponse extends ConvertCurrencyRequest {
	rate: number;
	convertedAmount: number;
	asOf?: string;
}

export interface WalletBalancesResponse {
	wallet?: string;
	agent_id?: string;
	balances: Array<{ currency: string; amount: number }> | Record<string, number>;
}

export interface ExchangeRateMatrixResponse {
	base?: string;
	rates: Record<string, number | Record<string, number>>;
	asOf?: string;
}

export interface CurrenciesResponse {
	currencies: CurrencyDefinition[];
}
