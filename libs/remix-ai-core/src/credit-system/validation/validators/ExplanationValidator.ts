import { IGroundTruthValidator } from '../../types/validationTypes';
import { AIFeature, ValidationResult } from '../../types/creditTypes';

export class ExplanationValidator implements IGroundTruthValidator {
  async validate(
    feature: AIFeature,
    prompt: string,
    response: any,
    context?: any
  ): Promise<ValidationResult> {

    if (!response || typeof response !== 'string') {
      return {
        isValid: false,
        reason: 'Empty response',
        score: 0,
        metrics: { hasContent: false, hasErrors: true }
      };
    }

    const content = response.trim();

    // Check 1: Minimum length (explanations should be substantive)
    if (content.length < 50) {
      return {
        isValid: false,
        reason: 'Explanation too brief',
        score: 0.3,
        metrics: {
          hasContent: true,
          hasErrors: false,
          contentLength: content.length
        }
      };
    }

    // Check 2: Contains code references (backticks)
    const hasCodeRefs = content.includes('`');

    // Check 3: Structured (has paragraphs or lists)
    const hasStructure = content.includes('\n\n') ||
                         content.includes('- ') ||
                         content.includes('* ');

    // Quality score
    let quality = 0.7; // Base quality
    if (hasCodeRefs) quality += 0.15;
    if (hasStructure) quality += 0.15;

    return {
      isValid: true,
      score: quality,
      metrics: {
        hasContent: true,
        hasErrors: false,
        contentLength: content.length,
        semanticQuality: quality,
        specificChecks: {
          hasCodeRefs,
          hasStructure
        }
      }
    };
  }
}
