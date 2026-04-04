import { RemixAIGraphState, IntentAnalysis, IntentCategory } from '../graph/stateSchema';
import { IntentAnalyzer } from '../../services/intentAnalyzer';

/**
 * Intent Router Node
 * Analyzes user prompt to determine intent and route to appropriate agent/flow
 */
export function createIntentRouterNode(intentAnalyzer: IntentAnalyzer) {
  return async (state: RemixAIGraphState): Promise<Partial<RemixAIGraphState>> => {
    console.log('[IntentRouterNode] Analyzing user intent...');

    try {
      // Use IntentAnalyzer to analyze the prompt
      const userIntent = await intentAnalyzer.analyzeIntent(state.userPrompt);

      // Map intent type to our routing categories
      const category = mapIntentTypeToCategory(userIntent.type);

      // Determine suggested agent based on category and keywords
      const suggestedAgent = determineSuggestedAgent(category, userIntent.keywords);

      const intentAnalysis: IntentAnalysis = {
        category,
        confidence: userIntent.confidence,
        suggestedAgent,
        intent: userIntent
      };

      console.log(`[IntentRouterNode] Intent: ${category} (confidence: ${Math.round(userIntent.confidence * 100)}%)`);
      console.log(`[IntentRouterNode] Suggested agent: ${suggestedAgent}`);
      console.log(`[IntentRouterNode] Domains: ${userIntent.domains.join(', ')}`);
      console.log(`[IntentRouterNode] Keywords: ${userIntent.keywords.slice(0, 5).join(', ')}...`);

      return {
        intent: intentAnalysis
      };
    } catch (error) {
      console.error('[IntentRouterNode] Error analyzing intent:', error);

      // Fallback to general category on error
      return {
        intent: {
          category: 'general',
          confidence: 0.5,
          suggestedAgent: 'general',
          intent: {
            type: 'explanation',
            confidence: 0.5,
            keywords: [],
            domains: [],
            complexity: 'medium',
            originalQuery: state.userPrompt
          }
        }
      };
    }
  };
}

/**
 * Map IntentAnalyzer intent type to our routing category
 */
function mapIntentTypeToCategory(intentType: string): IntentCategory {
  switch (intentType) {
    case 'coding':
    case 'generation':
      // Check if it's contract generation or general coding
      return 'contract_generation'; // Can be refined further
    case 'debugging':
      return 'debugging';
    case 'explanation':
    case 'documentation':
      return 'code_explanation';
    case 'completion':
      return 'general';
    default:
      return 'general';
  }
}

/**
 * Determine which agent should handle this request
 */
function determineSuggestedAgent(category: IntentCategory, keywords: string[]): string {
  // Check for security-related keywords
  const securityKeywords = ['security', 'vulnerability', 'audit', 'safe', 'reentrancy', 'overflow', 'attack'];
  const hasSecurityKeyword = keywords.some(k => securityKeywords.includes(k.toLowerCase()));

  if (hasSecurityKeyword) {
    return 'security';
  }

  // Check for contract-related keywords
  const contractKeywords = ['contract', 'solidity', 'deploy', 'compile', 'function', 'modifier'];
  const hasContractKeyword = keywords.some(k => contractKeywords.includes(k.toLowerCase()));

  if (hasContractKeyword && category === 'contract_generation') {
    return 'contract';
  }

  // Check for workspace/file keywords
  const workspaceKeywords = ['file', 'directory', 'workspace', 'folder', 'create', 'delete', 'rename'];
  const hasWorkspaceKeyword = keywords.some(k => workspaceKeywords.includes(k.toLowerCase()));

  if (hasWorkspaceKeyword) {
    return 'workspace';
  }

  // Map category to agent
  switch (category) {
    case 'contract_generation':
      return 'contract';
    case 'security_audit':
      return 'security';
    case 'workspace_edit':
      return 'workspace';
    case 'code_explanation':
      return 'general';
    case 'debugging':
      return 'general';
    case 'general':
    default:
      return 'general';
  }
}
