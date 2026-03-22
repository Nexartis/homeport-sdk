/**
 * Example: Create and run a DAG-based workflow.
 *
 * Usage: npx tsx examples/orchestrate-workflow.ts
 */

import { NnnClient } from '../src/core';

const client = new NnnClient({
	baseUrl: 'https://nanda.nexartis.com',
	apiKey: process.env.NNN_API_KEY,
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

