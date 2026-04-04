import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import { MCPClient } from '../../inferencers/mcp/mcpClient';
import { IMCPTool, IMCPToolResult } from '../../types/mcp';

/**
 * Service for converting MCP tools to LangChain DynamicStructuredTool format
 * This enables native LangChain tool execution without legacy MCPInferencer logic
 */
export class MCPToolConverter {
  constructor(private mcpClients: Map<string, MCPClient>) {}

  /**
   * Get all available MCP tools converted to LangChain format
   * @returns Array of LangChain DynamicStructuredTool instances
   */
  async getAllTools(): Promise<DynamicStructuredTool[]> {
    const langchainTools: DynamicStructuredTool[] = [];

    for (const [serverName, client] of this.mcpClients) {
      if (!client.isConnected()) {
        console.log(`[MCPToolConverter] Skipping disconnected server: ${serverName}`);
        continue;
      }

      try {
        const mcpTools = await client.listTools();
        console.log(`[MCPToolConverter] Found ${mcpTools.length} tools from ${serverName}`);

        for (const mcpTool of mcpTools) {
          try {
            const tool = this.convertMCPToolToLangChain(mcpTool, serverName, client);
            langchainTools.push(tool);
          } catch (error) {
            console.warn(`[MCPToolConverter] Failed to convert tool ${mcpTool.name}:`, error);
          }
        }
      } catch (error) {
        console.warn(`[MCPToolConverter] Failed to list tools from ${serverName}:`, error);
      }
    }

    console.log(`[MCPToolConverter] Converted ${langchainTools.length} tools total`);
    return langchainTools;
  }

  /**
   * Convert a single MCP tool to LangChain DynamicStructuredTool
   */
  private convertMCPToolToLangChain(
    mcpTool: IMCPTool,
    serverName: string,
    client: MCPClient
  ): DynamicStructuredTool {
    // Prefix tool name with server name to avoid conflicts
    const toolName = `${mcpTool.name}`;
    const description = mcpTool.description || `Execute ${mcpTool.name} from ${serverName}`;

    // Convert MCP input schema (JSON Schema) to Zod schema
    const zodSchema = this.convertJSONSchemaToZod(mcpTool.inputSchema);

    // Create LangChain tool with execution function
    const tool = new DynamicStructuredTool({
      name: toolName,
      description,
      schema: zodSchema,
      func: async (input: any) => {
        try {
          console.log(`[MCPToolConverter] Executing tool ${mcpTool.name} with input:`, input);

          // Execute the MCP tool via the client
          const result: IMCPToolResult = await client.callTool({
            name: mcpTool.name,
            arguments: input
          });

          // Format result as string for LangChain
          return this.formatMCPResult(result);
        } catch (error) {
          const errorMsg = `Error executing tool ${mcpTool.name}: ${error.message || String(error)}`;
          console.error(`[MCPToolConverter] ${errorMsg}`);
          return errorMsg;
        }
      }
    });

    return tool;
  }

  /**
   * Convert JSON Schema (from MCP) to Zod schema (for LangChain)
   */
  private convertJSONSchemaToZod(inputSchema: any): z.ZodObject<any> {
    if (!inputSchema || !inputSchema.properties) {
      return z.object({});
    }

    const zodFields: Record<string, z.ZodTypeAny> = {};

    for (const [key, prop] of Object.entries(inputSchema.properties)) {
      const propSchema = prop as any;
      let zodType: z.ZodTypeAny;

      // Convert based on JSON Schema type
      switch (propSchema.type) {
        case 'string':
          zodType = z.string();
          break;
        case 'number':
        case 'integer':
          zodType = z.number();
          break;
        case 'boolean':
          zodType = z.boolean();
          break;
        case 'array':
          if (propSchema.items) {
            // Try to infer array item type
            const itemType = this.convertJSONSchemaTypeToZod(propSchema.items);
            zodType = z.array(itemType);
          } else {
            zodType = z.array(z.any());
          }
          break;
        case 'object':
          zodType = z.record(z.any());
          break;
        default:
          zodType = z.any();
      }

      // Add description if available
      if (propSchema.description) {
        zodType = zodType.describe(propSchema.description);
      }

      // Mark as optional if not in required array
      const required = inputSchema.required || [];
      if (!required.includes(key)) {
        zodType = zodType.optional();
      }

      zodFields[key] = zodType;
    }

    return z.object(zodFields);
  }

  /**
   * Helper to convert individual JSON Schema type to Zod
   */
  private convertJSONSchemaTypeToZod(schema: any): z.ZodTypeAny {
    if (!schema || !schema.type) {
      return z.any();
    }

    switch (schema.type) {
      case 'string':
        return z.string();
      case 'number':
      case 'integer':
        return z.number();
      case 'boolean':
        return z.boolean();
      case 'array':
        return z.array(z.any());
      case 'object':
        return z.record(z.any());
      default:
        return z.any();
    }
  }

  /**
   * Format MCP tool result as string for LangChain
   */
  private formatMCPResult(result: IMCPToolResult): string {
    if (!result) {
      return 'Tool executed successfully (no output)';
    }

    // If result has content array
    if (result.content && Array.isArray(result.content)) {
      return result.content
        .map((item: any) => {
          if (typeof item === 'string') {
            return item;
          }
          if (item && typeof item === 'object') {
            if (item.text) return item.text;
            if (item.type === 'text' && item.text) return item.text;
            return JSON.stringify(item);
          }
          return String(item);
        })
        .join('\n');
    }

    // If result is an error
    if (result.isError) {
      return `Error: ${JSON.stringify(result)}`;
    }

    // Fallback to JSON stringification
    return JSON.stringify(result, null, 2);
  }

  /**
   * Get tools from a specific server
   */
  async getToolsFromServer(serverName: string): Promise<DynamicStructuredTool[]> {
    const client = this.mcpClients.get(serverName);
    if (!client || !client.isConnected()) {
      return [];
    }

    try {
      const mcpTools = await client.listTools();
      return mcpTools.map(tool => this.convertMCPToolToLangChain(tool, serverName, client));
    } catch (error) {
      console.warn(`[MCPToolConverter] Failed to get tools from ${serverName}:`, error);
      return [];
    }
  }
}
