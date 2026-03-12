import React, { useState, useEffect, useCallback } from 'react'
import { BillingManagerProps, UserSubscription, Credits, UserFeatureMembership } from './types'
import { BillingApiService, ProductsApiService, ApiClient, CryptoCurrency, EligibleProduct } from '@remix-api'
import { endpointUrls } from '@remix-endpoints-helper'
import { CurrentSubscription } from './components/current-subscription'
import { PaymentMethodSelector, PaymentProvider } from './components/payment-method-selector'
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

  // Payment method selection
  const [paymentSelector, setPaymentSelector] = useState<{
    product: EligibleProduct
    availableProviders: string[]
  } | null>(null)

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

    // Determine which providers this product's slug has across all rows
    const productRows = products.filter(p => p.slug === product.slug)
    const providerSlugs = [...new Set(productRows.map(p => p.provider_slug).filter(Boolean))] as string[]
    const hasCrypto = providerSlugs.includes('crypto')
    const hasPaddle = providerSlugs.includes('paddle') || providerSlugs.includes('freepaddle')

    // Recurring products can't use crypto
    const isRecurring = product.is_recurring || product.product_type === 'subscription_plan'

    if (hasPaddle && hasCrypto && !isRecurring) {
      setPaymentSelector({ product, availableProviders: providerSlugs })
      return
    }
    if (hasCrypto && !hasPaddle && !isRecurring) {
      setPaymentSelector({ product, availableProviders: ['crypto'] })
      return
    }

    // Default: Paddle/FreePaddle
    executePaddlePurchase(product)
  }

  /**
   * Route to the correct /billing endpoint based on product_type.
   * Uses existing endpoints that already handle Paddle transactions:
   *   POST /billing/purchase-credits   (credit_package)
   *   POST /billing/feature-access/purchase (feature_access)
   *   POST /billing/subscribe          (subscription_plan)
   */
  const executePaddlePurchase = async (product: EligibleProduct) => {
    setPurchasingSlug(product.slug)
    try {
      const provider = product.provider_slug || 'paddle'
      let response: { ok: boolean; data?: { transactionId: string; checkoutUrl: string } | null; error?: string }

      if (product.product_type === 'credit_package') {
        response = await billingApi.purchaseCredits(product.slug, provider)
      } else if (product.product_type === 'feature_access') {
        response = await billingApi.purchaseFeatureAccess(product.slug, provider)
      } else {
        // subscription_plan
        response = await billingApi.subscribe(product.slug, provider)
      }

      if (!response.ok || !response.data) {
        console.error('[BillingManager] Purchase failed:', response.error)
        setPurchasingSlug(null)
        return
      }

      const { transactionId, checkoutUrl } = response.data
      const paddleInstance = paddle || getPaddle()
      if (paddleInstance && transactionId) {
        openCheckoutWithTransaction(paddleInstance, transactionId, {
          settings: { displayMode: 'overlay', theme: 'light' }
        })
      } else if (checkoutUrl) {
        window.open(checkoutUrl, '_blank')
        setPurchasingSlug(null)
      } else {
        setPurchasingSlug(null)
      }
    } catch (err) {
      console.error('[BillingManager] Purchase error:', err)
      setPurchasingSlug(null)
    }
  }

  /**
   * Crypto purchase — uses the same /billing endpoints with provider: "crypto".
   * Per the brief:
   *   POST /billing/purchase-credits       { packageId, provider: "crypto", customData }
   *   POST /billing/feature-access/purchase { productSlug, provider: "crypto", customData }
   * Returns { transactionId (= chargeId), checkoutUrl }
   */
  const executeCryptoPurchase = async (product: EligibleProduct, currency: CryptoCurrency) => {
    setPurchasingSlug(product.slug)
    try {
      const customData = {
        currency,
        priceCents: product.price_cents,
        productSlug: product.slug,
        unifiedProductId: product.id,
        ...(product.product_type === 'credit_package' ? { credits: product.credits } : {}),
        ...(product.product_type === 'feature_access' ? { type: 'feature_access' as const } : {})
      }

      let response: { ok: boolean; data?: { transactionId: string; checkoutUrl: string } | null; error?: string }

      if (product.product_type === 'credit_package') {
        response = await billingApi.purchaseCredits(product.slug, 'crypto', undefined, customData)
      } else {
        // feature_access (subscriptions can't use crypto)
        response = await billingApi.purchaseFeatureAccess(product.slug, 'crypto', undefined, customData)
      }

      if (!response.ok || !response.data) {
        console.error('[BillingManager] Crypto purchase failed:', response.error)
        setPurchasingSlug(null)
        return
      }
      setCryptoChargeId(response.data.transactionId)
      setPurchasingSlug(null)
    } catch (err) {
      console.error('[BillingManager] Crypto purchase error:', err)
      setPurchasingSlug(null)
    }
  }

  const handlePaymentMethodSelect = (provider: PaymentProvider, currency?: CryptoCurrency) => {
    if (!paymentSelector) return
    const { product } = paymentSelector
    setPaymentSelector(null)
    if (provider === 'crypto') {
      executeCryptoPurchase(product, currency || 'USDC')
    } else {
      executePaddlePurchase(product)
    }
  }

  const handleCryptoComplete = () => { setCryptoChargeId(null); loadUserData(); onPurchaseComplete?.() }
  const handleCryptoCancel = () => { setCryptoChargeId(null) }

  const handleManageSubscription = () => {
    console.log('[BillingManager] Manage subscription')
  }

  // ==================== Render ====================

  return (
    <div className="billing-manager">
      {/* Balance */}
      {isAuthenticated && credits && (
        <div className="p-3 border-bottom d-flex justify-content-between align-items-center">
          <div>
            <i className="fas fa-wallet me-2"></i>
            <strong>Your Balance</strong>
          </div>
          <div className="h5 mb-0">
            <span className="badge bg-primary">
              <i className="fas fa-coins me-1"></i>
              {credits.balance.toLocaleString()} credits
            </span>
          </div>
        </div>
      )}

      {paddleError && (
        <div className="alert alert-warning m-3 mb-0">
          <i className="fas fa-exclamation-triangle me-2"></i>
          {paddleError}
        </div>
      )}

      {!isAuthenticated && (
        <div className="alert alert-info m-3">
          <i className="fas fa-info-circle me-2"></i>
          <a href="#" onClick={(e) => { e.preventDefault(); plugin?.call('auth', 'login', 'github') }}>
            Sign in
          </a> to view available products and purchase credits.
        </div>
      )}

      {/* Current subscription */}
      {isAuthenticated && (
        <div className="p-3 border-bottom">
          <CurrentSubscription
            subscription={subscription}
            loading={userLoading}
            onManage={handleManageSubscription}
          />
        </div>
      )}

      {/* Products */}
      <div className="p-3">
        {productsLoading && (
          <div className="d-flex justify-content-center p-4">
            <div className="spinner-border spinner-border-sm" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        )}

        {productsError && (
          <div className="alert alert-warning">
            <i className="fas fa-exclamation-triangle me-2"></i>
            {productsError}
          </div>
        )}

        {!productsLoading && !productsError && products.length === 0 && isAuthenticated && (
          <div className="text-muted text-center p-4">
            No products available at this time.
          </div>
        )}

        {!productsLoading && products.length > 0 && (
          <div className="row g-3">
            {products.map((product) => (
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
        )}
      </div>

      {/* Payment Method Selector Modal */}
      {paymentSelector && (
        <PaymentMethodSelector
          availableProviders={paymentSelector.availableProviders}
          productName={paymentSelector.product.name}
          priceCents={paymentSelector.product.price_cents}
          onSelect={handlePaymentMethodSelect}
          onCancel={() => setPaymentSelector(null)}
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
