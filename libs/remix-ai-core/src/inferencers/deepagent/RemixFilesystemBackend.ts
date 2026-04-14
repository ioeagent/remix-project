/**
 * Remix Filesystem Backend for DeepAgent
 * Implements BackendProtocol to bridge DeepAgent with Remix FileManager
 */

import { Plugin } from '@remixproject/engine'
import EventEmitter from 'events'
import { ToolApprovalRequest, ToolApprovalResponse } from '../../types/humanInTheLoop'

// File size limit for auto-summarization (100KB)
const MAX_FILE_SIZE = 100 * 1024

interface EditInstruction {
  oldText: string
  newText: string
}

/**
 * RemixFilesystemBackend implements the BackendProtocol interface
 * to allow DeepAgent to interact with Remix's filesystem
 */
export class RemixFilesystemBackend {
  private plugin: Plugin
  private workspaceRoot: string = '/'
  private eventEmitter: EventEmitter | null = null
  private pendingApprovals = new Map<string, (result: { approved: boolean; modifiedContent?: string }) => void>()

  constructor(plugin: Plugin, eventEmitter?: EventEmitter) {
    this.plugin = plugin
    if (eventEmitter) {
      this.eventEmitter = eventEmitter
      this.eventEmitter.on('onToolApprovalResponse', (response: ToolApprovalResponse) => {
        console.log('[HITL] Backend received approval response:', response.requestId, response.approved, response.modifiedArgs ? '(edited)' : '')
        const resolve = this.pendingApprovals.get(response.requestId)
        if (resolve) {
          resolve({
            approved: response.approved,
            modifiedContent: response.modifiedArgs?.content
          })
          this.pendingApprovals.delete(response.requestId)
        }
      })
    }
  }

  // deepagents library expects write() to return { error?, metadata?, filesUpdate? }
  async write(path: string, content: string): Promise<{ error?: string; metadata?: any; filesUpdate?: any }> {
    try {
      await this.write_file(path, content)
      return {}
    } catch (err) {
      return { error: err.message }
    }
  }

  // deepagents library calls read(path, offset, limit)
  async read(path: string, offset?: number, limit?: number): Promise<string> {
    const content = await this.read_file(path)
    if (offset !== undefined || limit !== undefined) {
      const lines = content.split('\n')
      const start = offset || 0
      const end = limit ? start + limit : lines.length
      return lines.slice(start, end).join('\n')
    }
    return content
  }

  // deepagents library calls edit(path, old_string, new_string, replace_all)
  async edit(
    filePath: string, oldString: string, newString: string, replaceAll = false
  ): Promise<{ error?: string; occurrences?: number; metadata?: any; filesUpdate?: any }> {
    try {
      const content = await this.read_file(filePath)
      if (!content.includes(oldString)) {
        return { error: `Text not found in file: "${oldString.substring(0, 50)}..."` }
      }
      const updated = replaceAll
        ? content.split(oldString).join(newString)
        : content.replace(oldString, newString)
      const occurrences = replaceAll
        ? (content.split(oldString).length - 1)
        : 1
      await this.write_file(filePath, updated)
      return { occurrences }
    } catch (err) {
      return { error: err.message }
    }
  }

  /**
   * Get current working directory
   */
  async cwd(): Promise<string> {
    try {
      // Try to get the current file's directory
      const currentFile = await this.plugin.call('fileManager', 'getCurrentFile')
      if (currentFile) {
        const lastSlash = currentFile.lastIndexOf('/')
        if (lastSlash > 0) {
          return currentFile.substring(0, lastSlash)
        }
      }
    } catch (e) {
      // Fallback to workspace root
    }
    return this.workspaceRoot
  }

  /**
   * Read file contents
   * Auto-summarizes files larger than 100KB
   */
  async read_file(path: string): Promise<string> {
    try {
      console.log(`[RemixFilesystemBackend] Reading file: ${path}`)
      const normalizedPath = path //this.normalizePath(path)
      const exists = await this.plugin.call('fileManager', 'exists', normalizedPath)
      console.log(`[RemixFilesystemBackend] File exists: ${exists}`)

      if (!exists) {
        throw new Error(`File not found: ${path}`)
      }

      const content = await this.plugin.call('fileManager', 'readFile', normalizedPath)

      // Check file size and summarize if too large
      if (content.length > MAX_FILE_SIZE) {
        return this.summarizeFile(normalizedPath, content)
      }

      return content
    } catch (error) {
      throw new Error(`Failed to read file ${path}: ${error.message}`)
    }
  }

