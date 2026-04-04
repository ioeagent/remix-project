import { MCPClient } from '../../inferencers/mcp/mcpClient';
import { IMCPResource, IUserIntent } from '../../types/mcp';
import { ResourceScoring } from '../../services/resourceScoring';

/**
 * Service for fetching MCP resources directly without using MCPInferencer legacy methods
 * This is part of the LangGraph-native implementation
 */
export class MCPResourceFetcher {
  private resourceScoring: ResourceScoring;

  constructor(private mcpClients: Map<string, MCPClient>) {
    this.resourceScoring = new ResourceScoring();
  }

  /**
   * Fetch relevant MCP resources based on user prompt and intent
   * @param prompt User's prompt/question
   * @param intent Analyzed user intent
   * @param maxResources Maximum number of resources to return
   * @returns Formatted context string with resource content
   */
  async fetchRelevantResources(
    prompt: string,
    intent: IUserIntent,
    maxResources: number = 10
  ): Promise<string> {
    try {
      const resources: Array<{ resource: IMCPResource; serverName: string }> = [];

      // Get resources from all connected MCP servers
      for (const [serverName, client] of this.mcpClients) {
        if (!client.isConnected()) {
          console.log(`[MCPResourceFetcher] Skipping disconnected server: ${serverName}`);
          continue;
        }

        try {
          const serverResources = await client.listResources();
          serverResources.forEach(resource => {
            resources.push({ resource, serverName });
          });
          console.log(`[MCPResourceFetcher] Found ${serverResources.length} resources from ${serverName}`);
        } catch (error) {
          console.warn(`[MCPResourceFetcher] Failed to list resources from ${serverName}:`, error);
        }
      }

      if (resources.length === 0) {
        console.log('[MCPResourceFetcher] No resources found from any MCP server');
        return '';
      }

      // Score and rank resources using ResourceScoring service
      const scoredResources = await this.resourceScoring.scoreResources(
        resources,
        intent,
        {
          maxResources,
          enableIntentMatching: true,
          selectionStrategy: 'hybrid',
          relevanceThreshold: 0.20
        }
      );

      // Select best resources
      const selectedResources = this.resourceScoring.selectResources(
        scoredResources,
        maxResources,
        'hybrid'
      );

      console.log(`[MCPResourceFetcher] Selected ${selectedResources.length} resources from ${resources.length} total`);

      if (selectedResources.length === 0) {
        return '';
      }

      // Always add IDE context for internal Remix MCP server if available
      const hasInternalServer = this.mcpClients.has('Remix IDE Server');
      if (hasInternalServer) {
        const contextResource: IMCPResource = {
          uri: 'context://workspace',
          name: 'Workspace Context',
          description: 'Complete IDE context including files, editor state, git status, and diagnostics',
          mimeType: 'application/json',
        };

        const existingContext = selectedResources.find(r => r.resource.uri === 'context://workspace');
        if (!existingContext) {
          selectedResources.push({
            resource: contextResource,
            serverName: 'Remix IDE Server',
            score: 1.0,
            components: { keywordMatch: 1.0, domainRelevance: 1.0, typeRelevance: 1, priority: 1, freshness: 1 },
            reasoning: 'IDE context always included for internal remix MCP server'
          });
        }
      }

      // Sort resources from less relevant to most relevant (ascending by score) for context reduction
      const sortedResources = selectedResources.sort((a, b) => a.score - b.score);

      // Build context from selected resources
      let mcpContext = '';
      for (const scoredResource of sortedResources) {
        const { resource, serverName } = scoredResource;

        try {
          const client = this.mcpClients.get(serverName);
          if (!client) {
            console.warn(`[MCPResourceFetcher] Client not found for server: ${serverName}`);
            continue;
          }

          const content = await client.readResource(resource.uri);

          if (content?.text) {
            mcpContext += `\n--- Resource: ${resource.name} (Score: ${Math.round(scoredResource.score * 100)}%) ---\n`;
            mcpContext += `Relevance: ${scoredResource.reasoning}\n`;
            mcpContext += content.text;
            mcpContext += '\n--- End Resource ---\n';
          }
        } catch (error) {
          console.warn(`[MCPResourceFetcher] Failed to read resource ${resource.uri}:`, error);
        }
      }

      return mcpContext;
    } catch (error) {
      console.error('[MCPResourceFetcher] Error fetching resources:', error);
      return '';
    }
  }

  /**
   * Get list of connected MCP server names
   */
  getConnectedServers(): string[] {
    const connected: string[] = [];
    for (const [serverName, client] of this.mcpClients) {
      if (client.isConnected()) {
        connected.push(serverName);
      }
    }
    return connected;
  }

  /**
   * Check if any MCP servers are connected
   */
  hasConnectedServers(): boolean {
    return this.getConnectedServers().length > 0;
  }
}
