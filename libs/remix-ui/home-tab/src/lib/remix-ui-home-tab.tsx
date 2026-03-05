import React, { useContext, useState, useEffect } from 'react'
import './remix-ui-home-tab.css'
import { ThemeContext, themes } from './themeContext'
import HomeTabTitle from './components/homeTabTitle'
import HomeTabRecentWorkspaces from './components/homeTabRecentWorkspaces'
import HomeTabRecentWorkspacesElectron from './components/homeTabRecentWorkspacesElectron'
import HomeTabScamAlert from './components/homeTabScamAlert'
import HomeTabFeaturedPlugins from './components/homeTabFeaturedPlugins'
import { appActionTypes, AppContext, appPlatformTypes, platformContext } from '@remix-ui/app'
import { HomeTabEvent, MatomoEvent } from '@remix-api'
import { TrackingContext } from '@remix-ide/tracking'
import { HomeTabFileElectron } from './components/homeTabFileElectron'
import HomeTabUpdates from './components/homeTabUpdates'
import { FormattedMessage } from 'react-intl'
// import { desktopConnectionType } from '@remix-api'
import { desktopConnectionType } from '@remix-api'

export interface RemixUiHomeTabProps {
  plugin: any
}

// --- Main Layout ---
export const RemixUiHomeTab = (props: RemixUiHomeTabProps) => {
  const platform = useContext(platformContext)
  const appContext = useContext(AppContext)
  const { trackMatomoEvent: baseTrackEvent } = useContext(TrackingContext)
  const { plugin } = props

  // Component-specific tracker with default HomeTabEvent type
  const trackMatomoEvent = <T extends MatomoEvent = HomeTabEvent>(event: T) => {
    baseTrackEvent?.<T>(event)
  }

  const [state, setState] = useState<{
    themeQuality: { filter: string; name: string }
  }>({
    themeQuality: themes.light
  })

  const [isTerminalHidden, setIsTerminalHidden] = useState<boolean>(false)

  useEffect(() => {
    plugin.call('theme', 'currentTheme').then((theme) => {
      // update theme quality. To be used for for images
      setState((prevState) => {
        return {
          ...prevState,
          themeQuality: theme.quality === 'dark' ? themes.dark : themes.light
        }
      })
    })
    plugin.on('theme', 'themeChanged', (theme) => {
      // update theme quality. To be used for for images
      setState((prevState) => {
        return {
          ...prevState,
          themeQuality: theme.quality === 'dark' ? themes.dark : themes.light
        }
      })
    })

    // Listen to terminal panel visibility events
    plugin.call('terminal', 'isPanelHidden').then((hidden) => {
      setIsTerminalHidden(hidden)
    })
    plugin.on('terminal', 'terminalPanelShown', () => {
      setIsTerminalHidden(false)
    })
    plugin.on('terminal', 'terminalPanelHidden', () => {
      setIsTerminalHidden(true)
    })
  }, [])

  const startLearnEth = async () => {
    if (await plugin.appManager.isActive('LearnEth')) {
      plugin.verticalIcons.select('LearnEth')
    } else {
      await plugin.appManager.activatePlugin(['LearnEth', 'solidity', 'solidityUnitTesting'])
      plugin.verticalIcons.select('LearnEth')
    }
    trackMatomoEvent({
      category: 'hometab',
      action: 'header',
      name: 'Start Learning',
      isClick: true
    })
  }

  const openTemplateSelection = async () => {
    await plugin.call('templateexplorermodal', 'updateTemplateExplorerInFileMode', false)
    appContext.appStateDispatch({
      type: appActionTypes.showGenericModal,
      payload: true
    })
    trackMatomoEvent({
      category: 'hometab',
      action: 'header',
      name: 'Create a new workspace',
      isClick: true
    })
  }

  // if (appContext.appState.connectedToDesktop != desktopConnectionType.disabled) {
  //   return (<></>)
  // }

  return (
    <div className="flex flex-col w-full" data-id="remixUIHTAll">
      <ThemeContext.Provider value={state.themeQuality}>
        <div className="w-full">
          <div className="flex flex-wrap">
            <div className="flex w-full m-4 justify-end">
              <button className="btn btn-secondary btn-md me-4" onClick={startLearnEth}><i className="fa-solid fa-book me-1"></i><FormattedMessage id="home.startLearning" /></button>
              <button data-id="landingPageImportFromTemplate" className="btn btn-primary btn-md me-2" onClick={openTemplateSelection}><i className="fa-solid fa-plus me-1"></i><FormattedMessage id="home.createNewWorkspace" /></button>
            </div>
            <div className="lg:w-2/3 xl:w-5/12 sm:w-full mb-6">
              <HomeTabTitle />
              {!(platform === appPlatformTypes.desktop) ? <HomeTabRecentWorkspaces plugin={plugin} /> : <HomeTabRecentWorkspacesElectron plugin={plugin} />}
            </div>
            <div className="lg:w-1/3 xl:w-7/12 sm:w-full" style={{ overflowY: 'auto', maxHeight: isTerminalHidden ? '85vh' : '61vh' }}>
              <HomeTabUpdates plugin={plugin} />
              <HomeTabFeaturedPlugins plugin={plugin} />
            </div>
          </div>
        </div>
      </ThemeContext.Provider>
    </div>
  )
}

export default RemixUiHomeTab
