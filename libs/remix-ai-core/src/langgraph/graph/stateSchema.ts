import { DynamicStructuredTool } from '@langchain/core/tools';
import { BaseMessage } from '@langchain/core/messages';
import { IUserIntent } from '../../types/mcp';

/**
 * Intent category types for routing
 */
export type IntentCategory =
  | 'contract_generation'
  | 'security_audit'
  | 'workspace_edit'
  | 'code_explanation'
  | 'debugging'
  | 'general';

/**
 * Intent analysis result for routing and context
 */
export interface IntentAnalysis {
  category: IntentCategory;
  confidence: number;
  suggestedAgent: string;
  intent: IUserIntent;
}

/**
 * Tool call structure from LLM
 */
export interface ToolCall {
  id: string;
  type: string;
  function: {
    name: string;
    arguments: string | Record<string, any>;
  };
}

/**
 * RemixAI LangGraph State Schema
 * This state flows through all nodes in the graph
 */
export interface RemixAIGraphState {
  // ===== Input =====
  /** User's original prompt/question */
  userPrompt: string;
  /** Original unmodified prompt */
  originalPrompt: string;

  // ===== Chat History =====
  /** Chat messages in LangChain format (HumanMessage, AIMessage, etc.) */
  messages: BaseMessage[];

  // ===== Context =====
  /** Current workspace path */
  workspace: string;
  /** Current open file */
  currentFile: string;
  /** MCP resource context (fetched and formatted) */
  mcpResourceContext: string;

  // ===== Intent =====
  /** Analyzed user intent for routing and context selection */
  intent: IntentAnalysis | null;

  // ===== Tools =====
  /** Available tools in LangChain format (converted from MCP) */
  availableTools: DynamicStructuredTool[];

  // ===== Agent Execution =====
  /** Currently active agent name */
  currentAgent: string | null;
  /** Output from the agent's last execution */
  agentOutput: string | null;

  // ===== Tool Calling =====
  /** Tool calls requested by the LLM */
  toolCalls: ToolCall[];

  // ===== Loop Control =====
  /** Current iteration count for tool execution loop */
  iterationCount: number;
  /** Maximum iterations allowed before stopping */
  maxIterations: number;

  // ===== Output =====
  /** Final response to return to user */
  finalResponse: string | null;
  /** Error message if something went wrong */
  error: string | null;
}

/**
 * Initial state factory function
 * Creates a fresh state object with defaults
 */
export function createInitialState(prompt: string): RemixAIGraphState {
  return {
    userPrompt: prompt,
    originalPrompt: prompt,
    messages: [],
    workspace: '',
    currentFile: '',
    mcpResourceContext: '',
    intent: null,
    availableTools: [],
    currentAgent: null,
    agentOutput: null,
    toolCalls: [],
    iterationCount: 0,
    maxIterations: 10,
    finalResponse: null,
    error: null
  };
}

/**
 * Type guard to check if state has an error
 */
export function hasError(state: RemixAIGraphState): boolean {
  return state.error !== null && state.error !== undefined;
}

/**
 * Type guard to check if state has tool calls
 */
export function hasToolCalls(state: RemixAIGraphState): boolean {
  return state.toolCalls && state.toolCalls.length > 0;
}

/**
 * Type guard to check if max iterations reached
 */
export function isMaxIterationsReached(state: RemixAIGraphState): boolean {
  return state.iterationCount >= state.maxIterations;
}

/**
 * Helper to extract simple string content from agent output
 */
export function getAgentOutputText(state: RemixAIGraphState): string {
  if (!state.agentOutput) {
    return '';
  }

  // If agentOutput is already a string, return it
  if (typeof state.agentOutput === 'string') {
    return state.agentOutput;
  }

  // Try to extract text from structured output
  if (typeof state.agentOutput === 'object') {
    const output = state.agentOutput as any;
    if ('text' in output) {
      return String(output.text);
    }
    if ('content' in output) {
      return String(output.content);
    }
  }

  // Fallback to JSON stringify
  return JSON.stringify(state.agentOutput);
}
