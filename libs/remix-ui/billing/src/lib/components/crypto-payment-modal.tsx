import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { CryptoChargeStatus, CryptoChargeStatusValue } from '@remix-api'
import { BillingApiService } from '@remix-api'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const QRCode = require('qrcode') as { toDataURL: (text: string, opts?: Record<string, unknown>) => Promise<string> }

export interface CryptoPaymentModalProps {
  chargeId: string
  billingApi: BillingApiService
  onComplete: () => void
  onCancel: () => void
}

const POLL_INTERVAL = 5000
const TERMINAL_STATUSES: CryptoChargeStatusValue[] = ['confirmed', 'expired', 'failed']

// USDC contract addresses per chain (6 decimals)
const USDC_CONTRACTS: Record<string, string> = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  sepolia: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  optimism: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
}

// RemixPayments contract addresses per chain
const PAYMENT_CONTRACTS: Record<string, string> = {
  sepolia: '0x28b5bF10f290A7711749bDc04dB75389b06b2049',
  // TODO: add mainnet/L2 addresses after deployment
}

// Chain IDs for wallet network switching
const CHAIN_IDS: Record<string, string> = {
  ethereum: '0x1',
  sepolia: '0xaa36a7',
  optimism: '0xa',
  arbitrum: '0xa4b1',
}

// Decimal chain IDs for EIP-681 URIs
const CHAIN_IDS_DECIMAL: Record<string, number> = {
  ethereum: 1,
  sepolia: 11155111,
  optimism: 10,
  arbitrum: 42161,
}

// Function selectors
const SEL_PAY_ETH = '0x9c2f918d'           // payETH(bytes32)
const SEL_PAY_TOKEN = '0x569deb2f'         // payToken(bytes32,address,uint256)
const SEL_APPROVE = '0x095ea7b3'           // approve(address,uint256)

/**
 * Convert a UUID string to bytes32 hex (left-aligned, zero-padded right).
 * "a1b2c3d4-e5f6-7890-abcd-ef1234567890" → 0xa1b2c3d4e5f67890abcdef12345678900000...
 */
function uuidToBytes32(uuid: string): string {
  const hex = uuid.replace(/-/g, '').toLowerCase()
  return '0x' + hex.padEnd(64, '0')
}

/**
 * Send ETH or USDC via the RemixPayments contract using the browser wallet.
 * Returns the transaction hash on success.
 */
async function sendViaWallet(
  contractAddress: string,
  chargeId: string,
  amount: string,
  currency: 'USDC' | 'ETH',
  chain: string
): Promise<string> {
  const provider = (window as unknown as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum
  if (!provider) throw new Error('No wallet detected')

  // Request account access
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[]
  if (!accounts?.length) throw new Error('No account connected')
  const from = accounts[0]

  // Switch to correct chain if needed
  const targetChainId = CHAIN_IDS[chain]
  if (targetChainId) {
    try {
      await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: targetChainId }] })
    } catch (switchErr: unknown) {
      if ((switchErr as { code?: number })?.code === 4902) {
        throw new Error(`Please add the ${chain} network to your wallet`)
      }
      throw switchErr
    }
  }

  const chargeBytes32 = uuidToBytes32(chargeId)
  const paddedChargeId = chargeBytes32.slice(2).padStart(64, '0')

  if (currency === 'ETH') {
    // Call payETH(bytes32 chargeId) with msg.value
    const wei = BigInt(Math.round(parseFloat(amount) * 1e18))
    const data = SEL_PAY_ETH + paddedChargeId

    const txHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{
        from,
        to: contractAddress,
        value: '0x' + wei.toString(16),
        data,
        gas: '0x15F90', // 90000 — payETH + treasury forward
      }],
    })
    return txHash as string
  } else {
    // USDC: 1) approve the contract, 2) call payToken
    const usdcAddress = USDC_CONTRACTS[chain]
    if (!usdcAddress) throw new Error(`USDC not supported on ${chain}`)

    const tokenAmount = BigInt(Math.round(parseFloat(amount) * 1e6))
    const paddedContract = contractAddress.slice(2).toLowerCase().padStart(64, '0')
    const paddedAmount = tokenAmount.toString(16).padStart(64, '0')

    // Step 1: approve(contractAddress, amount) on the USDC token
    const approveData = SEL_APPROVE + paddedContract + paddedAmount
    await provider.request({
      method: 'eth_sendTransaction',
      params: [{
        from,
        to: usdcAddress,
        data: approveData,
        gas: '0xC350', // 50000 — enough for approve
      }],
    })

    // Small delay to let approval tx propagate
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Step 2: payToken(chargeId, token, amount) on the RemixPayments contract
    const paddedToken = usdcAddress.slice(2).toLowerCase().padStart(64, '0')
    const payData = SEL_PAY_TOKEN + paddedChargeId + paddedToken + paddedAmount

    const txHash = await provider.request({
      method: 'eth_sendTransaction',
      params: [{
        from,
        to: contractAddress,
        data: payData,
        gas: '0x1D4C0', // 120000 — payToken + safeTransferFrom
      }],
    })
    return txHash as string
  }
}

