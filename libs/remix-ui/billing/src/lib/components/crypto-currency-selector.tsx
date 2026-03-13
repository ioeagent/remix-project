import React, { useState } from 'react'
import type { CryptoCurrency } from '@remix-api'

export interface CryptoCurrencySelectorProps {
  productName: string
  priceCents: number
  onSelect: (currency: CryptoCurrency) => void
  onCancel: () => void
}

export const CryptoCurrencySelector: React.FC<CryptoCurrencySelectorProps> = ({
  productName,
  priceCents,
  onSelect,
  onCancel
}) => {
  const [selected, setSelected] = useState<CryptoCurrency>('USDC')
  const priceDisplay = `$${(priceCents / 100).toFixed(2)}`

  return (
    <div className="crypto-currency-selector">
      <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}></div>
      <div className="modal d-block" style={{ zIndex: 1051 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered modal-sm">
          <div className="modal-content">
            <div className="modal-header border-bottom">
              <h6 className="modal-title">Select Currency</h6>
              <button type="button" className="btn-close" onClick={onCancel}></button>
            </div>
            <div className="modal-body">
              <p className="text-muted small mb-3">
                <strong>{productName}</strong> — {priceDisplay}
              </p>
              <div className="d-flex flex-column gap-2">
                <button
                  className={`btn ${selected === 'USDC' ? 'btn-primary' : 'btn-outline-secondary'} text-start p-3`}
                  onClick={() => setSelected('USDC')}
                  data-id="crypto-currency-usdc"
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <strong>USDC</strong>
                      <small className="d-block text-muted">Stablecoin — exact USD value ({priceDisplay})</small>
                    </div>
                    {selected === 'USDC' && <i className="fas fa-check"></i>}
                  </div>
                </button>
                <button
                  className={`btn ${selected === 'ETH' ? 'btn-primary' : 'btn-outline-secondary'} text-start p-3`}
                  onClick={() => setSelected('ETH')}
                  data-id="crypto-currency-eth"
                >
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <strong>ETH</strong>
                      <small className="d-block text-muted">Price locked for 60 minutes</small>
                    </div>
                    {selected === 'ETH' && <i className="fas fa-check"></i>}
                  </div>
                </button>
              </div>
            </div>
            <div className="modal-footer border-top">
              <button className="btn btn-outline-secondary" onClick={onCancel}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => onSelect(selected)}
                data-id="crypto-currency-confirm"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
