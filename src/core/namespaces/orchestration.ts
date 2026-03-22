/**
 * NNN SDK — Orchestration Namespace
 *
 * Accessed via `client.orchestration.*`.
 * Covers workflows, runs, delegation, patterns, conflicts, routing, and index sync.
 *
 * @module core/namespaces/orchestration
 */

import type { NnnClientInternals } from '../namespace-helpers.js';
import type {
	CreateWorkflowRequest,
	WorkflowRecord,
	WorkflowRunResult,
	WorkflowDetail,
	UpdateWorkflowRequest,
	DelegateTaskRequest,
	DelegationResult,
	ListPatternsOptions,
	OrchestratorPattern,
	CreatePatternRequest,
	ListConflictsParams,
	OrchestrationConflict,
	RaiseConflictRequest,
	ConflictOutcome,
	RouteRequestParams,
	RoutingResult,
	WorkflowRunStatus,
	WorkflowRun,
	IndexDiffResult,
	IndexChangeCallback,
	IndexChangeEvent,
	NnnStats
} from '../types.js';
import { NnnError, NnnErrorCode } from '../errors.js';
import { parseSSEStream } from '../sse.js';

export class OrchestrationNamespace {
	/** @internal */
	constructor(private readonly _client: NnnClientInternals) {}

	// ── Stats ────────────────────────────────────────────────────

	/** GET /stats — Get registry statistics. */
	async stats(): Promise<NnnStats> {
		return this._client.getJson('/stats', 'orchestration.stats');
	}

	// ── Workflows ───────────────────────────────────────────────

	/** POST /api/orchestration — Create a workflow with a DAG. */
	async createWorkflow(req: CreateWorkflowRequest): Promise<{ status: string; workflow: WorkflowRecord }> {
		this._client.logger.debug('Creating workflow', { name: req.name });
		return this._client.postJson('/api/orchestration', req, 'orchestration.createWorkflow');
	}

	/** GET /api/orchestration?owner_id=&status= — List workflows. */
	async listWorkflows(params: { ownerId?: string; status?: string } = {}): Promise<{ workflows: WorkflowRecord[] }> {
		const sp = new URLSearchParams();
		if (params.ownerId) sp.set('owner_id', params.ownerId);
		if (params.status) sp.set('status', params.status);
		const qs = sp.toString();
		return this._client.getJson(`/api/orchestration${qs ? `?${qs}` : ''}`, 'orchestration.listWorkflows');
	}

	/** GET /api/orchestration/:id — Get a single workflow by ID. */
	async getWorkflow(workflowId: string): Promise<WorkflowDetail> {
		return this._client.getJson(`/api/orchestration/${encodeURIComponent(workflowId)}`, 'orchestration.getWorkflow');
	}

	/** PATCH /api/orchestration/:id — Update a workflow. */
	async updateWorkflow(workflowId: string, updates: UpdateWorkflowRequest): Promise<{ ok: boolean; workflow: WorkflowRecord }> {
		this._client.logger.debug('Updating workflow', { workflowId });
		return this._client.patchJson(`/api/orchestration/${encodeURIComponent(workflowId)}`, updates, 'orchestration.updateWorkflow');
	}

	/** DELETE /api/orchestration/:id — Delete a workflow. */
	async deleteWorkflow(workflowId: string): Promise<{ ok: boolean; deleted: string }> {
		this._client.logger.debug('Deleting workflow', { workflowId });
		return this._client.deleteJson(`/api/orchestration/${encodeURIComponent(workflowId)}`, 'orchestration.deleteWorkflow');
	}

	/** POST /api/orchestration/:id/runs — Start a new workflow run. */
	async runWorkflow(workflowId: string, input?: Record<string, unknown>): Promise<WorkflowRunResult> {
		this._client.logger.debug('Running workflow', { workflowId });
		return this._client.postJson(
			`/api/orchestration/${encodeURIComponent(workflowId)}/runs`, input ?? {}, 'orchestration.runWorkflow'
		);
	}

	/** GET /api/orchestration/:id/runs — List runs for a workflow. */
	async listWorkflowRuns(workflowId: string, limit = 20): Promise<{ runs: WorkflowRun[] }> {
		const sp = new URLSearchParams({ limit: String(Math.max(1, Math.min(limit, 100))) });
		return this._client.getJson(
			`/api/orchestration/${encodeURIComponent(workflowId)}/runs?${sp.toString()}`, 'orchestration.listWorkflowRuns'
		);
	}

	// ── Runs ────────────────────────────────────────────────────

	/** GET /api/orchestration/runs/:runId — Get workflow run status. */
	async getWorkflowStatus(runId: string): Promise<WorkflowRunStatus> {
		return this._client.getJson(`/api/orchestration/runs/${encodeURIComponent(runId)}`, 'orchestration.getWorkflowStatus');
	}

	/** POST /api/orchestration/runs/:runId/cancel — Cancel an in-progress run. */
	async cancelWorkflowRun(runId: string): Promise<{ status: string; run_id: string }> {
		this._client.logger.debug('Cancelling workflow run', { runId });
		return this._client.postJson(
			`/api/orchestration/runs/${encodeURIComponent(runId)}/cancel`, {}, 'orchestration.cancelWorkflowRun'
		);
	}

