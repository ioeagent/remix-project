import { StateGraph, END, START } from '@langchain/langgraph';
import { MCPClient } from '../../inferencers/mcp/mcpClient';
import { IParams } from '../../types/types';
import {
  RemixAIGraphState,
  createInitialState,
  hasToolCalls,
  isMaxIterationsReached
} from './stateSchema';

// Services
import { MCPResourceFetcher } from '../services/mcpResourceFetcher';
import { MCPToolConverter } from '../services/mcpToolConverter';
import { IntentAnalyzer } from '../../services/intentAnalyzer';
import { WeightedToolSelector } from '../../services/weightedToolSelector';

// Nodes
import { createIntentRouterNode } from '../nodes/intentRouterNode';
import { createContextEnrichmentNode } from '../nodes/contextEnrichmentNode';
import { createToolPreparationNode } from '../nodes/toolPreparationNode';
import { createAgentNode } from '../nodes/agentNode';
import { createToolExecutorNode } from '../nodes/toolExecutorNode';
import { createResponseBuilderNode } from '../nodes/responseBuilderNode';

/**
 * RemixAI LangGraph Orchestrator
 * Assembles all nodes into a StateGraph for LangChain-native chat handling
 */
export class RemixAIGraph {
  private graph: any; // Compiled graph
  private mcpClients: Map<string, MCPClient>;
  private params: IParams;

  constructor(mcpClients: Map<string, MCPClient>, params: IParams) {
    this.mcpClients = mcpClients;
    this.params = params;
    this.graph = this.buildGraph(params);
  }

  /**
   * Build the LangGraph StateGraph
   */
  private buildGraph(params: IParams): any {
    console.log('[RemixAIGraph] Building graph...');

    // Create service instances
    const mcpResourceFetcher = new MCPResourceFetcher(this.mcpClients);
    const mcpToolConverter = new MCPToolConverter(this.mcpClients);
    const intentAnalyzer = new IntentAnalyzer();
    const toolSelector = new WeightedToolSelector();

    // Create node functions
    const intentRouterNode = createIntentRouterNode(intentAnalyzer);
    const contextEnrichmentNode = createContextEnrichmentNode(mcpResourceFetcher, 10);
    const toolPreparationNode = createToolPreparationNode(mcpToolConverter, toolSelector, 25);
    const agentNode = createAgentNode(params);
    const toolExecutorNode = createToolExecutorNode();
    const responseBuilderNode = createResponseBuilderNode();

    // Define state channels (properties that can be updated)
    const stateChannels = {
      userPrompt: { value: (x: any, y: any) => y ?? x },
      originalPrompt: { value: (x: any, y: any) => y ?? x },
      messages: { value: (x: any[], y: any[]) => y ?? x },
      workspace: { value: (x: any, y: any) => y ?? x },
      currentFile: { value: (x: any, y: any) => y ?? x },
      mcpResourceContext: { value: (x: any, y: any) => y ?? x },
      intent: { value: (x: any, y: any) => y ?? x },
      availableTools: { value: (x: any[], y: any[]) => y ?? x },
      currentAgent: { value: (x: any, y: any) => y ?? x },
      agentOutput: { value: (x: any, y: any) => y ?? x },
      toolCalls: { value: (x: any[], y: any[]) => y ?? x },
      iterationCount: { value: (x: number, y: number) => y ?? x },
      maxIterations: { value: (x: number, y: number) => y ?? x },
      finalResponse: { value: (x: any, y: any) => y ?? x },
      error: { value: (x: any, y: any) => y ?? x }
    };

    // Create StateGraph
    const workflow = new StateGraph<RemixAIGraphState>({
      channels: stateChannels
    });

    // Add nodes to the graph
    workflow.addNode('intentRouter', intentRouterNode as any);
    workflow.addNode('contextEnrichment', contextEnrichmentNode as any);
    workflow.addNode('toolPreparation', toolPreparationNode as any);
    workflow.addNode('agent', agentNode as any);
    workflow.addNode('toolExecutor', toolExecutorNode as any);
    workflow.addNode('responseBuilder', responseBuilderNode as any);

    // Set entry point
    workflow.setEntryPoint('intentRouter' as any);

    // Define edges
    // intentRouter -> contextEnrichment (for all cases for now)
    workflow.addEdge('intentRouter' as any, 'contextEnrichment' as any);

    // contextEnrichment -> toolPreparation
    workflow.addEdge('contextEnrichment' as any, 'toolPreparation' as any);

    // toolPreparation -> agent
    workflow.addEdge('toolPreparation' as any, 'agent' as any);

    // agent -> conditional: either toolExecutor or responseBuilder
    workflow.addConditionalEdges(
      'agent' as any,
      // Routing function
      (state: RemixAIGraphState) => {
        // If there's an error, go to response builder
        if (state.error) {
          console.log('[RemixAIGraph] Error detected, routing to responseBuilder');
          return 'responseBuilder';
        }

        // If max iterations reached, go to response builder
        if (isMaxIterationsReached(state)) {
          console.log('[RemixAIGraph] Max iterations reached, routing to responseBuilder');
          return 'responseBuilder';
        }

        // If agent called tools, go to tool executor
        if (hasToolCalls(state)) {
          console.log(`[RemixAIGraph] ${state.toolCalls.length} tool call(s) detected, routing to toolExecutor`);
          return 'toolExecutor';
        }

        // Otherwise, we're done - go to response builder
        console.log('[RemixAIGraph] No tool calls, routing to responseBuilder');
        return 'responseBuilder';
      }
    );

    // toolExecutor -> agent (loop back for tool results processing)
    workflow.addEdge('toolExecutor' as any, 'agent' as any);

    // responseBuilder -> END
    workflow.setFinishPoint('responseBuilder' as any);

    // Compile the graph
    console.log('[RemixAIGraph] Graph compiled successfully');
    return workflow.compile();
  }

