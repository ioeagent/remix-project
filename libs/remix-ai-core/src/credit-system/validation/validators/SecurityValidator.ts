import { IGroundTruthValidator } from '../../types/validationTypes';
import { AIFeature, ValidationResult } from '../../types/creditTypes';

export class SecurityValidator implements IGroundTruthValidator {
  async validate(
    feature: AIFeature,
    prompt: string,
    response: any,
    context?: any
  ): Promise<ValidationResult> {

    let parsed: any;
    try {
      parsed = typeof response === 'string'
        ? JSON.parse(response)
        : response;
    } catch {
      return {
        isValid: false,
        reason: 'Invalid response format',
        score: 0,
        metrics: { hasContent: false, hasErrors: true }
      };
    }

    // Check structure
    const hasAnswer = parsed.Answer && parsed.Answer.trim().length > 0;
    const hasReason = parsed.Reason && parsed.Reason.trim().length > 0;
    const hasSuggestion = parsed.Suggestion && parsed.Suggestion.trim && parsed.Suggestion.trim().length > 0;

    if (!hasAnswer) {
      return {
        isValid: false,
        reason: 'No vulnerability analysis provided',
        score: 0,
        metrics: { hasContent: false, hasErrors: true }
      };
    }

    // Quality check
    let quality = 0.6; // Base
    if (hasReason) quality += 0.2;
    if (hasSuggestion) quality += 0.2;

    return {
      isValid: true,
      score: quality,
      metrics: {
        hasContent: true,
        hasErrors: false,
        semanticQuality: quality,
        specificChecks: {
          hasAnswer,
          hasReason,
          hasSuggestion
        }
      }
    };
  }
}