	/** SSE stream for real-time workflow execution events. */
	async *streamWorkflowEvents(runId: string): AsyncGenerator<Record<string, unknown>, void, unknown> {
		const url = `${this._client.baseUrl}/api/orchestration/runs/${encodeURIComponent(runId)}/events`;
		const headers = { ...this._client.headers(), Accept: 'text/event-stream' };
		const res = await this._client.fetch(url, { headers }, 'orchestration.streamWorkflowEvents');
		if (!res.body) {
			throw new NnnError(NnnErrorCode.NETWORK_ERROR, 'streamWorkflowEvents: response body is null');
		}
		yield* parseSSEStream(res.body, this._client.logger);
	}

	// ── Delegation ──────────────────────────────────────────────

	/** POST /api/orchestration/delegate — Delegate a task to an agent. */
	async delegateTask(params: DelegateTaskRequest): Promise<DelegationResult> {
		this._client.logger.debug('Delegating task', { action: params.action, delegator: params.delegator_id });
		return this._client.postJson('/api/orchestration/delegate', params, 'orchestration.delegateTask');
	}

	/** GET /api/orchestration/delegate?workflow_id= — List delegations for a workflow. */
	async listDelegations(workflowId: string): Promise<{ delegations: DelegationResult[] }> {
		const sp = new URLSearchParams({ workflow_id: workflowId });
		return this._client.getJson(`/api/orchestration/delegate?${sp.toString()}`, 'orchestration.listDelegations');
	}

	// ── Patterns ────────────────────────────────────────────────

	/** GET /api/orchestration/patterns — List orchestration patterns. */
	async listPatterns(options: ListPatternsOptions = {}): Promise<{ patterns: OrchestratorPattern[] }> {
		const sp = new URLSearchParams();
		if (options.category) sp.set('category', options.category);
		if (options.builtin !== undefined) sp.set('builtin', String(options.builtin));
		const qs = sp.toString();
		return this._client.getJson(`/api/orchestration/patterns${qs ? `?${qs}` : ''}`, 'orchestration.listPatterns');
	}

	/** POST /api/orchestration/patterns — Create a new orchestration pattern. */
	async createPattern(params: CreatePatternRequest): Promise<{ status: string; pattern: OrchestratorPattern }> {
		this._client.logger.debug('Creating pattern', { name: params.name });
		return this._client.postJson('/api/orchestration/patterns', params, 'orchestration.createPattern');
	}

	// ── Conflicts ───────────────────────────────────────────────

	/** GET /api/orchestration/conflicts — List orchestration conflicts. */
	async listConflicts(params: ListConflictsParams = {}): Promise<{ conflicts: OrchestrationConflict[]; total: number }> {
		const sp = new URLSearchParams();
		if (params.workflow_id) sp.set('workflow_id', params.workflow_id);
		if (params.run_id) sp.set('run_id', params.run_id);
		if (params.pending_only !== undefined) sp.set('pending_only', String(params.pending_only));
		const qs = sp.toString();
		return this._client.getJson(`/api/orchestration/conflicts${qs ? `?${qs}` : ''}`, 'orchestration.listConflicts');
	}

	/** POST /api/orchestration/conflicts — Raise and resolve a conflict. */
	async raiseConflict(params: RaiseConflictRequest): Promise<ConflictOutcome> {
		this._client.logger.debug('Raising conflict', { workflowId: params.workflow_id });
		return this._client.postJson('/api/orchestration/conflicts', params, 'orchestration.raiseConflict');
	}

	// ── Routing ─────────────────────────────────────────────────

	/** POST /api/orchestration/route — Route a request to the best-matching agent. */
	async routeRequest(params: RouteRequestParams): Promise<RoutingResult> {
		this._client.logger.debug('Routing request', { skill: params.skill, strategy: params.strategy });
		return this._client.postJson('/api/orchestration/route', params, 'orchestration.routeRequest');
	}

	// ── NANDA Index Sync ────────────────────────────────────────

	/** GET /.well-known/nanda-index/diff?since= — Get agents added/removed/updated since a timestamp. */
	async diffIndex(since: Date): Promise<IndexDiffResult> {
		const sp = new URLSearchParams({ since: since.toISOString() });
		return this._client.getJson(`/.well-known/nanda-index/diff?${sp.toString()}`, 'orchestration.diffIndex');
	}

	/** Poll-based index change subscription. Returns an abort function. */
	subscribeToIndex(callback: IndexChangeCallback, intervalMs = 30_000): () => void {
		let lastCheck = new Date();
		let stopped = false;

		const poll = async () => {
			while (!stopped) {
				try {
					const diff = await this.diffIndex(lastCheck);
					const now = new Date();
					for (const agent of diff.added) {
						await safeCallback(this._client.logger, callback, { type: 'added', agent, timestamp: now.toISOString() });
					}
					for (const agent of diff.updated) {
						await safeCallback(this._client.logger, callback, { type: 'updated', agent, timestamp: now.toISOString() });
					}
					for (const agentId of diff.removed) {
						await safeCallback(this._client.logger, callback, { type: 'removed', agentId, timestamp: now.toISOString() });
					}
					lastCheck = now;
				} catch (err) {
					this._client.logger.warn('Index sync poll failed', {
						error: err instanceof Error ? err.message : String(err)
					});
				}
				await new Promise((resolve) => setTimeout(resolve, intervalMs));
			}
		};

		poll();
		return () => { stopped = true; };
	}

}

/** Safely invoke a callback, catching and logging errors. */
async function safeCallback(
	logger: { warn: (msg: string, data?: Record<string, unknown>) => void },
	callback: IndexChangeCallback,
	event: IndexChangeEvent
): Promise<void> {
	try {
		await callback(event);
	} catch (err) {
		logger.warn('Index change callback threw', { error: err instanceof Error ? err.message : String(err) });
	}
}