  /**
   * Write file contents
   * Shows diff to user for approval before writing
   */
  async write_file(path: string, content: string): Promise<void> {
    try {
      console.log(`[HITL] write_file called for: ${path}`)
      const normalizedPath = path
      const exists = await this.plugin.call('fileManager', 'exists', normalizedPath)

      let oldContent = ''
      if (exists) {
        oldContent = await this.plugin.call('fileManager', 'readFile', normalizedPath)
      }

      // Request approval before writing
      const result = await this.requestWriteApproval(normalizedPath, oldContent, content)
      if (!result.approved) {
        console.log(`[HITL] User rejected write to: ${path}`)
        throw new Error(`User rejected file write to ${path}`)
      }

      const finalContent = result.modifiedContent || content
      console.log(`[HITL] User approved write to: ${path}${result.modifiedContent ? ' (with edits)' : ''}`)

      await this.plugin.call('fileManager', 'writeFile', normalizedPath, finalContent)
      console.log(`[HITL] File written successfully: ${path}`)
    } catch (error) {
      console.error(`[HITL] Error writing file ${path}:`, error)
      throw new Error(`Failed to write file ${path}: ${error}`)
    }
  }

  /**
   * Edit file with search/replace operations
   */
  async edit_file(path: string, edits: EditInstruction[]): Promise<void> {
    try {
      const normalizedPath = this.normalizePath(path)
      let content = await this.read_file(normalizedPath)

      // Apply each edit instruction
      for (const edit of edits) {
        const { oldText, newText } = edit

        // Check if oldText exists in content
        if (!content.includes(oldText)) {
          throw new Error(`Text not found in file: "${oldText.substring(0, 50)}..."`)
        }

        // Replace the text
        content = content.replace(oldText, newText)
      }

      // Write the edited content
      await this.write_file(normalizedPath, content)
    } catch (error) {
      throw new Error(`Failed to edit file ${path}: ${error.message}`)
    }
  }

  /**
   * List directory contents
   */
  async ls(path?: string): Promise<string[]> {
    try {
      const targetPath = path ? this.normalizePath(path) : await this.cwd()

      const exists = await this.plugin.call('fileManager', 'exists', targetPath)
      if (!exists) {
        throw new Error(`Path not found: ${targetPath}`)
      }

      const isDir = await this.plugin.call('fileManager', 'isDirectory', targetPath)
      if (!isDir) {
        throw new Error(`Not a directory: ${targetPath}`)
      }

      const files = await this.plugin.call('fileManager', 'readdir', targetPath)
      return Object.keys(files).map(name => {
        const fullPath = `${targetPath}/${name}`.replace('//', '/')
        return files[name].isDirectory ? `${name}/` : name
      })
    } catch (error) {
      throw new Error(`Failed to list directory ${path || 'cwd'}: ${error.message}`)
    }
  }

  async lsInfo(path?: string): Promise<{ path: string, is_dir: boolean, size?: number }[]> {
    try {
      const targetPath = path ? this.normalizePath(path) : await this.cwd()

      const exists = await this.plugin.call('fileManager', 'exists', targetPath)
      if (!exists) {
        throw new Error(`Path not found: ${targetPath}`)
      }

      const isDir = await this.plugin.call('fileManager', 'isDirectory', targetPath)
      if (!isDir) {
        throw new Error(`Not a directory: ${targetPath}`)
      }

      const files = await this.plugin.call('fileManager', 'readdir', targetPath)
      return Object.keys(files).map(name => ({
        path: `${targetPath}/${name}`.replace('//', '/'),
        is_dir: files[name].isDirectory
      }))
    } catch (error) {
      throw new Error(`Failed to list directory info for ${path || 'cwd'}: ${error.message}`)
    }
  }

  /**
   * Create a new directory
   */
  async mkdir(path: string): Promise<void> {
    try {
      const normalizedPath = this.normalizePath(path)
      await this.plugin.call('fileManager', 'mkdir', normalizedPath)
    } catch (error) {
      throw new Error(`Failed to create directory ${path}: ${error.message}`)
    }
  }

