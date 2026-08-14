// SPDX-License-Identifier: Apache-2.0
/**
 * Example — Create and run a DAG-based multi-agent workflow.
 *
 * Demonstrates:
 *   1. `client.orchestration.createWorkflow` — define a DAG of agent nodes + edges.
 *   2. `client.orchestration.runWorkflow`    — execute the DAG with structured input.
 *   3. `client.orchestration.getWorkflowStatus` — inspect run + step statuses.
 *   4. `client.orchestration.listWorkflows`  — enumerate workflows.
 *
 * Run:
 *   HOMEPORT_API_KEY=... npx tsx examples/orchestrate-workflow.ts
 *
 * Requires Node 20+, Bun, or Deno with `fetch`.
 */

import { HomeportClient } from '@nexartis/homeport-sdk';

const client = new HomeportClient({
	baseUrl: 'https://homeport.example.com',
	apiKey: process.env.HOMEPORT_API_KEY,
	verbose: true
});

async function main() {
	// 1. Define a DAG workflow
	const { workflow } = await client.orchestration.createWorkflow({
		name: 'Code Review Pipeline',
		description: 'Automated code review with security scan',
		owner_id: 'orchestrator-1',
		dag: {
			nodes: [
				{ id: 'lint', type: 'agent', data: { agent_id: 'linter-agent', rules: 'strict' } },
				{ id: 'security', type: 'agent', data: { agent_id: 'security-scanner', level: 'high' } },
				{ id: 'review', type: 'agent', data: { agent_id: 'review-agent', depth: 'thorough' } }
			],
			edges: [
				{ source: 'lint', target: 'review' },
				{ source: 'security', target: 'review' }
			]
		}
	});
	console.log('✅ Workflow created:', workflow.id);

	// 2. Execute the workflow
	const run = await client.orchestration.runWorkflow(workflow.id, {
		repository: 'https://github.com/example/repo',
		branch: 'feature/new-api'
	});
	console.log('🚀 Workflow run started:', run);

	// 3. Check workflow status (returns { run, stepRuns })
	const status = await client.orchestration.getWorkflowStatus(run.run_id);
	console.log('📊 Status:', status.run.status);

	// 4. List all workflows
	const workflows = await client.orchestration.listWorkflows();
	console.log(`\n📋 Total workflows: ${workflows.workflows.length}`);
}

main().catch(console.error);

