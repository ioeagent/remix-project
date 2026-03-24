import React, { useContext } from 'react'
import { ThemeContext } from '../themeContext'
import { HomeTabEvent, MatomoEvent } from '@remix-api'
import { TrackingContext } from '@remix-ide/tracking'
import { FormattedMessage } from 'react-intl'

interface FirstTimeUserCardProps {
  plugin: any
}

export const FirstTimeUserCard: React.FC<FirstTimeUserCardProps> = ({ plugin }) => {
  const theme = useContext(ThemeContext)
  const { trackMatomoEvent: baseTrackEvent } = useContext(TrackingContext)
  const isDark = theme.name === 'dark'

  // Component-specific tracker with default HomeTabEvent type
  const trackMatomoEvent = <T extends MatomoEvent = HomeTabEvent>(event: T) => {
    baseTrackEvent?.<T>(event)
  }

  const handleExplainEthereum = () => {
    trackMatomoEvent({
      category: 'hometab',
      action: 'explainEthereum',
      name: 'Explain Ethereum importance',
      isClick: true
    })
    plugin.call('rightSidePanel', 'maximizePanel')
    plugin.call('remixaiassistant', 'chatPipe', `Why Ethereum and decentralized applications are important for the future of technology and society. Give me a concise and clear explanation. Provide use cases. Propose some areas of discussion, then stop and let me ask you more questions about it.`)
  }

  const handleGetStarted = async () => {
    trackMatomoEvent({
      category: 'hometab',
      action: 'getStartedContract',
      name: 'Get started with contract',
      isClick: true
    })
    if (!await plugin.call('filePanel', 'workspaceExists', 'Introduction to ERC20 token')) await plugin.call('filePanel', 'createWorkspace', 'Introduction to ERC20 token', 'ozerc20')
    await plugin.call('filePanel', 'switchToWorkspace', { name: 'Introduction to ERC20 token', isLocalHost: false })

    plugin.call('notification', 'toast', 'Creating a new workspace and start building...')
    await new Promise((res) => setTimeout(() => res({}), 500)) // wait for the workspace to actually be created
    plugin.call('remixaiassistant', 'chatPipe', `an ERC20 token workspace has been created. Compile and Deploy MyToken. Then give precise details for interacting with that contract in Remix. Propose some next steps for me to learn more about it and experiment with it. Then stop and let me ask you more questions.`)
  }

  return (
    <div
      className="bg-white dark:bg-gray-800 border-0 h-100 shadow-lg rounded-lg"
      style={{
        background: `linear-gradient(135deg, var(--bs-body-bg) 0%, ${isDark ? '#2a2a3e' : '#f8f9ff'} 100%)`,
        borderRadius: '20px',
        minHeight: '280px'
      }}
    >
      <div className="p-4">
        {/* Welcome Header */}
        <div className="text-center mb-4">
          <h4 className="mb-2 font-bold text-black dark:text-white">
            <FormattedMessage id="homeTab.newToRemix" defaultMessage="First time in Remix? here's what you can do" />
          </h4>
        </div>

        {/* Action Cards */}
        <div className="flex flex-col gap-3">
          <div
            className="p-3 rounded-lg flex items-center justify-between shadow-sm relative overflow-hidden"
            style={{
              background: `linear-gradient(45deg, var(--bs-body-bg), ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'})`,
              backdropFilter: 'blur(10px)',
              border: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)'
              e.currentTarget.style.boxShadow = '0 15px 35px rgba(0,0,0,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)'
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)'
            }}
          >
            <div className="flex items-center flex-grow" onClick={handleExplainEthereum}>
              <div
                className="flex justify-center items-center mr-3 shadow-sm"
                style={{
                  width: '20px'
                }}
              >
                <i className="fas fa-lightbulb text-primary" style={{ color: isDark ? '#64c4ff' : 'var(--bs-primary)', fontSize: '1.2rem' }}></i>
              </div>
              <div className="flex-grow-1 pe-3">
                <h5 className="mb-2 text-black dark:text-white">
                  <FormattedMessage id="home.learnFoundationTitle" />
                </h5>
                <p className="mb-0 text-sm text-gray-600 dark:text-gray-400">
                  <FormattedMessage id="home.learnFoundationDesc" />
                </p>
              </div>
            </div>
          </div>

          <div
            className="p-3 rounded-lg flex items-center justify-between shadow-sm relative overflow-hidden"
            style={{
              background: `linear-gradient(45deg, var(--bs-body-bg), ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'})`,
              backdropFilter: 'blur(10px)',
              border: `2px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              transition: 'all 0.3s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px) scale(1.02)'
              e.currentTarget.style.boxShadow = '0 15px 35px rgba(0,0,0,0.2)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)'
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(0,0,0,0.1)'
            }}
          >
            <div className="flex items-center flex-grow" onClick={handleGetStarted}>
              <div
                className="flex justify-center items-center mr-3 shadow-sm"
                style={{
                  width: '20px'
                }}
              >
                <i className="fas fa-code text-primary" style={{ color: isDark ? '#64c4ff' : 'var(--bs-primary)', fontSize: '1.2rem' }}></i>
              </div>
              <div className="flex-grow-1 pe-3">
                <h5 className="mb-2 text-black dark:text-white">
                  <FormattedMessage id="home.buildFirstContractTitle" />
                </h5>
                <p className="mb-0 text-sm text-gray-600 dark:text-gray-400">
                  <FormattedMessage id="home.buildFirstContractDesc" />
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FirstTimeUserCard