export const CryptoPaymentModal: React.FC<CryptoPaymentModalProps> = ({
  chargeId,
  billingApi,
  onComplete,
  onCancel
}) => {
  const [charge, setCharge] = useState<CryptoChargeStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState<'amount' | 'address' | null>(null)
  const [walletSending, setWalletSending] = useState(false)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [walletTxSent, setWalletTxSent] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const hasWallet = typeof window !== 'undefined' && !!(window as unknown as { ethereum?: unknown }).ethereum

  const fetchStatus = useCallback(async () => {
    try {
      const response = await billingApi.getCryptoChargeStatus(chargeId)
      if (response.ok && response.data) {
        setCharge(response.data)
        setError(null)
        if (TERMINAL_STATUSES.includes(response.data.status)) {
          if (pollRef.current) {
            clearInterval(pollRef.current)
            pollRef.current = null
          }
          if (response.data.status === 'confirmed') {
            setTimeout(onComplete, 1500)
          }
        }
      } else {
        setError(response.error || 'Failed to fetch charge status')
      }
    } catch {
      setError('Failed to fetch charge status')
    }
  }, [chargeId, billingApi, onComplete])

  useEffect(() => {
    fetchStatus()
    pollRef.current = setInterval(fetchStatus, POLL_INTERVAL)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchStatus])

  const copyToClipboard = async (text: string, field: 'amount' | 'address') => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(field)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // Fallback
    }
  }

  const getTimeRemaining = () => {
    if (!charge?.expiresAt) return ''
    const diff = new Date(charge.expiresAt).getTime() - Date.now()
    if (diff <= 0) return 'Expired'
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const [timeRemaining, setTimeRemaining] = useState('')

  // Generate QR code when charge is available
  useEffect(() => {
    if (!charge || charge.status !== 'pending') return
    const contractAddr = PAYMENT_CONTRACTS[charge.chain] || charge.recipientAddress
    const chainIdDec = CHAIN_IDS_DECIMAL[charge.chain]
    let uri: string

    if (charge.currency === 'ETH') {
      // EIP-681: ethereum:<contract>@<chainId>/payETH?bytes32=<chargeId>&value=<wei>
      const wei = BigInt(Math.round(parseFloat(charge.amount) * 1e18))
      const chargeHex = uuidToBytes32(charge.id)
      uri = `ethereum:${contractAddr}@${chainIdDec}/payETH?bytes32=${chargeHex}&value=${wei.toString()}`
    } else {
      // For USDC, just encode the contract address — mobile wallets can't easily do approve+call
      uri = `ethereum:${contractAddr}@${chainIdDec}`
    }

    QRCode.toDataURL(uri, { width: 200, margin: 2, errorCorrectionLevel: 'M' })
      .then(url => setQrDataUrl(url))
      .catch(() => setQrDataUrl(null))
  }, [charge?.id, charge?.status])

  useEffect(() => {
    if (!charge?.expiresAt) return
    const tick = () => setTimeRemaining(getTimeRemaining())
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [charge?.expiresAt])

  const renderStatusContent = () => {
    if (error) {
      return (
        <div className="alert alert-danger">
          <i className="fas fa-exclamation-circle me-2"></i>
          {error}
        </div>
      )
    }

    if (!charge) {
      return (
        <div className="d-flex justify-content-center p-4">
          <div className="spinner-border spinner-border-sm" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )
    }

    switch (charge.status) {
    case 'pending':
      return renderPendingUI()
    case 'confirming':
      return renderConfirmingUI()
    case 'confirmed':
      return renderConfirmedUI()
    case 'expired':
      return renderExpiredUI()
    case 'failed':
      return renderFailedUI()
    default:
      return null
    }
  }

  const renderPendingUI = () => {
    const handleSendWithWallet = async () => {
      if (!charge) return
      setWalletSending(true)
      setWalletError(null)
      try {
        // Use contract address from per-chain map, fall back to charge recipientAddress
        const contractAddr = PAYMENT_CONTRACTS[charge.chain] || charge.recipientAddress
        await sendViaWallet(
          contractAddr,
          charge.id,
          charge.amount,
          charge.currency,
          charge.chain
        )
        setWalletTxSent(true)
      } catch (err: unknown) {
        const msg = (err as { message?: string })?.message || 'Wallet transaction failed'
        // User rejected = not an error
        if (msg.includes('User denied') || msg.includes('User rejected')) {
          setWalletError(null)
        } else {
          setWalletError(msg)
        }
      } finally {
        setWalletSending(false)
      }
    }

    return (
      <>
        <div className="mb-3">
          <label className="form-label text-muted small">Send exactly:</label>
          <div className="input-group">
            <input
              type="text"
              className="form-control font-monospace"
              value={`${charge!.amount} ${charge!.currency}`}
              readOnly
              data-id="crypto-amount"
            />
            <button
              className="btn btn-outline-secondary"
              onClick={() => copyToClipboard(charge!.amount, 'amount')}
              data-id="crypto-copy-amount"
            >
              <i className={`fas ${copied === 'amount' ? 'fa-check' : 'fa-copy'}`}></i>
            </button>
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label text-muted small">
            To this address ({charge!.chain}):
          </label>
          <div className="input-group">
            <input
              type="text"
              className="form-control font-monospace small"
              value={charge!.recipientAddress}
              readOnly
              data-id="crypto-address"
            />
            <button
              className="btn btn-outline-secondary"
              onClick={() => copyToClipboard(charge!.recipientAddress, 'address')}
              data-id="crypto-copy-address"
            >
              <i className={`fas ${copied === 'address' ? 'fa-check' : 'fa-copy'}`}></i>
            </button>
          </div>
        </div>

        {/* QR Code for mobile wallets */}
        {qrDataUrl && (
          <div className="text-center mb-3">
            <img src={qrDataUrl} alt="Payment QR Code" style={{ width: 180, height: 180 }} />
            <div className="text-muted small mt-1">
              <i className="fas fa-mobile-alt me-1"></i>
              Scan with a mobile wallet
            </div>
          </div>
        )}

        {/* Send with Wallet button */}
        {hasWallet && !walletTxSent && (
          <div className="mb-3">
            <button
              className="btn btn-primary w-100"
              onClick={handleSendWithWallet}
              disabled={walletSending}
              data-id="crypto-send-wallet"
            >
              {walletSending ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                  Confirm in wallet...
                </>
              ) : (
                <>
                  <i className="fab fa-ethereum me-2"></i>
                  Send with Wallet
                </>
              )}
            </button>
          </div>
        )}

        {walletTxSent && (
          <div className="alert alert-success small mb-3">
            <i className="fas fa-check-circle me-2"></i>
            Transaction submitted! Waiting for on-chain confirmation...
          </div>
        )}

        {walletError && (
          <div className="alert alert-danger small mb-3">
            <i className="fas fa-exclamation-circle me-2"></i>
            {walletError}
          </div>
        )}

        <div className="d-flex justify-content-between align-items-center mb-3">
          <div className="text-muted small">
            <i className="fas fa-clock me-1"></i>
            Expires in: <strong>{timeRemaining}</strong>
          </div>
          <div className="text-muted small">
            <span className="spinner-border spinner-border-sm me-1" role="status"></span>
            Waiting for payment...
          </div>
        </div>

        <div className="alert alert-warning small mb-0">
          <i className="fas fa-exclamation-triangle me-2"></i>
          Send the <strong>EXACT</strong> amount shown above. A different amount will not be matched to your purchase.
        </div>
      </>
    )
  }

  const renderConfirmingUI = () => (
    <>
      <div className="text-success mb-3">
        <i className="fas fa-check-circle me-2"></i>
        <strong>Payment detected!</strong>
      </div>

      <div className="mb-3">
        <div className="progress" style={{ height: '20px' }}>
          <div
            className="progress-bar progress-bar-striped progress-bar-animated"
            style={{ width: `${Math.min((charge!.confirmations / 12) * 100, 100)}%` }}
          >
            {charge!.confirmations} / 12 confirmations
          </div>
        </div>
      </div>

      {charge!.txHash && charge!.explorerUrl && (
        <div className="small">
          <i className="fas fa-external-link-alt me-1"></i>
          Tx: <a href={charge!.explorerUrl} target="_blank" rel="noopener noreferrer">
            {charge!.txHash.slice(0, 10)}...{charge!.txHash.slice(-6)}
          </a>
        </div>
      )}
    </>
  )

  const renderConfirmedUI = () => (
    <div className="text-center py-3">
      <div className="text-success mb-3">
        <i className="fas fa-check-circle fa-3x"></i>
      </div>
      <h6 className="text-success">Payment confirmed!</h6>
      <p className="text-muted small mb-0">Your purchase has been processed successfully.</p>
    </div>
  )

  const renderExpiredUI = () => (
    <div className="text-center py-3">
      <div className="text-warning mb-3">
        <i className="fas fa-clock fa-3x"></i>
      </div>
      <h6>Payment Expired</h6>
      <p className="text-muted small">The payment window has expired. Please try again to create a new charge.</p>
      <button className="btn btn-outline-primary" onClick={onCancel}>Try Again</button>
    </div>
  )

  const renderFailedUI = () => (
    <div className="text-center py-3">
      <div className="text-danger mb-3">
        <i className="fas fa-times-circle fa-3x"></i>
      </div>
      <h6>Payment Failed</h6>
      <p className="text-muted small">There was an error processing your payment. Please contact support.</p>
      <button className="btn btn-outline-secondary" onClick={onCancel}>Close</button>
    </div>
  )

  const showCancelButton = charge && (charge.status === 'pending' || charge.status === 'confirming')

  return (
    <div className="crypto-payment-modal">
      <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}></div>
      <div className="modal d-block" style={{ zIndex: 1051 }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header border-bottom">
              <h6 className="modal-title">
                <i className="fab fa-ethereum me-2"></i>
                Pay with Crypto
              </h6>
              {showCancelButton && (
                <button type="button" className="btn-close" onClick={onCancel}></button>
              )}
            </div>
            <div className="modal-body" data-id="crypto-payment-body">
              {renderStatusContent()}
            </div>
            {showCancelButton && (
              <div className="modal-footer border-top">
                <button
                  className="btn btn-outline-secondary"
                  onClick={onCancel}
                  data-id="crypto-cancel-btn"
                >
                  Cancel Purchase
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
