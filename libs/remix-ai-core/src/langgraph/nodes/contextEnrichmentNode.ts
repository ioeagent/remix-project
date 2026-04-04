import { RemixAIGraphState } from '../graph/stateSchema';
import { MCPResourceFetcher } from '../services/mcpResourceFetcher';

/**
 * Context Enrichment Node
 * Fetches relevant MCP resources based on user intent and prompt
 * This enriches the context that will be sent to the LLM
 */
export function createContextEnrichmentNode(
  mcpResourceFetcher: MCPResourceFetcher,
  maxResources: number = 10
) {
  return async (state: RemixAIGraphState): Promise<Partial<RemixAIGraphState>> => {
    console.log('[ContextEnrichmentNode] Fetching relevant MCP resources...');

    try {
      // Check if we have any connected MCP servers
      if (!mcpResourceFetcher.hasConnectedServers()) {
        console.log('[ContextEnrichmentNode] No connected MCP servers, skipping resource fetch');
        return {
          mcpResourceContext: ''
        };
      }

      // Ensure we have intent analysis
      if (!state.intent) {
        console.warn('[ContextEnrichmentNode] No intent analysis available, skipping resource fetch');
        return {
          mcpResourceContext: ''
        };
      }

      // Fetch resources using MCPResourceFetcher
      const mcpResourceContext = await mcpResourceFetcher.fetchRelevantResources(
        state.userPrompt,
        state.intent.intent,
        maxResources
      );

      if (mcpResourceContext) {
        console.log(`[ContextEnrichmentNode] Fetched context (${mcpResourceContext.length} chars)`);
      } else {
        console.log('[ContextEnrichmentNode] No relevant resources found');
      }

      return {
        mcpResourceContext
      };
    } catch (error) {
      console.error('[ContextEnrichmentNode] Error fetching resources:', error);

      // Return empty context on error (don't fail the graph)
      return {
        mcpResourceContext: ''
      };
    }
  };
}
