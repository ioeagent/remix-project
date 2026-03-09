/**
 * Frontend Generation Tool Handlers for Remix MCP Server
 * Implements planning and execution modes for agentic frontend generation
 */

import { IMCPToolResult } from '../../types/mcp';
import { BaseToolHandler } from '../registry/RemixToolRegistry';
import { IParams, GenerationParams } from '@remix/remix-ai-core';
import {
  ToolCategory,
  RemixToolDefinition,
  GenerateTreeArgs,
  ModifyPlanArgs,
  ApprovePlanArgs,
  ExecutePlanArgs,
  GetPlanArgs,
  FileNode,
  GenerationPlan,
  FileGenerationContext
} from '../types/mcpTools';
import { Plugin } from '@remixproject/engine';
import { PlanStore } from '../state/PlanStore';

export class GenerateTreeHandler extends BaseToolHandler {
  name = 'generate_tree';
  description = 'Generate a file structure plan for a frontend project using AI. Returns a plan ID that can be modified and approved before execution.';
  inputSchema = {
    type: 'object',
    properties: {
      prompt: {
        type: 'string',
        description: 'Detailed description of the frontend project to generate'
      },
      projectType: {
        type: 'string',
        enum: ['react', 'vue', 'angular', 'vanilla'],
        description: 'Type of frontend project'
      },
      framework: {
        type: 'string',
        description: 'Framework to use (e.g., next, remix, vite, nuxt)'
      },
      features: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of features to include'
      }
    },
    required: ['prompt']
  };

  getPermissions(): string[] {
    return ['frontend:plan'];
  }

  validate(args: GenerateTreeArgs): boolean | string {
    const required = this.validateRequired(args, ['prompt']);
    if (required !== true) return required;

    const types = this.validateTypes(args, {
      prompt: 'string',
      projectType: 'string',
      framework: 'string'
    });
    if (types !== true) return types;

    return true;
  }

  async execute(args: GenerateTreeArgs, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const treePrompt = this.buildTreePrompt(args);

      const params:IParams = GenerationParams
      params.stream = false
      params.stream_result = false

      const response = await plugin.call('remixAI', 'answer', treePrompt, params);

      // Parse and validate response
      const fileTree = this.parseTreeResponse(response);
      if (!fileTree || fileTree.length === 0) {
        return this.createErrorResult('Failed to generate valid file tree. Please retry with a more specific prompt.');
      }

      // Sort by priority and dependencies
      const sortedTree = this.sortFileTree(fileTree);

      // Count total files (exclude directories)
      const totalFiles = sortedTree.filter(node => node.type === 'file').length;

      // Create plan using PlanStore
      const planStore = PlanStore.getInstance(plugin);
      const plan = planStore.createPlan({
        name: args.prompt.substring(0, 100),
        description: args.prompt,
        fileTree: sortedTree,
        totalFiles,
        metadata: {
          projectType: args.projectType,
          framework: args.framework,
          features: args.features
        }
      });

      return this.createSuccessResult({
        planId: plan.id,
        plan,
        message: `Generated plan with ${totalFiles} files. Use 'modify_plan' to edit, 'approve_plan' to approve, or 'execute_plan' to generate files.`,
        preview: this.generateTreePreview(sortedTree)
      });
    } catch (error) {
      return this.createErrorResult(`Failed to generate tree: ${error.message}`);
    }
  }

  private buildTreePrompt(args: GenerateTreeArgs): string {
    return `You are a frontend architecture expert. Generate a complete file structure for the following project.

Project Description: ${args.prompt}
${args.projectType ? `Project Type: ${args.projectType}` : ''}
${args.framework ? `Framework: ${args.framework}` : ''}
${args.features && args.features.length > 0 ? `Features: ${args.features.join(', ')}` : ''}

Return a JSON array of FileNode objects with the following structure:
- path: string (e.g., "src/components/Header.tsx")
- type: "file" or "directory"
- description: string (what this file contains - required for files)
- dependencies: string[] (other file paths this depends on - optional)
- priority: number (generation order, 1 = first - optional)

Requirements:
1. Include all necessary files: package.json, configs, source files, components, styles
2. Order files by dependency (base files first, dependent files later)
3. No circular dependencies
4. Include clear descriptions for each file
5. Use appropriate file extensions for the project type

Return ONLY the JSON array, no markdown formatting or explanations.`;
  }

  private parseTreeResponse(response: any): FileNode[] {
    try {
      let jsonStr = typeof response === 'string' ? response : JSON.stringify(response);

      // Extract JSON from markdown code blocks if present
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1];
      }

      const parsed = JSON.parse(jsonStr);
      const fileTree = Array.isArray(parsed) ? parsed : (parsed.fileTree || []);

      // Validate structure
      return fileTree.filter(node =>
        node.path &&
        node.type &&
        (node.type === 'file' || node.type === 'directory')
      );
    } catch (error) {
      console.error('Failed to parse tree response:', error);
      return [];
    }
  }

  private sortFileTree(fileTree: FileNode[]): FileNode[] {
    // Sort by priority first, then by dependencies
    const sorted = [...fileTree];
    sorted.sort((a, b) => {
      if (a.priority !== undefined && b.priority !== undefined) {
        return a.priority - b.priority;
      }
      // Directories first, then files
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      // Files with no dependencies first
      const aDeps = (a.dependencies || []).length;
      const bDeps = (b.dependencies || []).length;
      return aDeps - bDeps;
    });
    return sorted;
  }

  private generateTreePreview(fileTree: FileNode[]): string {
    let preview = '\nFile Tree:\n';
    fileTree.forEach(node => {
      const indent = (node.path.match(/\//g) || []).length * 2;
      const prefix = ' '.repeat(indent);
      const icon = node.type === 'directory' ? '📁' : '📄';
      preview += `${prefix}${icon} ${node.path}`;
      if (node.description) {
        preview += ` - ${node.description}`;
      }
      preview += '\n';
    });
    return preview;
  }
}

export class ModifyPlanHandler extends BaseToolHandler {
  name = 'modify_plan';
  description = 'Modify a generation plan before approval. Can update file tree structure and metadata.';
  inputSchema = {
    type: 'object',
    properties: {
      planId: {
        type: 'string',
        description: 'The ID of the plan to modify'
      },
      modifications: {
        type: 'object',
        properties: {
          fileTree: {
            type: 'array',
            items: { type: 'object' },
            description: 'Updated file tree structure'
          },
          metadata: {
            type: 'object',
            description: 'Updated metadata'
          }
        },
        description: 'Modifications to apply to the plan'
      }
    },
    required: ['planId', 'modifications']
  };

  getPermissions(): string[] {
    return ['frontend:plan'];
  }

  validate(args: ModifyPlanArgs): boolean | string {
    const required = this.validateRequired(args, ['planId', 'modifications']);
    if (required !== true) return required;

    const types = this.validateTypes(args, {
      planId: 'string',
      modifications: 'object'
    });
    if (types !== true) return types;

    return true;
  }

  async execute(args: ModifyPlanArgs, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const planStore = PlanStore.getInstance(plugin);
      const plan = planStore.getPlan(args.planId);

      if (!plan) {
        return this.createErrorResult(`Plan with ID ${args.planId} not found`);
      }

      if (plan.status !== 'pending') {
        return this.createErrorResult(`Cannot modify plan with status '${plan.status}'. Only 'pending' plans can be modified.`);
      }

      // Apply modifications
      const updates: Partial<GenerationPlan> = {};

      if (args.modifications.fileTree) {
        updates.fileTree = args.modifications.fileTree;
        updates.totalFiles = args.modifications.fileTree.filter(n => n.type === 'file').length;
      }

      if (args.modifications.metadata) {
        updates.metadata = { ...plan.metadata, ...args.modifications.metadata };
      }

      planStore.updatePlan(args.planId, updates);

      const updatedPlan = planStore.getPlan(args.planId);

      return this.createSuccessResult({
        plan: updatedPlan,
        message: 'Plan modified successfully. Use approve_plan to approve or execute_plan to generate files.'
      });
    } catch (error) {
      return this.createErrorResult(`Failed to modify plan: ${error.message}`);
    }
  }
}

