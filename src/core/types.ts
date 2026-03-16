/**
 * NNN SDK — Type Definitions
 *
 * TypeScript contracts for the Nexartis NANDA Node REST + A2A API.
 * Portable — no framework dependencies.
 *
 * @module core/types
 */

// ── Client Configuration ────────────────────────────────────────────

export interface NnnConfig {
	/** NNN base URL (e.g. 'https://nanda.nexartis.com') */
	baseUrl: string;
	/** Bearer API key for authenticated endpoints */
	apiKey?: string;
	/** Enable debug logging */
	verbose?: boolean;
	/** Override default retry configuration */
	retryConfig?: NnnRetryConfig;
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

