import { RemixAIGraphState, getAgentOutputText } from '../graph/stateSchema';

/**
 * Response Builder Node
 * Builds the final response to return to the user
 * This is the terminal node in the graph
 */
export function createResponseBuilderNode() {
  return async (state: RemixAIGraphState): Promise<Partial<RemixAIGraphState>> => {
    console.log('[ResponseBuilderNode] Building final response...');

    try {
      // If there's an error, return error as final response
      if (state.error) {
        console.log('[ResponseBuilderNode] Returning error response');
        return {
          finalResponse: `Error: ${state.error}`
        };
      }

      // If we have agent output, use it as the final response
      if (state.agentOutput) {
        const response = getAgentOutputText(state);
        console.log(`[ResponseBuilderNode] Final response ready (${response.length} chars)`);
        return {
          finalResponse: response
        };
      }

      // Fallback: try to get response from last message
      if (state.messages.length > 0) {
        const lastMessage = state.messages[state.messages.length - 1];
        const content = typeof lastMessage.content === 'string'
          ? lastMessage.content
          : JSON.stringify(lastMessage.content);

        console.log('[ResponseBuilderNode] Using last message as response');
        return {
          finalResponse: content
        };
      }

      // If we reach here, something went wrong
      console.warn('[ResponseBuilderNode] No output available to build response');
      return {
        finalResponse: 'No response generated. Please try again.'
      };
    } catch (error) {
      console.error('[ResponseBuilderNode] Error building response:', error);

      return {
        finalResponse: `Error building response: ${error.message || String(error)}`
      };
    }
  };
}
