import React from 'react'
import { EligibleProduct, UserSubscription, UserFeatureMembership } from '@remix-api'

interface ProductCardProps {
  product: EligibleProduct
  onPurchase: (product: EligibleProduct) => void
  purchasing?: boolean
  currentSubscription?: UserSubscription | null
  featureMemberships?: UserFeatureMembership[]
}

const formatPrice = (cents: number) => {
  if (cents === 0) return 'Free'
  const dollars = cents / 100
  return dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`
}

const typeLabel = (type: string) => {
  switch (type) {
  case 'credit_package': return 'Credits'
  case 'subscription_plan': return 'Subscription'
  case 'feature_access': return 'Feature'
  default: return type
  }
}

const typeClass = (type: string) => {
  switch (type) {
  case 'credit_package': return 'plan-card__type--credits'
  case 'subscription_plan': return 'plan-card__type--subscription'
  case 'feature_access': return 'plan-card__type--feature'
  default: return ''
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

  const hasActiveSub = isSubscription && currentSubscription?.status === 'active'
    && currentSubscription?.items?.some(item => item.productId === product.external_product_id)

  const hasActiveMembership = isFeature && product.feature_group
    && featureMemberships.some(m => m.featureGroup === product.feature_group && m.status === 'active')

  const alreadyOwned = hasActiveSub || hasActiveMembership
  const hasCrypto = product.provider_slug === 'crypto'

  // Collect all displayable details as feature-list items
  const details: string[] = []
  if (isCredit && product.credits) details.push(`${product.credits.toLocaleString()} credits`)
  if (isSubscription && product.credits_per_month) details.push(`${product.credits_per_month.toLocaleString()} credits/month`)
  if (isSubscription && product.billing_interval) details.push(`Billed ${product.billing_interval}ly`)
  if (isFeature && product.duration_type && product.duration_value) details.push(`${product.duration_value} ${product.duration_type} access`)
  if (product.features) details.push(...product.features.slice(0, 5))

  return (
    <div className="col-12 col-md-6 col-lg-4">
      <div className={`plan-card ${product.is_popular ? 'plan-card--popular' : ''}`}>
        {product.is_popular && (
          <div className="plan-card__popular-badge">Most Popular</div>
        )}

        {/* Type label */}
        <div className={`plan-card__type ${typeClass(product.product_type)}`}>
          {typeLabel(product.product_type)}
          {hasCrypto && (
            <span className="plan-card__crypto-tag">
              <i className="fab fa-ethereum"></i> Crypto
            </span>
          )}
        </div>

        {/* Name */}
        <div className="plan-card__name">{product.name}</div>

        {/* Description */}
        {product.description && (
          <div className="plan-card__desc">{product.description}</div>
        )}

        {/* Price */}
        <div className="plan-card__price">
          {formatPrice(product.price_cents)}
          {isSubscription && product.billing_interval && (
            <span className="plan-card__price-interval">/{product.billing_interval === 'month' ? 'mo' : 'yr'}</span>
          )}
        </div>

        {/* Feature groups */}
        {isFeature && product.feature_groups && product.feature_groups.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {product.feature_groups.map((fg, i) => (
              <span key={i} className="plan-card__crypto-tag" style={{ color: '#a78bfa', background: 'rgba(167,139,250,0.1)', borderColor: 'rgba(167,139,250,0.2)', marginRight: 4, marginBottom: 4 }}>
                {fg.displayName || fg.name}
              </span>
            ))}
          </div>
        )}

        {/* Feature / detail list */}
        {details.length > 0 && (
          <ul className="plan-card__features">
            {details.map((d, i) => (
              <li key={i}><i className="fas fa-check"></i>{d}</li>
            ))}
          </ul>
        )}

        {/* Spacer */}
        <div style={{ flex: 1, minHeight: 16 }}></div>

        {/* Button */}
        {alreadyOwned ? (
          <button className="plan-card__btn plan-card__btn--active" disabled>
            <i className="fas fa-check"></i> Active
          </button>
        ) : (
          <button
            className={`plan-card__btn ${hasCrypto ? 'plan-card__btn--crypto' : 'plan-card__btn--card'}`}
            onClick={() => onPurchase(product)}
            disabled={purchasing}
          >
            {purchasing ? (
              <><span className="spinner-border spinner-border-sm"></span> Processing...</>
            ) : hasCrypto ? (
              <><i className="fab fa-ethereum"></i> Buy with Crypto</>
            ) : isSubscription ? (
              <><i className="fas fa-credit-card"></i> Subscribe</>
            ) : (
              <><i className="fas fa-credit-card"></i> Buy with Card</>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
