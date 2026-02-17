import { AIFeature, ValidationResult } from '../types/creditTypes';
import { IGroundTruthValidator } from '../types/validationTypes';
import { CompletionValidator } from './validators/CompletionValidator';
import { GenerationValidator } from './validators/GenerationValidator';
import { ExplanationValidator } from './validators/ExplanationValidator';
import { SecurityValidator } from './validators/SecurityValidator';

export class GroundTruthValidator {
  private validators: Map<AIFeature, IGroundTruthValidator>;
  private plugin: any;

  constructor(plugin: any) {
    this.plugin = plugin;
    this.validators = new Map();
    this.registerValidators();
  }

  private registerValidators(): void {
    this.validators.set(
      AIFeature.CODE_COMPLETION,
      new CompletionValidator()
    );
    this.validators.set(
      AIFeature.CODE_INSERTION,
      new CompletionValidator()
    );
    this.validators.set(
      AIFeature.CODE_EXPLANATION,
      new ExplanationValidator()
    );
    this.validators.set(
      AIFeature.ERROR_EXPLANATION,
      new ExplanationValidator()
    );
    this.validators.set(
      AIFeature.GENERAL_CHAT,
      new ExplanationValidator()
    );
    this.validators.set(
      AIFeature.VULNERABILITY_CHECK,
      new SecurityValidator()
    );
    this.validators.set(
      AIFeature.WORKSPACE_GENERATION,
      new GenerationValidator(this.plugin)
    );
    this.validators.set(
      AIFeature.DAPP_GENERATION,
      new GenerationValidator(this.plugin)
    );
  }

  async validate(
    feature: AIFeature,
    prompt: string,
    response: any,
    context?: any
  ): Promise<ValidationResult> {
    const validator = this.validators.get(feature);

    if (!validator) {
      // Default validation if no specific validator
      return this.defaultValidation(response);
    }

    try {
      return await validator.validate(feature, prompt, response, context);
    } catch (error) {
      console.error(`[GroundTruthValidator] Validation error for ${feature}:`, error);
      // Fall back to default validation on error
      return this.defaultValidation(response);
    }
  }

  private defaultValidation(response: any): ValidationResult {
    const hasContent = response &&
      typeof response === 'string' &&
      response.trim().length > 0;

    return {
      isValid: hasContent,
      score: hasContent ? 1.0 : 0,
      metrics: {
        hasContent,
        hasErrors: !hasContent,
        contentLength: hasContent ? response.length : 0
      }
    };
  }
}