export class ApprovePlanHandler extends BaseToolHandler {
  name = 'approve_plan';
  description = 'Approve a generation plan for execution. Plan must be approved before files can be generated.';
  inputSchema = {
    type: 'object',
    properties: {
      planId: {
        type: 'string',
        description: 'The ID of the plan to approve'
      }
    },
    required: ['planId']
  };

  getPermissions(): string[] {
    return ['frontend:approve'];
  }

  validate(args: ApprovePlanArgs): boolean | string {
    const required = this.validateRequired(args, ['planId']);
    if (required !== true) return required;

    const types = this.validateTypes(args, { planId: 'string' });
    if (types !== true) return types;

    return true;
  }

  async execute(args: ApprovePlanArgs, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const planStore = PlanStore.getInstance(plugin);
      const plan = planStore.getPlan(args.planId);

      if (!plan) {
        return this.createErrorResult(`Plan with ID ${args.planId} not found`);
      }

      planStore.updatePlan(args.planId, { status: 'approved' });

      return this.createSuccessResult({
        planId: args.planId,
        status: 'approved',
        message: 'Plan approved successfully. Use execute_plan to generate files.',
        totalFiles: plan.totalFiles
      });
    } catch (error) {
      return this.createErrorResult(`Failed to approve plan: ${error.message}`);
    }
  }
}

