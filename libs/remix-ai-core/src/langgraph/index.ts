/**
 * LangGraph Integration for RemixAI
 *
 * This module provides a LangChain-native implementation of chat handling
 * that reads MCP resources and tools directly, without using legacy MCPInferencer logic.
 *
 * Key Components:
 * - RemixAIGraph: Main orchestrator that assembles nodes into a StateGraph
 * - MCPResourceFetcher: Fetches MCP resources directly
 * - MCPToolConverter: Converts MCP tools to LangChain DynamicStructuredTool format
 * - Various nodes: Intent routing, context enrichment, tool preparation, agent, tool execution, response building
 */

// Main graph orchestrator
export { RemixAIGraph } from './graph/remixAIGraph';

// State schema and types
export {
  RemixAIGraphState,
  IntentCategory,
  IntentAnalysis,
  ToolCall,
  createInitialState,
  hasError,
  hasToolCalls,
  isMaxIterationsReached,
  getAgentOutputText
} from './graph/stateSchema';

// Services
export { MCPResourceFetcher } from './services/mcpResourceFetcher';
export { MCPToolConverter } from './services/mcpToolConverter';

// Nodes (optional exports for advanced usage)
export { createIntentRouterNode } from './nodes/intentRouterNode';
export { createContextEnrichmentNode } from './nodes/contextEnrichmentNode';
export { createToolPreparationNode } from './nodes/toolPreparationNode';
export { createAgentNode } from './nodes/agentNode';
export { createToolExecutorNode } from './nodes/toolExecutorNode';
export { createResponseBuilderNode } from './nodes/responseBuilderNode';