  /**
   * Invoke the graph with a user prompt
   * @param prompt User's question/prompt
   * @param params Optional parameters to override defaults
   * @returns Final response string
   */
  async invoke(prompt: string, params?: Partial<IParams>): Promise<string> {
    console.log('[RemixAIGraph] Invoking graph with prompt:', prompt.substring(0, 100) + '...');

    try {
      // Merge params
      const effectiveParams = { ...this.params, ...params };

      // Create initial state
      const initialState = createInitialState(prompt);

      // Invoke the graph
      const result = await this.graph.invoke(initialState);

      // Extract final response
      const finalResponse = result.finalResponse || result.agentOutput || 'No response generated';

      console.log('[RemixAIGraph] Graph execution completed successfully');
      return finalResponse;
    } catch (error) {
      console.error('[RemixAIGraph] Graph execution error:', error);
      return `Error executing RemixAI graph: ${error.message || String(error)}`;
    }
  }

  /**
   * Stream responses from the graph
   * @param prompt User's question/prompt
   * @param params Optional parameters
   * @returns Async iterator of state updates
   */
  async *stream(prompt: string, params?: Partial<IParams>): AsyncIterator<RemixAIGraphState> {
    console.log('[RemixAIGraph] Streaming graph execution...');

    try {
      const effectiveParams = { ...this.params, ...params };
      const initialState = createInitialState(prompt);

      // Stream graph execution
      for await (const state of await this.graph.stream(initialState)) {
        yield state;
      }
    } catch (error) {
      console.error('[RemixAIGraph] Graph streaming error:', error);
      throw error;
    }
  }

  /**
   * Update MCP clients (e.g., when servers connect/disconnect)
   */
  updateMCPClients(mcpClients: Map<string, MCPClient>): void {
    console.log('[RemixAIGraph] Updating MCP clients...');
    this.mcpClients = mcpClients;
    // Rebuild the graph with new clients
    this.graph = this.buildGraph(this.params);
  }

  /**
   * Update params (e.g., model, temperature)
   */
  updateParams(params: IParams): void {
    console.log('[RemixAIGraph] Updating params...');
    this.params = params;
    // Rebuild the graph with new params
    this.graph = this.buildGraph(params);
  }
}