export class GetPlanHandler extends BaseToolHandler {
  name = 'get_plan';
  description = 'Retrieve details of a generation plan by ID.';
  inputSchema = {
    type: 'object',
    properties: {
      planId: {
        type: 'string',
        description: 'The ID of the plan to retrieve'
      }
    },
    required: ['planId']
  };

  getPermissions(): string[] {
    return ['frontend:read'];
  }

  validate(args: GetPlanArgs): boolean | string {
    const required = this.validateRequired(args, ['planId']);
    if (required !== true) return required;

    const types = this.validateTypes(args, { planId: 'string' });
    if (types !== true) return types;

    return true;
  }

  async execute(args: GetPlanArgs, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const planStore = PlanStore.getInstance(plugin);
      const plan = planStore.getPlan(args.planId);

      if (!plan) {
        return this.createErrorResult(`Plan with ID ${args.planId} not found`);
      }

      return this.createSuccessResult({
        plan,
        generatedFiles: planStore.getGeneratedFiles(args.planId)
      });
    } catch (error) {
      return this.createErrorResult(`Failed to retrieve plan: ${error.message}`);
    }
  }
}

export class ExecutePlanHandler extends BaseToolHandler {
  name = 'execute_plan';
  description = 'Execute an approved plan and generate all files. Files are created one-by-one with dependency context.';
  inputSchema = {
    type: 'object',
    properties: {
      planId: {
        type: 'string',
        description: 'The ID of the plan to execute'
      },
      options: {
        type: 'object',
        properties: {
          skipExisting: {
            type: 'boolean',
            description: 'Skip files that already exist'
          }
        }
      }
    },
    required: ['planId']
  };

  getPermissions(): string[] {
    return ['frontend:execute', 'file:write', 'file:create'];
  }

  validate(args: ExecutePlanArgs): boolean | string {
    const required = this.validateRequired(args, ['planId']);
    if (required !== true) return required;

    const types = this.validateTypes(args, { planId: 'string' });
    if (types !== true) return types;

    return true;
  }

  async execute(args: ExecutePlanArgs, plugin: Plugin): Promise<IMCPToolResult> {
    try {
      const planStore = PlanStore.getInstance(plugin);
      const plan = planStore.getPlan(args.planId);

      if (!plan) {
        return this.createErrorResult(`Plan with ID ${args.planId} not found`);
      }

      if (plan.status !== 'approved') {
        return this.createErrorResult(`Plan must be approved before execution. Current status: ${plan.status}. Use approve_plan first.`);
      }

      // Initialize execution
      planStore.initializeExecution(args.planId);

      const results = {
        success: true,
        generated: 0,
        skipped: 0,
        errors: 0,
        details: [] as any[]
      };

      // Generate files one by one
      for (const node of plan.fileTree) {
        if (node.type === 'directory') {
          // Create directory
          try {
            await this.createDirectory(plugin, node.path);
            results.details.push({ path: node.path, status: 'directory_created' });
          } catch (error) {
            results.details.push({ path: node.path, status: 'error', error: error.message });
            results.errors++;
          }
          continue;
        }

        // Check if file exists and skip if requested
        if (args.options?.skipExisting) {
          const exists = await plugin.call('fileManager', 'exists', node.path);
          if (exists) {
            results.skipped++;
            results.details.push({ path: node.path, status: 'skipped' });
            continue;
          }
        }

        try {
          // Build generation context
          const context = this.buildFileContext(node, planStore.getGeneratedFiles(args.planId), plan);

          // Generate file content
          const content = await this.generateFileContent(plugin, context, plan);

          // Write file using the pattern from FileWriteHandler
          await this.writeFile(plugin, node.path, content);

          // Mark as generated
          planStore.markFileGenerated(args.planId, node.path, content);

          results.generated++;
          results.details.push({ path: node.path, status: 'generated' });
        } catch (error) {
          results.errors++;
          results.details.push({ path: node.path, status: 'error', error: error.message });
        }
      }

      // Update plan status
      const finalStatus = results.errors > 0 ? 'failed' : 'completed';
      planStore.updatePlan(args.planId, { status: finalStatus });

      results.success = results.errors === 0;

      return this.createSuccessResult({
        status: finalStatus,
        generated: results.generated,
        skipped: results.skipped,
        errors: results.errors,
        details: results.details,
        message: `Generated ${results.generated} files, skipped ${results.skipped}, ${results.errors} errors`
      });
    } catch (error) {
      return this.createErrorResult(`Failed to execute plan: ${error.message}`);
    }
  }

