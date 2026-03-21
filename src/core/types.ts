/**
 * NNN SDK — Type Definitions
 *
 * TypeScript contracts for the Nexartis NANDA Node REST + A2A API.
 * Portable — no framework dependencies.
 *
 * @module core/types
 */

// ── Client Configuration ────────────────────────────────────────────

/** Lifecycle hooks for request/response interception. */
export interface NnnHooks {
	/** Called before every request. Can modify headers or URL. */
	beforeRequest?: (url: string, init: RequestInit) => void | Promise<void>;
	/** Called after every successful response. */
	afterResponse?: (url: string, response: Response, durationMs: number) => void | Promise<void>;
	/** Called on request failure (after retries exhausted). */
	onError?: (url: string, error: unknown) => void | Promise<void>;
}

/** Circuit breaker configuration. */
export interface NnnCircuitBreakerConfig {
	/** Number of consecutive failures before tripping the circuit. Default: 5. */
	failureThreshold?: number;
	/** Cooldown period in ms before allowing a probe request. Default: 30000. */
	cooldownMs?: number;
}

export interface NnnConfig {
	/** NNN base URL (e.g. 'https://nanda.nexartis.com') */
	baseUrl: string;
	/** Bearer API key for authenticated endpoints */
	apiKey?: string;
	/** Enable debug logging */
	verbose?: boolean;
	/** Override default retry configuration */
	retryConfig?: NnnRetryConfig;
	/** Request/response lifecycle hooks */
	hooks?: NnnHooks;
	/** Circuit breaker configuration. Pass `false` to disable. */
	circuitBreaker?: NnnCircuitBreakerConfig | false;
	/** OpenTelemetry trace context to propagate. */
	traceContext?: { traceparent?: string; tracestate?: string };
}

export interface NnnRetryConfig {
	maxRetries?: number;
	baseDelayMs?: number;
	maxDelayMs?: number;
	timeoutMs?: number;
}

// ── Health ───────────────────────────────────────────────────────────

export interface NnnHealthStatus {
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

export interface NnnAgent {
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
}

export interface RegisterAgentRequest {
	agent_id: string;
	agent_url: string;
	api_url?: string;
	facts_url?: string;
	capabilities?: string[];
	tags?: string[];
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

export interface NnnStats {
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
	ownerId: string;
	status: string;
	dagJson?: string;
	templateId?: string;
	metadata?: string;
	createdAt: string;
	updatedAt: string;
}

export interface WorkflowRunResult {
	runId: string;
	status: string;
	output?: Record<string, unknown>;
	stepResults: Array<{
		stepId: string;
		status: string;
		output?: string | null;
		error?: string | null;
		durationMs?: number | null;
	}>;
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
	targetAgent: NnnAgent;
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
}

export interface AgentRefreshResult {
	status: string;
	message: string;
	agent?: NnnAgent;
}

// ── Workflow Execution & Monitoring ─────────────────────────────

export interface WorkflowRunStatus {
	workflowId: string;
	runId: string;
	status: string;
	startedAt?: string;
	completedAt?: string;
	stepResults?: Array<{
		stepId: string;
		status: string;
		output?: string | null;
		error?: string | null;
		durationMs?: number | null;
	}>;
}

// ── NANDA Index Sync ────────────────────────────────────────────

export interface IndexDiffResult {
	since: string;
	added: NnnAgent[];
	removed: string[];
	updated: NnnAgent[];
}

export type IndexChangeCallback = (event: IndexChangeEvent) => void;

export interface IndexChangeEvent {
	type: 'added' | 'removed' | 'updated';
	agent: NnnAgent;
	timestamp: string;
}

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