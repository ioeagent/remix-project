# Playwright E2E Tests for Remix IDE

Record browser interactions and replay them as automated E2E tests on CircleCI.

## Quick Start

### 1. Record a test

Start the dev server first:
```bash
yarn serve
```

Then launch the Playwright recorder:
```bash
yarn playwright:record
```

This opens **two windows**:
- **Browser window** → Interact with Remix IDE as a user
- **Playwright Inspector** → Shows the generated test code in real-time

When done, copy the generated code from the Inspector panel.

### 2. Save the recorded test

Create a new file in `apps/remix-ide-e2e/src/playwright-tests/`:

```typescript
// apps/remix-ide-e2e/src/playwright-tests/my-feature.spec.ts
import { test, expect } from '@playwright/test'

test('my recorded test', async ({ page }) => {
  // Paste your recorded code here
  await page.goto('/')
  // ... recorded actions ...
})
```

**Or** use the Remix fixture for richer helpers:

```typescript
import { test, expect } from './fixtures/remix'

test('my test with helpers', async ({ remixPage }) => {
  await remixPage.init()
  await remixPage.clickLaunchIcon('solidity')
  // ... your test logic ...
})
```

### 3. Run the test locally

```bash
# Run all Playwright tests
yarn playwright:test

# Run in headed mode (see the browser)
yarn playwright:test:headed

# Run a specific test file
yarn playwright:test --grep "my-feature"

# Debug mode (step through with inspector)
yarn playwright:debug
```

### 4. View the report

```bash
yarn playwright:report
```

## Available Commands

| Command | Description |
|---------|-------------|
| `yarn playwright:record` | Open Playwright codegen recorder |
| `yarn playwright:test` | Run all Playwright tests (headless) |
| `yarn playwright:test:headed` | Run tests with visible browser |
| `yarn playwright:debug` | Run tests in debug/step mode |
| `yarn playwright:report` | Open HTML test report |

## Using the Remix Fixture

The custom fixture (`fixtures/remix.ts`) provides helpers that mirror the Nightwatch custom commands:

```typescript
import { test, expect } from './fixtures/remix'

test('example', async ({ remixPage }) => {
  // Initialize Remix IDE (loads plugins, enables auto-compile, etc.)
  await remixPage.init()

  // Navigate sidebar plugins
  await remixPage.clickLaunchIcon('solidity')
  await remixPage.clickLaunchIcon('filePanel')

  // File operations
  await remixPage.createFile('contracts/MyContract.sol', 'pragma solidity ^0.8.0;')
  await remixPage.openFile('contracts/1_Storage.sol')

  // Terminal
  await remixPage.executeInTerminal('console.log("hello")')
  await remixPage.waitForTerminalText('hello')

  // Compilation
  await remixPage.compile()
  await remixPage.waitForCompilation()

  // Editor
  const content = await remixPage.getEditorContent()
  await remixPage.setEditorContent('// new content')

  // Direct Playwright page access for anything else
  await remixPage.page.locator('[data-id="some-element"]').click()
  await expect(remixPage.page.locator('.some-class')).toBeVisible()
})
```

## File Structure

```
apps/remix-ide-e2e/
├── playwright.config.ts              # Playwright configuration
├── PLAYWRIGHT.md                     # This file
└── src/
    └── playwright-tests/
        ├── fixtures/
        │   └── remix.ts             # Custom test fixture with Remix helpers
        ├── examples/
        │   └── recorded-compile.spec.ts  # Example recorded test
        └── terminal.spec.ts          # Sample test using fixtures
```

## CI Integration

Playwright tests run automatically on CircleCI as part of the `web` workflow:

1. The `build` job builds Remix IDE and persists the dist
2. The `playwright-e2e` job:
   - Unpacks the dist
   - Installs Playwright + Chromium
   - Starts a static HTTP server
   - Runs all Playwright tests
   - Stores JUnit results + HTML report as artifacts

### Viewing CI Results

- **JUnit XML**: Available in the "Tests" tab of the CircleCI job
- **HTML Report**: Download from the "Artifacts" tab (`reports/playwright-html/`)
- **Screenshots/Videos**: Captured on failure, stored in `reports/playwright-results/`

## Tips

### Selectors
Remix uses `data-id` attributes extensively. Prefer these for stable selectors:
```typescript
await page.locator('[data-id="verticalIconsKindsolidity"]').click()
```

### Timeouts
Remix IDE can take time to load. The config already sets:
- Test timeout: 120s
- Expect timeout: 10s
- Action timeout: 10s

Adjust per-test if needed:
```typescript
test('slow test', async ({ page }) => {
  test.setTimeout(300_000) // 5 minutes
})
```

### Recording tips
- Use the **Pick locator** button in the recorder to refine selectors
- The recorder generates `data-testid`, `text=`, or CSS selectors — prefer `data-id` when available
- You can pause recording, modify selectors, and resume
- For complex interactions (drag-drop, Monaco editor), you may need to add manual steps after recording