  private async createDirectory(plugin: Plugin, path: string): Promise<void> {
    // Create parent directories recursively
    const parts = path.split('/');
    let currentPath = '';

    for (const part of parts) {
      if (!part) continue;
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const exists = await plugin.call('fileManager', 'exists', currentPath);
      if (!exists) {
        await plugin.call('fileManager', 'mkdir', currentPath);
      }
    }
  }

  private buildFileContext(
    node: FileNode,
    alreadyGenerated: Record<string, string>,
    plan: GenerationPlan
  ): FileGenerationContext {
    return {
      fileName: node.path,
      description: node.description || '',
      dependencies: node.dependencies || [],
      alreadyGenerated
    };
  }

  private async generateFileContent(
    plugin: Plugin,
    context: FileGenerationContext,
    plan: GenerationPlan
  ): Promise<string> {
    const prompt = this.buildFileGenerationPrompt(context, plan);

    const params:IParams = GenerationParams
    params.stream = false
    params.stream_result = false

    const response = await plugin.call('remixAI', 'answer', prompt, params);

    return this.extractCode(response);
  }

  private buildFileGenerationPrompt(context: FileGenerationContext, plan: GenerationPlan): string {
    let prompt = `Generate complete content for this file in a ${plan.metadata?.projectType || 'web'} project.

File: ${context.fileName}
Description: ${context.description}

Project Context: ${plan.description}
${plan.metadata?.framework ? `Framework: ${plan.metadata.framework}` : ''}
${plan.metadata?.features ? `Features: ${plan.metadata.features.join(', ')}` : ''}
`;

    // Add dependency context
    if (context.dependencies.length > 0) {
      prompt += '\nDependencies (already generated):\n';
      for (const dep of context.dependencies) {
        const depContent = context.alreadyGenerated[dep];
        if (depContent) {
          // Limit context to 500 chars per dependency
          const preview = depContent.substring(0, 500);
          prompt += `\n--- ${dep} ---\n${preview}${depContent.length > 500 ? '...' : ''}\n`;
        }
      }
    }

    prompt += '\nGenerate COMPLETE file content with imports, types, logic. Return only code, no explanations or markdown formatting.';

    return prompt;
  }

  private extractCode(response: any): string {
    let code = typeof response === 'string' ? response : JSON.stringify(response);

    // Extract from markdown code blocks if present
    const codeBlockMatch = code.match(/```(?:\w+)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      code = codeBlockMatch[1];
    }

    return code.trim();
  }

  private async writeFile(plugin: Plugin, path: string, content: string): Promise<void> {
    // Create empty file first
    const exists = await plugin.call('fileManager', 'exists', path);
    if (!exists) {
      await plugin.call('fileManager', 'writeFile', path, '');
    }

    // Open in editor
    try {
      await plugin.call('fileManager', 'open', path);
    } catch (error) {
      console.warn(`Failed to open file in editor: ${error.message}`);
    }

    // Wait for UI update
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Show diff for user review
    const cleanContent = typeof content === 'string' ? content : String(content);
    await plugin.call('editor', 'showCustomDiff', path, cleanContent);
  }
}

/**
 * Factory function to create all frontend generation tools
 */
export function createFrontendGenerationTools(): RemixToolDefinition[] {
  return [
    {
      name: 'generate_tree',
      description: 'Generate a file structure plan for a frontend project using AI',
      inputSchema: new GenerateTreeHandler().inputSchema,
      category: ToolCategory.WORKSPACE,
      permissions: ['frontend:plan'],
      handler: new GenerateTreeHandler()
    },
    {
      name: 'modify_plan',
      description: 'Modify a generation plan before approval',
      inputSchema: new ModifyPlanHandler().inputSchema,
      category: ToolCategory.WORKSPACE,
      permissions: ['frontend:plan'],
      handler: new ModifyPlanHandler()
    },
    {
      name: 'approve_plan',
      description: 'Approve a generation plan for execution',
      inputSchema: new ApprovePlanHandler().inputSchema,
      category: ToolCategory.WORKSPACE,
      permissions: ['frontend:approve'],
      handler: new ApprovePlanHandler()
    },
    {
      name: 'get_plan',
      description: 'Retrieve details of a generation plan',
      inputSchema: new GetPlanHandler().inputSchema,
      category: ToolCategory.WORKSPACE,
      permissions: ['frontend:read'],
      handler: new GetPlanHandler()
    },
    {
      name: 'execute_plan',
      description: 'Execute an approved plan and generate all files',
      inputSchema: new ExecutePlanHandler().inputSchema,
      category: ToolCategory.WORKSPACE,
      permissions: ['frontend:execute', 'file:write', 'file:create'],
      handler: new ExecutePlanHandler()
    }
  ];
}
