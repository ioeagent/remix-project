import { test as base, expect, Page } from '@playwright/test'

/**
 * Remix IDE Playwright fixtures — mirrors the Nightwatch init.ts helper.
 *
 * Usage in tests:
 *   import { test, expect } from './fixtures/remix'
 *
 *   test('my test', async ({ remixPage }) => {
 *     await remixPage.clickLaunchIcon('solidity')
 *     // ... your assertions
 *   })
 */

export interface RemixPage {
  /** The underlying Playwright Page */
  page: Page

  /** Navigate to Remix IDE and wait for it to load */
  init(options?: {
    url?: string
    preloadPlugins?: boolean
    showTerminal?: boolean
    hideToolTips?: boolean
  }): Promise<void>

  /** Click a plugin icon in the sidebar */
  clickLaunchIcon(id: string): Promise<void>

  /** Type a command in the terminal and press Enter */
  executeInTerminal(command: string): Promise<void>

  /** Wait for terminal journal to contain specific text */
  waitForTerminalText(text: string, timeout?: number): Promise<void>

  /** Create a new file in the file explorer */
  createFile(path: string, content?: string): Promise<void>

  /** Open a file from the file explorer */
  openFile(path: string): Promise<void>

  /** Click the compile button */
  compile(): Promise<void>

  /** Wait for compilation to finish */
  waitForCompilation(timeout?: number): Promise<void>

  /** Get the editor content */
  getEditorContent(): Promise<string>

  /** Set editor content */
  setEditorContent(content: string): Promise<void>
}

/**
 * Creates a RemixPage wrapper around a Playwright Page.
 */
function createRemixPage(page: Page): RemixPage {
  const remixPage: RemixPage = {
    page,

    async init(options = {}) {
      const {
        url = '/',
        preloadPlugins = true,
        showTerminal = true,
        hideToolTips = true,
      } = options

      await page.goto(url)
      await page.waitForLoadState('networkidle')

      // Wait for the IDE to load — look for the main layout
      await page.waitForSelector('[data-id="mainPanelPluginsContainer"]', {
        timeout: 30_000,
      })

      if (hideToolTips) {
        // Inject CSS to hide tooltips (same as Nightwatch init)
        await page.addStyleTag({
          content: `
            .tooltip, .popover, [role="tooltip"] { display: none !important; }
            .modal-backdrop { opacity: 0 !important; }
          `,
        })
      }

      if (showTerminal) {
        const toggleBtn = page.locator('*[data-id="toggleBottomPanelIcon"]')
        if (await toggleBtn.isVisible()) {
          const terminalWrap = page.locator('.terminal-wrap')
          const hasHiddenClass = await terminalWrap.evaluate(
            (el) => el.classList.contains('d-none')
          ).catch(() => true)
          if (hasHiddenClass) {
            await toggleBtn.click()
            await page.waitForSelector('.terminal-wrap:not(.d-none)', { timeout: 10_000 })
          }
        }
      }

      if (preloadPlugins) {
        // Activate essential plugins like the Nightwatch init
        await remixPage.clickLaunchIcon('pluginManager')
        await page.waitForTimeout(1000)

        // Activate static analysis
        const analysisBtn = page.locator(
          '[data-id="pluginManagerComponentActivateButtonsolidityStaticAnalysis"]'
        )
        if (await analysisBtn.isVisible().catch(() => false)) {
          await analysisBtn.click()
        }

        // Activate debugger
        const debuggerBtn = page.locator(
          '[data-id="pluginManagerComponentActivateButtondebugger"]'
        )
        if (await debuggerBtn.isVisible().catch(() => false)) {
          await debuggerBtn.click()
        }

        // Navigate to file panel
        await remixPage.clickLaunchIcon('filePanel')
        await page.waitForTimeout(500)

        // Open Solidity compiler and enable auto-compile
        await remixPage.clickLaunchIcon('solidity')
        const autoCompileLabel = page.locator('[for="autoCompile"]')
        if (await autoCompileLabel.isVisible().catch(() => false)) {
          const checkbox = page.locator('[data-id="compilerContainerAutoCompile"]')
          const isChecked = await checkbox.isChecked().catch(() => false)
          if (!isChecked) {
            await autoCompileLabel.click()
          }
        }
      }
    },

    async clickLaunchIcon(id: string) {
      await page.locator(`[data-id="verticalIconsKind${id}"]`).click()
      await page.waitForTimeout(500)
    },

    async executeInTerminal(command: string) {
      const terminal = page.locator('*[data-id="terminalCli"]')
      await terminal.click()
      await terminal.fill(command)
      await page.keyboard.press('Enter')
    },

    async waitForTerminalText(text: string, timeout = 60_000) {
      await page.locator('*[data-id="terminalJournal"]').filter({ hasText: text }).waitFor({
        timeout,
      })
    },

    async createFile(filePath: string, content?: string) {
      // Use the file explorer context menu or keyboard shortcut
      await remixPage.clickLaunchIcon('filePanel')
      await page.locator('[data-id="fileExplorerNewFilecreateNewFile"]').click()
      await page.waitForTimeout(500)

      // Type the filename
      const input = page.locator('[data-id="fileExplorerTreeItemInput"]')
      await input.fill(filePath)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(1000)

      if (content) {
        await remixPage.setEditorContent(content)
      }
    },

    async openFile(filePath: string) {
      await remixPage.clickLaunchIcon('filePanel')
      await page.locator(`[data-id="treeViewLi${filePath}"]`).click()
      await page.waitForTimeout(500)
    },

    async compile() {
      await remixPage.clickLaunchIcon('solidity')
      await page.locator('[data-id="compilerContainerCompileBtn"]').click()
    },

    async waitForCompilation(timeout = 60_000) {
      // Wait for the compile button to stop showing spinner
      await page
        .locator('[data-id="compilerContainerCompileBtn"]:not(.disabled)')
        .waitFor({ timeout })
    },

    async getEditorContent(): Promise<string> {
      return page.evaluate(() => {
        // Access Monaco editor content
        const editorElement = document.querySelector('.monaco-editor')
        if (!editorElement) return ''
        const model = (window as any).monaco?.editor?.getModels()?.[0]
        return model?.getValue() || ''
      })
    },

    async setEditorContent(content: string) {
      await page.evaluate((c) => {
        const model = (window as any).monaco?.editor?.getModels()?.[0]
        if (model) model.setValue(c)
      }, content)
    },
  }

  return remixPage
}

/**
 * Extended test fixture with remixPage.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/remix'
 *   test('my test', async ({ remixPage }) => { ... })
 */
export const test = base.extend<{ remixPage: RemixPage }>({
  remixPage: async ({ page }, use) => {
    const remixPage = createRemixPage(page)
    await use(remixPage)
  },
})

export { expect }
