import { AIFeature, ValidationResult } from './creditTypes';

export interface IGroundTruthValidator {
  validate(
    feature: AIFeature,
    prompt: string,
    response: any,
    context?: any
  ): Promise<ValidationResult>;
}