  /**
   * Normalize file path to Remix workspace format
   */
  private normalizePath(path: string): string {
    // Remove leading ./ or ../
    let normalized = path.replace(/^\.\//, '').replace(/^\.\.\//, '')

    // Ensure path starts with /browser or is absolute
    if (!normalized.startsWith('/')) {
      normalized = `${this.workspaceRoot}/${normalized}`
    }

    // Remove double slashes
    normalized = normalized.replace(/\/\//g, '/')

    return normalized
  }

  /**
   * Summarize large files to prevent context overflow
   */
  private summarizeFile(path: string, content: string): string {
    const ext = path.substring(path.lastIndexOf('.') + 1).toLowerCase()

    // Special handling for Solidity files
    if (ext === 'sol') {
      return this.summarizeSolidityFile(content)
    }

    // Generic summarization
    const lines = content.split('\n')
    const summary = [
      `[File too large (${content.length} bytes), showing summary]`,
      '',
      `Total lines: ${lines.length}`,
      '',
      '=== First 50 lines ===',
      ...lines.slice(0, 50),
      '',
      '=== Last 50 lines ===',
      ...lines.slice(-50)
    ]

    return summary.join('\n')
  }

  /**
   * Smart summarization for Solidity files
   * Extracts contracts, functions, events, and key structures
   */
  private summarizeSolidityFile(content: string): string {
    const lines = content.split('\n')
    const summary: string[] = [
      '[Solidity file summary - large file auto-summarized]',
      ''
    ]

    // Extract pragma and imports
    const pragmas = lines.filter(line => line.trim().startsWith('pragma'))
    const imports = lines.filter(line => line.trim().startsWith('import'))

    if (pragmas.length > 0) {
      summary.push('=== Pragma ===')
      summary.push(...pragmas)
      summary.push('')
    }

    if (imports.length > 0) {
      summary.push('=== Imports ===')
      summary.push(...imports)
      summary.push('')
    }

    // Extract contracts, interfaces, and libraries
    const contractRegex = /^\s*(contract|interface|library)\s+(\w+)/
    const functionRegex = /^\s*function\s+(\w+)/
    const eventRegex = /^\s*event\s+(\w+)/

    let currentContract = ''
    const contracts: Record<string, { functions: string[], events: string[] }> = {}

    for (const line of lines) {
      const contractMatch = line.match(contractRegex)
      if (contractMatch) {
        currentContract = contractMatch[2]
        contracts[currentContract] = { functions: [], events: []}
        summary.push(`=== ${contractMatch[1]} ${currentContract} ===`)
      }

      if (currentContract) {
        const functionMatch = line.match(functionRegex)
        if (functionMatch) {
          contracts[currentContract].functions.push(line.trim())
        }

        const eventMatch = line.match(eventRegex)
        if (eventMatch) {
          contracts[currentContract].events.push(line.trim())
        }
      }
    }

    // Add functions and events to summary
    for (const [contractName, data] of Object.entries(contracts)) {
      if (data.functions.length > 0) {
        summary.push(`Functions in ${contractName}:`)
        summary.push(...data.functions)
        summary.push('')
      }
      if (data.events.length > 0) {
        summary.push(`Events in ${contractName}:`)
        summary.push(...data.events)
        summary.push('')
      }
    }

    summary.push(`[Total size: ${content.length} bytes, ${lines.length} lines]`)

    return summary.join('\n')
  }

  /**
   * Request user approval before writing a file.
   * If no eventEmitter is connected, auto-approves.
   */
  private async requestWriteApproval(
    path: string,
    oldContent: string,
    newContent: string
  ): Promise<{ approved: boolean; modifiedContent?: string }> {
    if (!this.eventEmitter) {
      console.log('[HITL] No eventEmitter — auto-approving write')
      return { approved: true }
    }

    const requestId = `fs_approval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    console.log('[HITL] Requesting write approval:', requestId, path)

    const request: ToolApprovalRequest = {
      requestId,
      toolName: 'write_file',
      toolArgs: { path, content: newContent },
      category: 'file_write',
      risk: 'high',
      existingContent: oldContent || undefined,
      proposedContent: newContent,
      filePath: path,
      timestamp: Date.now()
    }

    return new Promise<{ approved: boolean; modifiedContent?: string }>((resolve) => {
      this.pendingApprovals.set(requestId, resolve)
      console.log('[HITL] Emitting onToolApprovalRequired:', requestId)
      this.eventEmitter.emit('onToolApprovalRequired', request)
    })
  }
}
