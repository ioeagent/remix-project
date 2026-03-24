/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useContext, useEffect, useState } from 'react'
import { ThemeContext } from '../themeContext'
import axios from 'axios'
import { HOME_TAB_BASE_URL, HOME_TAB_NEW_UPDATES } from './constant'
import { LoadingCard } from './LoaderPlaceholder'
import { UpdateInfo } from './types/carouselTypes'
import { HomeTabEvent, MatomoEvent } from '@remix-api'
import { TrackingContext } from '@remix-ide/tracking'
import { FirstTimeUserCard } from './firstTimeUserCard'

interface HomeTabUpdatesProps {
  plugin: any
}

// exportinterface UpdateInfo {
//   badge: string
//   title: string
//   description: string
//   descriptionList?: string[]
//   icon: string
//   action: {
//     type: 'link' | 'methodCall'
//     label: string
//     url?: string
//     pluginName?: string
//     pluginMethod?: string,
//     pluginArgs?: (string | number | boolean | object | null)[]
//   },
//   theme: string
// }

function HomeTabUpdates({ plugin }: HomeTabUpdatesProps) {
  const [selectedUpdate, setSelectedUpdate] = useState<UpdateInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showFirstTime, setShowFirstTime] = useState(false)
  const theme = useContext(ThemeContext)
  const { trackMatomoEvent: baseTrackEvent } = useContext(TrackingContext)
  const isDark = theme.name === 'dark'

  // Component-specific tracker with default HomeTabEvent type
  const trackMatomoEvent = <T extends MatomoEvent = HomeTabEvent>(event: T) => {
    baseTrackEvent?.<T>(event)
  }

  useEffect(() => {
    async function getLatestUpdates() {
      try {
        setIsLoading(true)
        const response = await axios.get(HOME_TAB_NEW_UPDATES)
        const updates = response.data

        // Check if this is the first time visiting
        const hasVisitedHomeBefore = localStorage.getItem('remix-home-visited')
        const isFirstTime = !hasVisitedHomeBefore

        if (isFirstTime) {
          localStorage.setItem('remix-home-visited', 'true')
        }

        // Create array including first-time option and regular updates
        const allOptions = []

        // Add first-time card option (higher weight for first-time users)
        if (isFirstTime) {
          setShowFirstTime(true)
          setSelectedUpdate(null)
          setIsLoading(false)
          return
        } else {
          // Still include as option for returning users
          allOptions.push('first-time', 'first-time')
        }

        // Add regular updates if available
        if (updates && updates.length > 0) {
          allOptions.push(...updates)
        }

        // Randomly select from all options
        if (allOptions.length > 0) {
          const randomIndex = Math.floor(Math.random() * allOptions.length)
          const selected = allOptions[randomIndex]

          if (selected === 'first-time') {
            setShowFirstTime(true)
            setSelectedUpdate(null)
          } else {
            setShowFirstTime(false)
            setSelectedUpdate(selected)
          }
        }

        setIsLoading(false)
      } catch (error) {
        console.error('Error fetching plugin list:', error)
        setIsLoading(false)
      }
    }
    getLatestUpdates()
  }, [])

  const handleUpdatesActionClick = (updateInfo: UpdateInfo) => {
    trackMatomoEvent({
      category: 'hometab',
      action: 'updatesActionClick',
      name: updateInfo.title,
      isClick: true
    })
    if (updateInfo.action.type === 'link') {
      window.open(updateInfo.action.url, '_blank')
    } else if (updateInfo.action.type === 'methodCall') {
      plugin.call(updateInfo.action.pluginName, updateInfo.action.pluginMethod, updateInfo.action.pluginArgs)
    }
  }

  function UpdateCard(updateInfo: UpdateInfo) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg h-full flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow">
        <div>
          <div className="flex items-center p-3 overflow-hidden justify-between h-20 bg-body">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-light border text-${updateInfo.theme} bg-transparent`} style={{ border: `1px solid var(--${updateInfo.theme})` }}>{updateInfo.badge}</span>
            { updateInfo.icon ? <img src={`${HOME_TAB_BASE_URL + updateInfo.icon}`} alt="RemixAI Assistant" className="h-36 w-36" />
              : <img src={`${HOME_TAB_BASE_URL + 'images/illusion.svg'}`} alt="RemixAI Assistant" className="h-36 w-36" />
            }
          </div>
          <div className="px-3 text-base relative z-10">
            <span className="block my-2 text-black dark:text-white font-medium">
              {updateInfo.title}
            </span>
            {Array.isArray(updateInfo.descriptionList) && updateInfo.descriptionList.length > 0 ? (
              <div className="mb-3 text-sm">
                <ul className="list-none space-y-1">
                  {updateInfo.descriptionList.map((description: string, index: number) => (
                    <li key={`description-${index}`} className='flex items-start'><i className="far fa-check-circle mr-2 text-success mt-0.5 flex-shrink-0"></i><span className="text-gray-700 dark:text-gray-300">{description}</span></li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="mb-3 text-sm text-gray-700 dark:text-gray-300">{updateInfo.description}</div>
            )}
          </div>
        </div>
        <div className="px-3 pb-3">
          <button className={`w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-600 rounded-md text-sm font-medium transition-colors ${updateInfo.theme !== 'primary' ? `text-${updateInfo.theme}` : 'text-gray-700 dark:text-gray-200'}`} onClick={() => handleUpdatesActionClick(updateInfo)}>
            {updateInfo.action.label}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="">
      {isLoading ? (
        <div className="">
          <LoadingCard />
        </div>
      ) : showFirstTime ? (
        <div className="">
          <FirstTimeUserCard plugin={plugin} />
        </div>
      ) : selectedUpdate ? (
        <div className="">
          {UpdateCard(selectedUpdate)}
        </div>
      ) : null}
    </div>
  )
}

export default HomeTabUpdates
