/**
 * State manager for frontend generation plans
 * Manages the lifecycle of generation plans and tracks execution context
 */

import { Plugin } from '@remixproject/engine';
import { GenerationPlan, FileNode } from '../types/mcpTools';
import { v4 as uuidv4 } from 'uuid';

/**
 * Singleton class for managing frontend generation plans
 */
export class PlanStore {
  private static instance: PlanStore;
  private plans: Map<string, GenerationPlan> = new Map();
  private executionState: Map<string, Record<string, string>> = new Map();
  private plugin: Plugin;

  private constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  /**
   * Get or create singleton instance
   */
  static getInstance(plugin: Plugin): PlanStore {
    if (!PlanStore.instance) {
      PlanStore.instance = new PlanStore(plugin);
    }
    return PlanStore.instance;
  }

  /**
   * Create a new generation plan
   */
  createPlan(plan: Omit<GenerationPlan, 'id' | 'createdAt' | 'status' | 'generatedFiles'>): GenerationPlan {
    const id = uuidv4();
    const newPlan: GenerationPlan = {
      ...plan,
      id,
      createdAt: new Date(),
      status: 'pending',
      generatedFiles: 0
    };

    this.plans.set(id, newPlan);
    return newPlan;
  }

  /**
   * Get a plan by ID
   */
  getPlan(planId: string): GenerationPlan | undefined {
    return this.plans.get(planId);
  }

  /**
   * Update an existing plan
   */
  updatePlan(planId: string, updates: Partial<GenerationPlan>): void {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan with ID ${planId} not found`);
    }

    const updatedPlan = { ...plan, ...updates };
    this.plans.set(planId, updatedPlan);
  }

  /**
   * Delete a plan
   */
  deletePlan(planId: string): void {
    this.plans.delete(planId);
    this.executionState.delete(planId);
  }

  /**
   * List all plans
   */
  listPlans(): GenerationPlan[] {
    return Array.from(this.plans.values());
  }

  /**
   * Initialize execution state for a plan
   */
  initializeExecution(planId: string): void {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan with ID ${planId} not found`);
    }

    // Initialize empty execution state
    this.executionState.set(planId, {});

    // Update plan status
    this.updatePlan(planId, { status: 'executing', generatedFiles: 0 });
  }

  /**
   * Mark a file as generated and store its content
   */
  markFileGenerated(planId: string, fileName: string, content: string): void {
    const state = this.executionState.get(planId);
    if (!state) {
      throw new Error(`Execution state for plan ${planId} not initialized`);
    }

    state[fileName] = content;

    // Update progress counter
    const plan = this.plans.get(planId);
    if (plan) {
      this.updatePlan(planId, { generatedFiles: plan.generatedFiles + 1 });
    }
  }

  /**
   * Get all generated files for a plan
   */
  getGeneratedFiles(planId: string): Record<string, string> {
    return this.executionState.get(planId) || {};
  }

  /**
   * Clear all plans (for testing)
   */
  clear(): void {
    this.plans.clear();
    this.executionState.clear();
  }

  /**
   * Get plan statistics
   */
  getStats(): {
    totalPlans: number;
    byStatus: Record<GenerationPlan['status'], number>;
  } {
    const plans = Array.from(this.plans.values());
    const stats = {
      totalPlans: plans.length,
      byStatus: {
        pending: 0,
        approved: 0,
        executing: 0,
        completed: 0,
        failed: 0
      } as Record<GenerationPlan['status'], number>
    };

    plans.forEach(plan => {
      stats.byStatus[plan.status]++;
    });

    return stats;
  }
}
