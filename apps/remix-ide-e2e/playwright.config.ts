import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright configuration for Remix IDE E2E tests.
 *
 * Usage:
 *   npx playwright test                          # Run all tests
 *   npx playwright test --grep "terminal"        # Run tests matching pattern
 *   npx playwright test --project=chromium       # Run in specific browser
 *   npx playwright codegen http://127.0.0.1:8080 # Record a new test
 *
 * See: https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './src/playwright-tests',
  outputDir: '../../reports/playwright-results',

  /* Maximum time one test can run */
  timeout: 120_000,

  /* Expect timeout for assertions */
  expect: {
    timeout: 10_000,
  },

  /* Run tests sequentially in CI for stability, parallel locally */
  fullyParallel: false,

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry failed tests */
  retries: process.env.CI ? 1 : 0,

  /* Limit parallel workers */
  workers: process.env.CI ? 1 : 1,

  /* Reporter to use */
  reporter: process.env.CI
    ? [
        ['list'],
        ['junit', { outputFile: '../../reports/playwright-results/junit.xml' }],
        ['html', { outputFolder: '../../reports/playwright-html', open: 'never' }],
      ]
    : [
        ['list'],
        ['html', { outputFolder: '../../reports/playwright-html', open: 'on-failure' }],
      ],

  /* Shared settings for all the projects below */
  use: {
    /* Base URL for navigation actions */
    baseURL: process.env.REMIX_URL || 'http://127.0.0.1:8080',

    /* Collect trace on failure for debugging */
    trace: 'on-first-retry',

    /* Capture screenshot on failure */
    screenshot: 'only-on-failure',

    /* Record video on failure */
    video: 'on-first-retry',

    /* Viewport matching existing Nightwatch config */
    viewport: { width: 2560, height: 1440 },

    /* Action timeout */
    actionTimeout: 10_000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 2560, height: 1440 },
        launchOptions: {
          args: [
            '--disable-gpu',
            '--disable-dev-shm-usage',
          ],
        },
      },
    },
    // Uncomment to test on Firefox:
    // {
    //   name: 'firefox',
    //   use: {
    //     ...devices['Desktop Firefox'],
    //     viewport: { width: 2560, height: 1440 },
    //   },
    // },
  ],

  /* Run a local dev server before starting tests (if not already running) */
  webServer: process.env.CI
    ? undefined  // In CI the server is started separately
    : {
        command: 'cd ../.. && yarn serve',
        url: 'http://127.0.0.1:8080',
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
