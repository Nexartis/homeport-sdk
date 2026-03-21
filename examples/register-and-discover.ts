/**
 * Example: Register an agent and discover others via the NANDA registry.
 *
 * Usage: npx tsx examples/register-and-discover.ts
 */

import { NnnClient } from '../src/core';

const client = new NnnClient({
	baseUrl: 'https://nanda.nexartis.com',
	apiKey: process.env.NNN_API_KEY,
	verbose: true
});

async function main() {
	// 1. Register a new agent
	const registered = await client.registerAgent({
		agent_id: 'my-code-review-agent',
		agent_url: 'https://my-agent.example.com',
		capabilities: ['code-review', 'security-audit'],
		tags: ['typescript', 'security'],
		trust_score: 0.9
	});
	console.log('✅ Registered:', registered.agent_id);

	// 2. Search for agents with specific capabilities
	const reviewers = await client.searchAgents({
		capabilities: ['code-review'],
		min_trust: 0.8
	});
	console.log(`🔍 Found ${reviewers.length} code-review agents`);

	// 3. Auto-paginate through all matching agents
	console.log('\n📄 All matching agents (paginated):');
	for await (const agent of client.searchAgentsAll({ q: 'code-review', limit: 10 })) {
		console.log(`  - ${agent.agent_id}`);
	}

	// 4. Lookup a specific agent
	const agent = await client.lookupAgent('my-code-review-agent');
	console.log('\n📋 Agent details:', JSON.stringify(agent, null, 2));

	// 5. List all registered agents
	const all = await client.listAgents();
	console.log(`\n📊 Total registered agents: ${all.length}`);
}

main().catch(console.error);

