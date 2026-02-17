import { IGroundTruthValidator } from '../../types/validationTypes';
import { AIFeature, ValidationResult } from '../../types/creditTypes';

export class CompletionValidator implements IGroundTruthValidator {
  async validate(
    feature: AIFeature,
    prompt: string,
    response: any,
    context?: any
  ): Promise<ValidationResult> {

    // Check 1: Non-empty response
    if (!response || typeof response !== 'string') {
      return {
        isValid: false,
        reason: 'Empty or invalid response',
        score: 0,
        metrics: { hasContent: false, hasErrors: true }
      };
    }

    const content = response.trim();

    // Check 2: Minimum length (not just whitespace)
    if (content.length < 2) {
      return {
        isValid: false,
        reason: 'Response too short',
        score: 0,
        metrics: {
          hasContent: false,
          hasErrors: true,
          contentLength: content.length
        }
      };
    }

    // Check 3: No placeholder text
    const placeholders = ['...', 'TODO', '<placeholder>'];
    const hasPlaceholders = placeholders.some(p =>
      content.includes(p)
    );

    // Check 4: Reasonable length (not truncated)
    const seemsTruncated = content.length > 500 &&
      !content.endsWith('}') &&
      !content.endsWith(';');

    const quality = hasPlaceholders || seemsTruncated ? 0.7 : 1.0;

    return {
      isValid: true,
      score: quality,
      metrics: {
        hasContent: true,
        hasErrors: false,
        contentLength: content.length,
        semanticQuality: quality,
        specificChecks: {
          hasPlaceholders,
          seemsTruncated
        }
      }
    };
  }
}
