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

