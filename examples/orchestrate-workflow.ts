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
	const workflow = await client.orchestration.createWorkflow({
		name: 'Code Review Pipeline',
		description: 'Automated code review with security scan',
		dag: {
			nodes: [
				{ id: 'lint', agentId: 'linter-agent', config: { rules: 'strict' } },
				{ id: 'security', agentId: 'security-scanner', config: { level: 'high' } },
				{ id: 'review', agentId: 'review-agent', config: { depth: 'thorough' } }
			],
			edges: [
				{ from: 'lint', to: 'review' },
				{ from: 'security', to: 'review' }
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

	// 3. Check workflow status
	const status = await client.orchestration.getWorkflowStatus(run.runId);
	console.log('📊 Status:', status.status);

	// 4. List all workflows
	const workflows = await client.orchestration.listWorkflows();
	console.log(`\n📋 Total workflows: ${workflows.workflows.length}`);
}

main().catch(console.error);

