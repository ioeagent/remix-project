import { RemixAIGraphState } from '../graph/stateSchema';
import { HumanMessage, AIMessage, SystemMessage, BaseMessage } from '@langchain/core/messages';
import { IParams, AIRequestType } from '../../types/types';
import { BaseChatModel, BaseChatModelCallOptions } from '@langchain/core/language_models/chat_models';
import { Runnable } from '@langchain/core/runnables';
import { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { ChatGeneration, ChatResult } from '@langchain/core/outputs';
import { RemoteInferencer } from '../../inferencers/remote/remoteInference';

/**
 * ProxyChatModel - Custom chat model that routes through Remix backend proxy
 * Uses RemoteInferencer methods for consistent authentication and error handling
 */
class ProxyChatModel extends BaseChatModel {
  remoteInferencer: RemoteInferencer;
  provider: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
  streaming: boolean;

  constructor(config: {
    remoteInferencer: RemoteInferencer;
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    streaming?: boolean;
  }) {
    super({});
    this.remoteInferencer = config.remoteInferencer;
    this.provider = config.provider;
    this.modelName = config.model;
    this.temperature = config.temperature ?? 0.7;
    this.maxTokens = config.maxTokens ?? 4096;
    this.streaming = false;
  }

  _llmType(): string {
    return 'proxy';
  }

  async _generate(
    messages: BaseMessage[],
    options: this['ParsedCallOptions'],
    runManager?: CallbackManagerForLLMRun
  ): Promise<ChatResult> {
    console.log('[ProxyChatModel] Using RemoteInferencer for LLM request');
    console.log('[ProxyChatModel] Provider:', this.provider, 'Model:', this.modelName);
    console.log('[ProxyChatModel] Streaming:', this.streaming);

    try {
      // Convert LangChain messages to API format
      const formattedMessages = messages.map((m) => ({
        role: m._getType() === 'human' ? 'user' : m._getType() === 'system' ? 'system' : 'assistant',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      }));

      // Include tools if bound
      const tools = (options as any).tools || [];

      // Build payload for RemoteInferencer
      const payload = {
        model: this.modelName,
        messages: formattedMessages,
        provider: this.provider,
        temperature: this.temperature,
        max_tokens: this.maxTokens,
        stream: this.streaming,
        endpoint: 'answer',
        ...(tools.length > 0 && { tools: tools })
      };

      let result: any;

      if (this.streaming) {
        console.log('[ProxyChatModel] Using streaming mode');

        // Setup event listener for streaming chunks
        const streamHandler = (chunk: string) => {
          console.log('[ProxyChatModel] Received chunk:', chunk.substring(0, 50) + '...');
          if (runManager) {
            runManager.handleLLMNewToken(chunk);
          }
        };

        this.remoteInferencer.event.on('onStreamResult', streamHandler);

        try {
          // Use RemoteInferencer's _streamInferenceRequest
          result = await (this.remoteInferencer as any)._streamInferenceRequest(
            payload,
            AIRequestType.GENERAL
          );
        } finally {
          // Remove event listener after streaming completes
          this.remoteInferencer.event.off('onStreamResult', streamHandler);
        }
      } else {
        console.log('[ProxyChatModel] Using non-streaming mode');

        // Use RemoteInferencer's _makeRequest (handles auth, errors, events)
        result = await (this.remoteInferencer as any)._makeRequest(payload, AIRequestType.GENERAL);
      }

      console.log('[ProxyChatModel] Response received');

      // Parse the result - RemoteInferencer returns the generatedText or full response
      let data: any;
      if (typeof result === 'string') {
        // If it's a string, try to parse as JSON or use as-is
        try {
          data = JSON.parse(result);
        } catch {
          // If not JSON, treat as plain text response
          data = { content: result };
        }
      } else {
        data = result;
      }

      // Extract content and tool calls from response
      const content = data.choices?.[0]?.message?.content || data.content || data.generatedText || String(result);
      const toolCalls = data.choices?.[0]?.message?.tool_calls || data.tool_calls || [];

      // Create AIMessage with tool calls
      const aiMessage = new AIMessage({
        content,
        additional_kwargs: {
          tool_calls: toolCalls
        }
      });

      // Set tool_calls property for LangChain compatibility
      if (toolCalls.length > 0) {
        (aiMessage as any).tool_calls = toolCalls.map((tc: any) => ({
          name: tc.function?.name || tc.name,
          args: typeof tc.function?.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function?.arguments || tc.args || {},
          id: tc.id || `tool_${Date.now()}_${Math.random()}`
        }));
      }

      const generation: ChatGeneration = {
        message: aiMessage,
        text: content
      };

      return {
        generations: [generation],
        llmOutput: data
      };
    } catch (error) {
      console.error('[ProxyChatModel] Error:', error);
      throw error;
    }
  }
}

/**
 * Agent Node
 * Invokes the LLM with tools bound to generate responses or tool calls
 * This is the core LLM interaction node in the graph
 */
export function createAgentNode(params: IParams) {
  return async (state: RemixAIGraphState): Promise<Partial<RemixAIGraphState>> => {
    console.log('[AgentNode] Invoking LLM agent...');
    console.log('[AgentNode] Provider:', params.provider);
    console.log('[AgentNode] Model:', params.model);
    console.log('[AgentNode] Tools available:', state.availableTools.length);

    try {
      // Build system message
      const systemMessage = new SystemMessage(
        'You are RemixAI, an AI assistant for Remix IDE helping with smart contract development, ' +
        'Solidity programming, debugging, testing, and deployment. You have access to various tools ' +
        'to interact with the IDE and blockchain. Use tools when needed to answer user questions accurately.'
      );

      // Build user message with context if available
      let userMessageContent = state.userPrompt;
      if (state.mcpResourceContext) {
        userMessageContent = `Context:\n${state.mcpResourceContext}\n\nUser: ${state.userPrompt}`;
      }

      const userMessage = new HumanMessage(userMessageContent);

      // Build messages array (system + history + current user message)
      const messages = [
        systemMessage,
        ...state.messages,
        userMessage
      ];

      // Create RemoteInferencer instance for making requests
      const remoteInferencer = new RemoteInferencer();
      console.log('[AgentNode] Using RemoteInferencer with endpoint:', remoteInferencer.api_url);

      // Determine model name based on provider
      let modelName = params.model;
      if (!modelName) {
        // Default models per provider
        switch (params.provider) {
          case 'anthropic':
            modelName = 'claude-3-5-sonnet-20241022';
            break;
          case 'openai':
            modelName = 'gpt-4';
            break;
          case 'mistralai':
            modelName = 'mistral-large-latest';
            break;
          default:
            modelName = 'claude-3-5-sonnet-20241022'; // Default fallback
        }
      }

      // Create proxy chat model with RemoteInferencer
      const llm: BaseChatModel = new ProxyChatModel({
        remoteInferencer,
        provider: params.provider || 'anthropic',
        model: modelName,
        temperature: params.temperature !== undefined ? params.temperature : 0.7,
        maxTokens: params.max_tokens || 4096,
        streaming: params.stream_result || false
      });

      // Bind tools to the LLM if available
      let llmWithTools: BaseChatModel | Runnable = llm;
      if (state.availableTools.length > 0) {
        try {
          // Check if bindTools method exists
          if (typeof llm.bindTools === 'function') {
            llmWithTools = llm.bindTools(state.availableTools);
            console.log('[AgentNode] Bound', state.availableTools.length, 'tools to LLM');
          } else {
            console.warn('[AgentNode] LLM does not support tool binding, proceeding without tools');
          }
        } catch (error) {
          console.warn('[AgentNode] Failed to bind tools:', error);
        }
      }

      console.log('[AgentNode] Invoking LLM with', messages.length, 'messages...');

      // Invoke LLM
      const response = await llmWithTools.invoke(messages);

      console.log('[AgentNode] LLM response received');
      console.log('[AgentNode] Response type:', typeof response.content);
      console.log('[AgentNode] Tool calls:', response.tool_calls?.length || 0);

      // Extract tool calls if any
      const toolCalls = response.tool_calls || [];

      // Convert tool_calls to the format expected by our state
      const formattedToolCalls = toolCalls.map((tc: any) => ({
        id: tc.id || `tool_${Date.now()}_${Math.random()}`,
        type: tc.type || 'function',
        function: {
          name: tc.name,
          arguments: typeof tc.args === 'string' ? tc.args : JSON.stringify(tc.args || {})
        }
      }));

      // Extract content as string
      const contentString = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      return {
        agentOutput: contentString,
        toolCalls: formattedToolCalls,
        messages: [...state.messages, userMessage, response as AIMessage],
        currentAgent: `langchain_${params.provider}`
      };
    } catch (error) {
      console.error('[AgentNode] Error invoking agent:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        error: `Agent invocation failed: ${errorMessage}`,
        agentOutput: null
      };
    }
  };
}

