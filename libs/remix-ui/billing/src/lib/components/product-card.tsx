import React from 'react'
import { EligibleProduct, UserSubscription, UserFeatureMembership } from '@remix-api'

interface ProductCardProps {
  product: EligibleProduct
  onPurchase: (product: EligibleProduct) => void
  purchasing?: boolean
  currentSubscription?: UserSubscription | null
  featureMemberships?: UserFeatureMembership[]
}

const formatPrice = (cents: number, currency = 'USD') => {
  if (cents === 0) return 'Free'
  return `$${(cents / 100).toFixed(2)}`
}

const typeLabel = (type: string) => {
  switch (type) {
  case 'credit_package': return 'Credits'
  case 'subscription_plan': return 'Subscription'
  case 'feature_access': return 'Feature'
  default: return type
  }
}

const typeIcon = (type: string) => {
  switch (type) {
  case 'credit_package': return 'fas fa-coins'
  case 'subscription_plan': return 'fas fa-sync-alt'
  case 'feature_access': return 'fas fa-unlock-alt'
  default: return 'fas fa-box'
  }
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onPurchase,
  purchasing,
  currentSubscription,
  featureMemberships = []
}) => {
  const isSubscription = product.product_type === 'subscription_plan'
  const isFeature = product.product_type === 'feature_access'
  const isCredit = product.product_type === 'credit_package'

  // Check if user already has this subscription plan
  const hasActiveSub = isSubscription && currentSubscription?.status === 'active'
    && currentSubscription?.items?.some(item => item.productId === product.external_product_id)

  // Check if user has active membership for this feature
  const hasActiveMembership = isFeature && product.feature_group
    && featureMemberships.some(m => m.featureGroup === product.feature_group && m.status === 'active')

  const alreadyOwned = hasActiveSub || hasActiveMembership

  const hasCrypto = product.provider_slug === 'crypto'

  return (
    <div className="col-12 col-md-6 col-lg-4">
      <div className={`card h-100 ${product.is_popular ? 'border-primary' : ''}`}>
        {product.is_popular && (
          <div className="card-header bg-primary text-white text-center py-1 small fw-bold">
            Popular
          </div>
        )}
        <div className="card-body d-flex flex-column">
          {/* Type badge */}
          <div className="mb-2">
            <span className="badge bg-secondary-subtle text-secondary me-1">
              <i className={`${typeIcon(product.product_type)} me-1`}></i>
              {typeLabel(product.product_type)}
            </span>
            {hasCrypto && (
              <span className="badge bg-warning-subtle text-warning">
                <i className="fab fa-ethereum me-1"></i>Crypto
              </span>
            )}
          </div>

          {/* Name */}
          <h6 className="card-title mb-1">{product.name}</h6>

          {/* Description */}
          {product.description && (
            <p className="card-text text-muted small mb-2">{product.description}</p>
          )}

          {/* Details based on type */}
          <div className="mb-3 small">
            {isCredit && product.credits && (
              <div><i className="fas fa-coins me-1 text-primary"></i>{product.credits.toLocaleString()} credits</div>
            )}
            {isSubscription && product.credits_per_month && (
              <div><i className="fas fa-coins me-1 text-primary"></i>{product.credits_per_month.toLocaleString()} credits/month</div>
            )}
            {isSubscription && product.billing_interval && (
              <div><i className="fas fa-calendar me-1"></i>Billed {product.billing_interval}ly</div>
            )}
            {isFeature && product.feature_groups && product.feature_groups.length > 0 && (
              <div className="mt-1">
                {product.feature_groups.map((fg, i) => (
                  <span key={i} className="badge bg-info-subtle text-info me-1 mb-1">{fg.displayName || fg.name}</span>
                ))}
              </div>
            )}
            {isFeature && product.duration_type && product.duration_value && (
              <div><i className="fas fa-clock me-1"></i>{product.duration_value} {product.duration_type}</div>
            )}
            {product.features && product.features.length > 0 && (
              <ul className="list-unstyled mt-1 mb-0">
                {product.features.slice(0, 4).map((f, i) => (
                  <li key={i} className="small"><i className="fas fa-check text-success me-1"></i>{f}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Spacer to push price + button to bottom */}
          <div className="mt-auto">
            {/* Price */}
            <div className="h5 mb-2">
              {formatPrice(product.price_cents, product.currency)}
              {isSubscription && product.billing_interval && (
                <span className="text-muted small">/{product.billing_interval}</span>
              )}
            </div>

            {/* Action */}
            {alreadyOwned ? (
              <button className="btn btn-outline-success btn-sm w-100" disabled>
                <i className="fas fa-check me-1"></i>Active
              </button>
            ) : (
              <button
                className="btn btn-primary btn-sm w-100"
                onClick={() => onPurchase(product)}
                disabled={purchasing}
              >
                {purchasing ? (
                  <><span className="spinner-border spinner-border-sm me-1"></span>Processing...</>
                ) : (
                  <>{isSubscription ? 'Subscribe' : 'Purchase'}</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
