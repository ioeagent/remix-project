import React, { useState } from 'react'
import type { CryptoCurrency } from '@remix-api'

export type PaymentProvider = 'paddle' | 'crypto'

export interface PaymentMethodSelectorProps {
  availableProviders: string[]
  productName: string
  priceCents: number
  onSelect: (provider: PaymentProvider, currency?: CryptoCurrency) => void
  onCancel: () => void
}

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  availableProviders,
  productName,
  priceCents,
  onSelect,
  onCancel
}) => {
  const [selectedCurrency, setSelectedCurrency] = useState<CryptoCurrency>('USDC')
  const [step, setStep] = useState<'method' | 'currency'>('method')

  const hasPaddle = availableProviders.includes('paddle')
  const hasCrypto = availableProviders.includes('crypto')
  const priceDisplay = `$${(priceCents / 100).toFixed(2)}`

  if (step === 'currency') {
    return (
      <div className="payment-method-selector">
        <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}></div>
        <div className="modal d-block" style={{ zIndex: 1051 }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content">
              <div className="modal-header border-bottom">
                <h6 className="modal-title">Select Currency</h6>
                <button type="button" className="btn-close" onClick={onCancel}></button>
              </div>
              <div className="modal-body">
                <div className="d-flex flex-column gap-2">
                  <button
                    className={`btn ${selectedCurrency === 'USDC' ? 'btn-primary' : 'btn-outline-secondary'} text-start p-3`}
                    onClick={() => setSelectedCurrency('USDC')}
                    data-id="crypto-currency-usdc"
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <strong>USDC</strong>
                        <small className="d-block text-muted">Stablecoin — exact USD value ({priceDisplay})</small>
                      </div>
                      {selectedCurrency === 'USDC' && <i className="fas fa-check"></i>}
                    </div>
                  </button>
                  <button
                    className={`btn ${selectedCurrency === 'ETH' ? 'btn-primary' : 'btn-outline-secondary'} text-start p-3`}
                    onClick={() => setSelectedCurrency('ETH')}
                    data-id="crypto-currency-eth"
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <strong>ETH</strong>
                        <small className="d-block text-muted">Price locked for 60 minutes</small>
                      </div>
                      {selectedCurrency === 'ETH' && <i className="fas fa-check"></i>}
                    </div>
                  </button>
                </div>
              </div>
              <div className="modal-footer border-top">
                <button className="btn btn-outline-secondary" onClick={() => setStep('method')}>Back</button>
                <button
                  className="btn btn-primary"
                  onClick={() => onSelect('crypto', selectedCurrency)}
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

  return (
    <div className="payment-method-selector">
      <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}></div>
      <div className="modal d-block" style={{ zIndex: 1051 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered modal-sm">
          <div className="modal-content">
            <div className="modal-header border-bottom">
              <h6 className="modal-title">Choose Payment Method</h6>
              <button type="button" className="btn-close" onClick={onCancel}></button>
            </div>
            <div className="modal-body">
              <p className="text-muted small mb-3">
                <strong>{productName}</strong> — {priceDisplay}
              </p>
              <div className="d-flex flex-column gap-2">
                {hasPaddle && (
                  <button
                    className="btn btn-outline-primary text-start p-3"
                    onClick={() => onSelect('paddle')}
                    data-id="payment-method-paddle"
                  >
                    <div>
                      <i className="fas fa-credit-card me-2"></i>
                      <strong>Card / PayPal</strong>
                      <small className="d-block text-muted ms-4">via Paddle</small>
                    </div>
                  </button>
                )}
                {hasCrypto && (
                  <button
                    className="btn btn-outline-primary text-start p-3"
                    onClick={() => setStep('currency')}
                    data-id="payment-method-crypto"
                  >
                    <div>
                      <i className="fab fa-ethereum me-2"></i>
                      <strong>Pay with Crypto</strong>
                      <small className="d-block text-muted ms-4">USDC or ETH</small>
                    </div>
                  </button>
                )}
              </div>
            </div>
            <div className="modal-footer border-top">
              <button className="btn btn-outline-secondary" onClick={onCancel}>Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
