import { RemixAIGraphState } from '../graph/stateSchema';
import { ToolMessage } from '@langchain/core/messages';

/**
 * Tool Executor Node
 * Executes tools requested by the LLM and adds results to message history
 * Uses LangChain's native tool execution (tools already have their func defined)
 */
export function createToolExecutorNode() {
  return async (state: RemixAIGraphState): Promise<Partial<RemixAIGraphState>> => {
    console.log('[ToolExecutorNode] Executing tools...');

    // If no tool calls, return immediately
    if (!state.toolCalls || state.toolCalls.length === 0) {
      console.log('[ToolExecutorNode] No tool calls to execute');
      return {
        iterationCount: state.iterationCount
      };
    }

    console.log(`[ToolExecutorNode] Executing ${state.toolCalls.length} tool(s)`);

    const newMessages = [...state.messages];

    // Execute each tool call
    for (const toolCall of state.toolCalls) {
      try {
        console.log(`[ToolExecutorNode] Executing tool: ${toolCall.function.name}`);

        // Find the tool in available tools
        const tool = state.availableTools.find(t => t.name === toolCall.function.name);

        if (!tool) {
          console.warn(`[ToolExecutorNode] Tool not found: ${toolCall.function.name}`);

          // Add error message to history
          const errorMessage = new ToolMessage({
            tool_call_id: toolCall.id,
            content: `Error: Tool '${toolCall.function.name}' not found in available tools`,
            additional_kwargs: { isError: true }
          });

          newMessages.push(errorMessage);
          continue;
        }

        // Parse tool arguments
        let args: any = {};
        if (typeof toolCall.function.arguments === 'string') {
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch (error) {
            console.warn(`[ToolExecutorNode] Failed to parse tool arguments:`, error);
            args = {};
          }
        } else {
          args = toolCall.function.arguments || {};
        }

        console.log(`[ToolExecutorNode] Tool arguments:`, JSON.stringify(args).substring(0, 200));

        // Execute the tool using its bound func
        const result = await tool.invoke(args);

        console.log(`[ToolExecutorNode] Tool execution completed for ${toolCall.function.name}`);

        // Add tool result to messages
        const toolMessage = new ToolMessage({
          tool_call_id: toolCall.id,
          content: typeof result === 'string' ? result : JSON.stringify(result),
          additional_kwargs: { toolName: toolCall.function.name }
        });

        newMessages.push(toolMessage);
      } catch (error) {
        console.error(`[ToolExecutorNode] Tool execution error for ${toolCall.function.name}:`, error);

        // Add error message to history
        const errorMessage = new ToolMessage({
          tool_call_id: toolCall.id,
          content: `Error executing tool: ${error.message || String(error)}`,
          additional_kwargs: { isError: true }
        });

        newMessages.push(errorMessage);
      }
    }

    // Clear tool calls and increment iteration count
    return {
      toolCalls: [],
      messages: newMessages,
      iterationCount: state.iterationCount + 1
    };
  };
}
