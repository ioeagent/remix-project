import { IGroundTruthValidator } from '../../types/validationTypes';
import { AIFeature, ValidationResult } from '../../types/creditTypes';

export class GenerationValidator implements IGroundTruthValidator {
  private plugin: any;

  constructor(plugin: any) {
    this.plugin = plugin;
  }

  async validate(
    feature: AIFeature,
    prompt: string,
    response: any,
    context?: any
  ): Promise<ValidationResult> {

    // Parse response (should be JSON with files)
    const payload = this.parsePayload(response);

    // Check 1: Has files
    if (!payload?.files || payload.files.length === 0) {
      return {
        isValid: false,
        reason: 'No files generated',
        score: 0,
        metrics: { hasContent: false, hasErrors: true }
      };
    }

    // Check 2: Compile Solidity contracts
    const solFiles = payload.files.filter((f: any) =>
      f.fileName?.endsWith('.sol')
    );

    if (solFiles.length === 0) {
      // No Solidity files, validate differently
      return {
        isValid: true,
        score: 1.0,
        metrics: {
          hasContent: true,
          hasErrors: false,
          contentLength: payload.files.length
        }
      };
    }

    // Use existing compilation helper
    try {
      const compilationResult = await this.compileContracts(
        solFiles.map((f: any) => ({
          name: f.fileName,
          content: f.content
        }))
      );

      if (!compilationResult.compilationSucceeded) {
        // Generated but compilation failed - partial credit
        return {
          isValid: true,
          reason: 'Compilation failed',
          score: 0.5,  // 50% credit
          metrics: {
            hasContent: true,
            hasErrors: true,
            compilationSucceeded: false,
            contentLength: payload.files.length
          }
        };
      }

      // Full success
      return {
        isValid: true,
        score: 1.0,
        metrics: {
          hasContent: true,
          hasErrors: false,
          compilationSucceeded: true,
          contentLength: payload.files.length
        }
      };
    } catch (error) {
      console.error('[GenerationValidator] Compilation error:', error);
      // If compilation check fails, give partial credit
      return {
        isValid: true,
        reason: 'Could not verify compilation',
        score: 0.7,
        metrics: {
          hasContent: true,
          hasErrors: true,
          contentLength: payload.files.length
        }
      };
    }
  }

  private parsePayload(response: any): any {
    try {
      if (typeof response === 'string') {
        return JSON.parse(response);
      }
      return response;
    } catch (error) {
      return null;
    }
  }

  private async compileContracts(contracts: any[]): Promise<any> {
    // Reuse existing compile helper
    try {
      const { compilecontracts } = await import('../../../helpers/compile');
      return compilecontracts(contracts, this.plugin);
    } catch (error) {
      console.error('[GenerationValidator] Failed to import compile helper:', error);
      throw error;
    }
  }
}
