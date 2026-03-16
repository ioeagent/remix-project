import React, { useState, useEffect, useCallback } from 'react'
import { BillingManagerProps, UserSubscription, Credits, UserFeatureMembership } from './types'
import { BillingApiService, ProductsApiService, ApiClient, CryptoCurrency, EligibleProduct } from '@remix-api'
import { endpointUrls } from '@remix-endpoints-helper'
import { CryptoCurrencySelector } from './components/crypto-currency-selector'
import { CryptoPaymentModal } from './components/crypto-payment-modal'
import { ProductCard } from './components/product-card'
import { initPaddle, getPaddle, openCheckoutWithTransaction, onPaddleEvent, offPaddleEvent } from './paddle-singleton'
import type { Paddle, PaddleEventData } from '@paddle/paddle-js'

/**
 * Main Billing Manager component
 * Single API call loads visibility-filtered products, rendered as a flat grid.
 */
export const BillingManager: React.FC<BillingManagerProps> = ({
  plugin,
  paddleClientToken,
  paddleEnvironment = 'sandbox',
  onPurchaseComplete,
  onSubscriptionChange
}) => {
  // API clients
  const [billingApi] = useState(() => {
    const client = new ApiClient(endpointUrls.billing)
    client.setTokenRefreshCallback(async () => localStorage.getItem('remix_access_token'))
    return new BillingApiService(client)
  })

  const [productsApi] = useState(() => {
    const client = new ApiClient(endpointUrls.products)
    client.setTokenRefreshCallback(async () => localStorage.getItem('remix_access_token'))
    return new ProductsApiService(client)
  })

  // Core state
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [products, setProducts] = useState<EligibleProduct[]>([])
  const [productsLoading, setProductsLoading] = useState(true)
  const [productsError, setProductsError] = useState<string | null>(null)

  // User state
  const [credits, setCredits] = useState<Credits | null>(null)
  const [subscription, setSubscription] = useState<UserSubscription | null>(null)
  const [featureMemberships, setFeatureMemberships] = useState<UserFeatureMembership[]>([])
  const [userLoading, setUserLoading] = useState(true)

  // Purchase state
  const [purchasingSlug, setPurchasingSlug] = useState<string | null>(null)

  // Paddle state
  const [paddle, setPaddle] = useState<Paddle | null>(null)
  const [paddleError, setPaddleError] = useState<string | null>(null)

  // Crypto currency selection (shown when user clicks "Buy with Crypto")
  const [cryptoCurrencySelector, setCryptoCurrencySelector] = useState<EligibleProduct | null>(null)

  // Crypto payment
  const [cryptoChargeId, setCryptoChargeId] = useState<string | null>(null)

  // ==================== Paddle ====================

  useEffect(() => {
    if (!paddleClientToken) return
    let mounted = true
    initPaddle(paddleClientToken, paddleEnvironment)
      .then((inst) => { if (mounted) setPaddle(inst) })
      .catch((err) => { if (mounted) setPaddleError(err.message || 'Failed to initialize payment system') })
    return () => { mounted = false }
  }, [paddleClientToken, paddleEnvironment])

  useEffect(() => {
    const handler = (event: PaddleEventData) => {
      if (event.name === 'checkout.completed') {
        setPurchasingSlug(null)
        setTimeout(() => { loadUserData(); onPurchaseComplete?.(); onSubscriptionChange?.() }, 1500)
      } else if (event.name === 'checkout.closed') {
        setPurchasingSlug(null)
      }
    }
    onPaddleEvent(handler)
    return () => offPaddleEvent(handler)
  }, [onPurchaseComplete, onSubscriptionChange])

  // ==================== Auth ====================

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await plugin?.call('auth', 'getUser')
        setIsAuthenticated(!!user)
        const token = localStorage.getItem('remix_access_token')
        if (token) { billingApi.setToken(token); productsApi.setToken(token) }
      } catch { setIsAuthenticated(false) }
    }
    checkAuth()

    const handleAuthChange = (authState: { isAuthenticated: boolean; token?: string }) => {
      setIsAuthenticated(authState.isAuthenticated)
      if (authState.isAuthenticated) {
        const token = authState.token || localStorage.getItem('remix_access_token')
        if (token) { billingApi.setToken(token); productsApi.setToken(token) }
        loadUserData()
      } else {
        setCredits(null); setSubscription(null); setFeatureMemberships([])
      }
    }
    const handleTokenRefreshed = (data: { token: string }) => {
      if (data.token) { billingApi.setToken(data.token); productsApi.setToken(data.token) }
    }

    try {
      plugin?.on('auth', 'authStateChanged', handleAuthChange)
      plugin?.on('auth', 'tokenRefreshed', handleTokenRefreshed)
    } catch { /* */ }
    return () => { try { plugin?.off('auth', 'authStateChanged'); plugin?.off('auth', 'tokenRefreshed') } catch { /* */ } }
  }, [plugin, billingApi])

  // ==================== Single products call ====================

  useEffect(() => {
    if (isAuthenticated) loadProducts()
  }, [isAuthenticated])

  const loadProducts = async () => {
    setProductsLoading(true)
    setProductsError(null)
    try {
      const response = await productsApi.getAvailableGrouped()
      if (response.ok && response.data) {
        const { credit_packages, subscription_plans, feature_access } = response.data.data
        // Merge into a single flat list — server already filtered by visibility rules
        const all = [...feature_access, ...credit_packages, ...subscription_plans]
        setProducts(all)
      } else {
        setProductsError(response.error || 'Failed to load products')
      }
    } catch {
      setProductsError('Failed to load products')
    } finally {
      setProductsLoading(false)
    }
  }

  // ==================== User data ====================

  useEffect(() => {
    if (isAuthenticated) loadUserData()
  }, [isAuthenticated])

  const loadUserData = useCallback(async () => {
    if (!isAuthenticated) return
    setUserLoading(true)
    try {
      const [creditsRes, subRes, membRes] = await Promise.all([
        billingApi.getCredits(),
        billingApi.getSubscription(),
        billingApi.getFeatureMemberships()
      ])
      if (creditsRes.ok && creditsRes.data) setCredits(creditsRes.data)
      if (subRes.ok && subRes.data) setSubscription(subRes.data.subscription)
      if (membRes.ok && membRes.data) setFeatureMemberships(membRes.data.memberships || [])
    } catch (err) {
      console.error('[BillingManager] Failed to load user data:', err)
    } finally {
      setUserLoading(false)
    }
  }, [isAuthenticated, billingApi])

  // ==================== Purchase logic ====================

  const handlePurchase = async (product: EligibleProduct) => {
    if (!isAuthenticated) {
      try { await plugin?.call('auth', 'login', 'github') } catch { /* */ }
      return
    }

    // Crypto → show currency selector first
    if (product.provider_slug === 'crypto') {
      setCryptoCurrencySelector(product)
      return
    }

    // Paddle / FreePaddle → purchase directly
    executePurchase(product)
  }

  /**
   * Unified purchase — POST /products/purchase
   * Works for all product types and providers. The server handles
   * Paddle transaction creation, crypto charge creation, and enrichment.
   */
  const executePurchase = async (product: EligibleProduct, currency?: CryptoCurrency) => {
    setPurchasingSlug(product.slug)
    try {
      const response = await productsApi.purchase({
        slug: product.slug,
        provider: product.provider_slug || 'paddle',
        ...(currency ? { currency } : {})
      })

      if (!response.ok || !response.data) {
        console.error('[BillingManager] Purchase failed:', response.error)
        setPurchasingSlug(null)
        return
      }

      const { transactionId, provider } = response.data

      if (provider === 'crypto') {
        // Crypto: open the charge status modal
        setCryptoChargeId(transactionId)
        setPurchasingSlug(null)
      } else {
        // Paddle: open checkout overlay
        const paddleInstance = paddle || getPaddle()
        if (paddleInstance && transactionId) {
          openCheckoutWithTransaction(paddleInstance, transactionId, {
            settings: { displayMode: 'overlay', theme: 'light' }
          })
        } else if (response.data.checkoutUrl) {
          window.open(response.data.checkoutUrl, '_blank')
          setPurchasingSlug(null)
        } else {
          setPurchasingSlug(null)
        }
      }
    } catch (err) {
      console.error('[BillingManager] Purchase error:', err)
      setPurchasingSlug(null)
    }
  }

  const handleCryptoCurrencySelect = (currency: CryptoCurrency) => {
    if (!cryptoCurrencySelector) return
    const product = cryptoCurrencySelector
    setCryptoCurrencySelector(null)
    executePurchase(product, currency)
  }

  const handleCryptoComplete = () => { setCryptoChargeId(null); loadUserData(); onPurchaseComplete?.() }
  const handleCryptoCancel = () => { setCryptoChargeId(null) }

  // ==================== Render ====================

  // Group products by type for section headers
  const featureProducts = products.filter(p => p.product_type === 'feature_access')
  const subscriptionProducts = products.filter(p => p.product_type === 'subscription_plan')
  const creditProducts = products.filter(p => p.product_type === 'credit_package')

  return (
    <div className="billing-manager">
      {/* Status bar: credits + subscription inline */}
      {isAuthenticated && !userLoading && (
        <div className="billing-status-bar">
          <div className="billing-status-bar__sub">
            {subscription?.status === 'active' ? (
              <span className="billing-status-bar__sub-badge billing-status-bar__sub-badge--active">
                <i className="fas fa-check-circle"></i> {subscription.items?.[0]?.description || 'Active Plan'}
              </span>
            ) : (
              <span className="billing-status-bar__sub-badge billing-status-bar__sub-badge--none">
                Free Plan
              </span>
            )}
          </div>
          {credits && (
            <div className="billing-status-bar__credits">
              <i className="fas fa-coins"></i>
              {credits.balance.toLocaleString()} credits
            </div>
          )}
        </div>
      )}

      {paddleError && (
        <div className="alert alert-warning m-3 mb-0" style={{ borderRadius: 10 }}>
          <i className="fas fa-exclamation-triangle me-2"></i>
          {paddleError}
        </div>
      )}

      {!isAuthenticated && (
        <div style={{ padding: '40px 28px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🚀</div>
          <h5 style={{ fontWeight: 700, marginBottom: 8 }}>Unlock the full power of Remix</h5>
          <p style={{ color: 'var(--bs-secondary-color, #8892a4)', marginBottom: 20, fontSize: '0.9rem' }}>
            Sign in to view plans and purchase credits.
          </p>
          <button
            className="plan-card__btn plan-card__btn--card"
            style={{ maxWidth: 240, margin: '0 auto' }}
            onClick={() => plugin?.call('auth', 'login', 'github')}
          >
            <i className="fas fa-sign-in-alt"></i> Sign In
          </button>
        </div>
      )}

      {/* Products */}
      <div style={{ padding: '20px 28px' }}>
        {productsLoading && (
          <div className="d-flex justify-content-center p-5">
            <div className="spinner-border spinner-border-sm" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        )}

        {productsError && (
          <div className="alert alert-warning" style={{ borderRadius: 10 }}>
            <i className="fas fa-exclamation-triangle me-2"></i>
            {productsError}
          </div>
        )}

        {!productsLoading && !productsError && products.length === 0 && isAuthenticated && (
          <div className="text-muted text-center p-5">
            No products available at this time.
          </div>
        )}

        {/* Feature Access */}
        {featureProducts.length > 0 && (
          <>
            <div className="billing-section-header">Feature Passes</div>
            <div className="row g-3 mb-4">
              {featureProducts.map((product) => (
                <ProductCard
                  key={`${product.slug}-${product.provider_slug}`}
                  product={product}
                  onPurchase={handlePurchase}
                  purchasing={purchasingSlug === product.slug}
                  currentSubscription={subscription}
                  featureMemberships={featureMemberships}
                />
              ))}
            </div>
          </>
        )}

        {/* Subscriptions */}
        {subscriptionProducts.length > 0 && (
          <>
            <div className="billing-section-header">Subscription Plans</div>
            <div className="row g-3 mb-4">
              {subscriptionProducts.map((product) => (
                <ProductCard
                  key={`${product.slug}-${product.provider_slug}`}
                  product={product}
                  onPurchase={handlePurchase}
                  purchasing={purchasingSlug === product.slug}
                  currentSubscription={subscription}
                  featureMemberships={featureMemberships}
                />
              ))}
            </div>
          </>
        )}

        {/* Credit Packages */}
        {creditProducts.length > 0 && (
          <>
            <div className="billing-section-header">Credit Packages</div>
            <div className="row g-3 mb-4">
              {creditProducts.map((product) => (
                <ProductCard
                  key={`${product.slug}-${product.provider_slug}`}
                  product={product}
                  onPurchase={handlePurchase}
                  purchasing={purchasingSlug === product.slug}
                  currentSubscription={subscription}
                  featureMemberships={featureMemberships}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Payment methods footer */}
      {isAuthenticated && products.length > 0 && !productsLoading && (
        <div className="billing-payment-methods">
          <span>Accepted:</span>
          <i className="fas fa-credit-card" title="Credit / Debit Card"></i>
          <i className="fab fa-cc-visa" title="Visa"></i>
          <i className="fab fa-cc-mastercard" title="Mastercard"></i>
          <i className="fab fa-paypal" title="PayPal"></i>
          <i className="fab fa-google-pay" title="Google Pay"></i>
          <i className="fab fa-apple-pay" title="Apple Pay"></i>
          <i className="fab fa-ethereum" title="ETH / USDC"></i>
        </div>
      )}

      {/* Crypto Currency Selector */}
      {cryptoCurrencySelector && (
        <CryptoCurrencySelector
          productName={cryptoCurrencySelector.name}
          priceCents={cryptoCurrencySelector.price_cents}
          onSelect={handleCryptoCurrencySelect}
          onCancel={() => setCryptoCurrencySelector(null)}
        />
      )}

      {/* Crypto Payment Modal */}
      {cryptoChargeId && (
        <CryptoPaymentModal
          chargeId={cryptoChargeId}
          billingApi={billingApi}
          onComplete={handleCryptoComplete}
          onCancel={handleCryptoCancel}
        />
      )}
    </div>
  )
}
