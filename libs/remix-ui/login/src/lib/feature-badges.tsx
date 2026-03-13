import React, { useState } from 'react'
import { FeatureGroup } from '@remix-api'
import { useAuth } from '../../../app/src/lib/remix-app/context/auth-context'
import { BetaInfoModal } from './modals/beta-info-modal'
import './feature-badges.css'

interface FeatureBadgesProps {
  plugin?: any
  onClose?: () => void
}

const BADGE_CONFIG: Record<string, { icon: string; colorClass: string }> = {
  'beta': { icon: 'fas fa-flask', colorClass: 'feature-badge--beta' },
  'AI BASIC': { icon: 'fas fa-robot', colorClass: 'feature-badge--ai' },
  'ai-unlimited': { icon: 'fas fa-infinity', colorClass: 'feature-badge--ai-unlimited' },
}

const getDefaultBadgeConfig = (name: string) => ({
  icon: 'fas fa-star',
  colorClass: 'feature-badge--default'
})

export const FeatureBadges: React.FC<FeatureBadgesProps> = ({ plugin, onClose }) => {
  const { featureGroups } = useAuth()
  const [showBetaModal, setShowBetaModal] = useState(false)

  const groups = featureGroups || []

  const handleBadgeClick = (group: FeatureGroup) => {
    if (group.name === 'beta') {
      setShowBetaModal(true)
    }
  }

  return (
    <>
      <div className="feature-badges-section">
        <div className="feature-badges-label">Your Plan</div>
        <div className="feature-badges-list">
          {groups.map((group) => {
            const config = BADGE_CONFIG[group.name] || getDefaultBadgeConfig(group.name)
            const isClickable = group.name === 'beta'

            return (
              <div
                key={group.name}
                className={`feature-badge ${config.colorClass} ${isClickable ? 'feature-badge--clickable' : ''}`}
                title={group.description}
                onClick={isClickable ? () => handleBadgeClick(group) : undefined}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
              >
                <i className={`${config.icon} feature-badge-icon`}></i>
                <span data-id={`feature-badge-name-${group.name}`} className="feature-badge-name">{group.display_name}</span>
                {isClickable && <i className="fas fa-chevron-right feature-badge-arrow"></i>}
              </div>
            )
          })}
          <button
            className="feature-badge feature-badge--upgrade feature-badge--clickable"
            onClick={() => { plugin?.call('plans', 'open'); onClose?.() }}
          >
            <i className="fas fa-rocket feature-badge-icon"></i>
            <span className="feature-badge-name">Upgrade</span>
            <i className="fas fa-chevron-right feature-badge-arrow"></i>
          </button>
        </div>
      </div>
      <div className="dropdown-divider user-menu-divider"></div>

      {showBetaModal && (
        <BetaInfoModal
          onClose={() => {
            setShowBetaModal(false)
          }}
          plugin={plugin}
        />
      )}
    </>
  )
}
