import { RemixAIGraphState } from '../graph/stateSchema';
import { MCPToolConverter } from '../services/mcpToolConverter';
import { WeightedToolSelector } from '../../services/weightedToolSelector';
import { BaseMessage } from '@langchain/core/messages';

/**
 * Tool Preparation Node
 * Selects relevant tools from all available MCP tools based on prompt and intent
 * Uses WeightedToolSelector for intelligent tool selection
 */
export function createToolPreparationNode(
  mcpToolConverter: MCPToolConverter,
  toolSelector: WeightedToolSelector,
  maxTools: number = 25
) {
  return async (state: RemixAIGraphState): Promise<Partial<RemixAIGraphState>> => {
    console.log('[ToolPreparationNode] Preparing tools for agent...');

    try {
      // Get all available MCP tools (converted to LangChain format)
      const allTools = await mcpToolConverter.getAllTools();

      if (allTools.length === 0) {
        console.log('[ToolPreparationNode] No tools available from MCP servers');
        return {
          availableTools: []
        };
      }

      console.log(`[ToolPreparationNode] Found ${allTools.length} total tools`);

      // Convert LangChain tools to IMCPTool format for selector
      // (WeightedToolSelector expects IMCPTool)
      const mcpTools = allTools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }));

      // Convert LangChain messages to IChatMessage format for selector
      const chatHistory = state.messages.map((msg: BaseMessage) => ({
        role: msg._getType(),
        content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)
      }));

      // Use WeightedToolSelector to pick relevant tools
      const selectedMCPTools = toolSelector.selectTools(
        mcpTools,
        state.userPrompt,
        maxTools,
        chatHistory
      );

      console.log(`[ToolPreparationNode] Selected ${selectedMCPTools.length} tools (max: ${maxTools})`);

      // Filter allTools to only include selected tools
      const selectedToolNames = new Set(selectedMCPTools.map(t => t.name));
      const availableTools = allTools.filter(tool => selectedToolNames.has(tool.name));

      // Log selected tool names for debugging
      console.log('[ToolPreparationNode] Selected tools:', availableTools.map(t => t.name).join(', '));

      return {
        availableTools
      };
    } catch (error) {
      console.error('[ToolPreparationNode] Error preparing tools:', error);

      // Return empty tools array on error (don't fail the graph)
      return {
        availableTools: []
      };
    }
  };
}
