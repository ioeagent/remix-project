/**
 * State manager for frontend generation plans
 * Manages the lifecycle of generation plans and tracks execution context
 */

import { Plugin } from '@remixproject/engine';
import { GenerationPlan, FileNode } from '../types/mcpTools';
import { v4 as uuidv4 } from 'uuid';

export class PlanStore {
  private static instance: PlanStore;
  private plans: Map<string, GenerationPlan> = new Map();
  private executionState: Map<string, Record<string, string>> = new Map();
  private plugin: Plugin;

  private constructor(plugin: Plugin) {
    this.plugin = plugin;
  }

  static getInstance(plugin: Plugin): PlanStore {
    if (!PlanStore.instance) {
      PlanStore.instance = new PlanStore(plugin);
    }
    return PlanStore.instance;
  }

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

  getPlan(planId: string): GenerationPlan | undefined {
    return this.plans.get(planId);
  }

  updatePlan(planId: string, updates: Partial<GenerationPlan>): void {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan with ID ${planId} not found`);
    }

    const updatedPlan = { ...plan, ...updates };
    this.plans.set(planId, updatedPlan);
  }

  deletePlan(planId: string): void {
    this.plans.delete(planId);
    this.executionState.delete(planId);
  }

  listPlans(): GenerationPlan[] {
    return Array.from(this.plans.values());
  }

  initializeExecution(planId: string): void {
    const plan = this.plans.get(planId);
    if (!plan) {
      throw new Error(`Plan with ID ${planId} not found`);
    }

    this.executionState.set(planId, {});

    this.updatePlan(planId, { status: 'executing', generatedFiles: 0 });
  }

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

  getGeneratedFiles(planId: string): Record<string, string> {
    return this.executionState.get(planId) || {};
  }

  clear(): void {
    this.plans.clear();
    this.executionState.clear();
  }

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
