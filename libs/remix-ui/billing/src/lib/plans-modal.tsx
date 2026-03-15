import React, { useState, useEffect } from 'react'
import { BillingManager } from './billing-manager'
import './plans-modal.css'

export interface PlansOverlayProps {
  plugin: any
  onClose: () => void
}

export const PlansOverlay: React.FC<PlansOverlayProps> = ({ plugin, onClose }) => {
  const [paddleConfig, setPaddleConfig] = useState<{ clientToken: string | null; environment: 'sandbox' | 'production' } | null>(null)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const config = await plugin?.call('auth', 'getPaddleConfig')
        setPaddleConfig(config)
      } catch (err) {
        console.log('[PlansModal] Could not load Paddle config:', err)
      }
    }
    loadConfig()
  }, [plugin])

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div className="plans-modal-backdrop" onClick={onClose}>
      <div className="plans-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="plans-modal-header">
          <h5 className="plans-modal-title">
            <i className="fas fa-rocket me-2" style={{ color: '#6366f1' }}></i>
            Plans & Pricing
          </h5>
          <button className="plans-modal-close" onClick={onClose} aria-label="Close">
            <i className="fas fa-times"></i>
          </button>
        </div>
        <div className="plans-modal-body">
          <BillingManager
            plugin={plugin}
            paddleClientToken={paddleConfig?.clientToken || undefined}
            paddleEnvironment={paddleConfig?.environment || 'sandbox'}
            onPurchaseComplete={() => {
              try { plugin?.call('auth', 'refreshCredits') } catch { /* */ }
            }}
          />
        </div>
      </div>
    </div>
  )
}
