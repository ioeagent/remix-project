import React from 'react'
import { FeatureAccessProductsViewProps } from '../types'
import { BillingApiService } from '@remix-api'
import { PurchaseButton } from './purchase-button'

/**
 * Display available feature access products (passes and subscriptions)
 */
export const FeatureAccessProductsView: React.FC<FeatureAccessProductsViewProps> = ({
  products,
  loading = false,
  error = null,
  memberships = [],
  onPurchase,
  purchasing = false,
  filterRecurring
}) => {
  if (loading) {
    return (
      <div className="flex justify-center p-6">
        <div className="spinner-border spinner-border-sm" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="alert alert-warning m-4">
        <i className="fas fa-exclamation-triangle me-2"></i>
        {error}
      </div>
    )
  }

  // Filter products if needed
  let displayProducts = products
  if (filterRecurring !== undefined) {
    displayProducts = BillingApiService.filterFeatureProducts(products, filterRecurring)
  }

  if (!displayProducts || displayProducts.length === 0) {
    return (
      <div className="text-muted text-center p-6">
        No feature access products available
      </div>
    )
  }

  // Check if user has active membership for a feature group
  const hasActiveMembership = (featureGroup: string) => {
    return memberships.some(m =>
      m.featureGroup === featureGroup &&
      m.status === 'active'
    )
  }

  // Get the user's active membership for a feature group
  const getActiveMembership = (featureGroup: string) => {
    return memberships.find(m =>
      m.featureGroup === featureGroup &&
      m.status === 'active'
    )
  }

  return (
    <div className="feature-access-products-view">
      <div className="flex flex-wrap g-3">
        {displayProducts.map((product) => {
          // Check if user already has access to the primary feature group
          const hasAccess = hasActiveMembership(product.featureGroup)
          const activeMembership = getActiveMembership(product.featureGroup)

          // Get price ID from providers array (if available)
          const paddleProvider = product.providers?.find(p => p.slug === 'paddle' && p.isActive)
          const priceId = paddleProvider?.priceId || null

          return (
            <div key={product.id} className="w-full md:w-1/2 lg:w-1/3">
              <div className={`card h-full ${product.isPopular ? 'border-primary' : ''} ${hasAccess ? 'border-success' : ''}`}>
                {product.isPopular && !hasAccess && (
                  <div className="card-header bg-primary text-white text-center py-1">
                    <small><i className="fas fa-star me-1"></i>Popular</small>
                  </div>
                )}
                {hasAccess && (
                  <div className="card-header bg-success text-white text-center py-1">
                    <small><i className="fas fa-unlock me-1"></i>Access Granted</small>
                  </div>
                )}

                <div className="card-body flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <h5 className="card-title mb-0">{product.name}</h5>
                    {product.isRecurring && (
                      <span className="badge bg-info">Subscription</span>
                    )}
                  </div>

                  <p className="card-text text-muted small mb-4">
                    {product.description}
                  </p>

                  {/* Price */}
                  <div className="mb-4">
                    <span className="h4">{BillingApiService.formatPrice(product.priceCents)}</span>
                    {product.isRecurring && product.billingInterval && (
                      <small className="text-muted">{BillingApiService.formatBillingInterval(product.billingInterval)}</small>
                    )}
                  </div>

                  {/* Duration */}
                  <div className="mb-4">
                    <div className="flex items-center text-muted small">
                      <i className="fas fa-clock me-2"></i>
                      {BillingApiService.formatDuration(product.durationType, product.durationValue)}
                      {product.isRecurring && ' (auto-renews)'}
                    </div>
                  </div>

                  {/* Feature Groups */}
                  {product.featureGroups && product.featureGroups.length > 0 && (
                    <div className="mb-4 grow">
                      <small className="text-muted block mb-2">Includes access to:</small>
                      <ul className="list-unstyled mb-0">
                        {product.featureGroups.map((fg) => (
                          <li key={fg.id} className="mb-1 small">
                            <i className="fas fa-check text-success me-2"></i>
                            <strong>{fg.displayName}</strong>
                            {fg.description && (
                              <span className="text-muted block ms-6" style={{ fontSize: '0.85em' }}>
                                {fg.description}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Purchase Button */}
                  <div className="mt-auto">
                    <PurchaseButton
                      label={product.isRecurring ? 'Subscribe' : 'Buy Now'}
                      priceId={priceId}
                      onClick={() => onPurchase(product.slug, priceId)}
                      loading={purchasing}
                      disabled={false}
                      variant={product.isPopular ? 'primary' : 'outline'}
                      requirePriceId={false}
                    />
                    {hasAccess && activeMembership?.expiresAt && (
                      <small className="text-muted block text-center mt-1">
                        <i className="fas fa-check text-success me-1"></i>
                        {activeMembership.isRecurring ? 'Renews' : 'Access expires'}: {new Date(activeMembership.expiresAt).toLocaleDateString()}
                      </small>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
