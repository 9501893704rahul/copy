import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const POLAR_CHECKOUT_LINKS = {
  free: null,
  pro: import.meta.env.VITE_POLAR_PRO_CHECKOUT_URL || '',
  team: import.meta.env.VITE_POLAR_TEAM_CHECKOUT_URL || '',
}

const plans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '/month',
    description: 'Perfect for trying out AI Paper Review',
    features: [
      '3 paper reviews per month',
      'Basic AI reviewers',
      'PDF highlighting',
      'Export to PDF',
    ],
    cta: 'Current Plan',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$19',
    period: '/month',
    description: 'For researchers and academics',
    features: [
      'Unlimited paper reviews',
      'All AI reviewers',
      'Priority processing',
      'Citation analysis',
      'Review history',
      'Email support',
    ],
    cta: 'Upgrade to Pro',
    popular: true,
  },
  {
    id: 'team',
    name: 'Team',
    price: '$49',
    period: '/month',
    description: 'For research groups and labs',
    features: [
      'Everything in Pro',
      'Up to 10 team members',
      'Shared review library',
      'Custom reviewer prompts',
      'API access',
      'Priority support',
    ],
    cta: 'Contact Sales',
    popular: false,
  },
]

export default function PricingModal({ isOpen, onClose, onAuthRequired }) {
  const { user, subscription } = useAuth()
  const [loading, setLoading] = useState(null)

  if (!isOpen) return null

  const handleSelectPlan = async (planId) => {
    if (planId === 'free') return

    if (!user) {
      onAuthRequired()
      return
    }

    const checkoutUrl = POLAR_CHECKOUT_LINKS[planId]
    if (!checkoutUrl) {
      alert('Checkout not configured. Please set VITE_POLAR_PRO_CHECKOUT_URL or VITE_POLAR_TEAM_CHECKOUT_URL')
      return
    }

    setLoading(planId)
    
    // Redirect to Polar.sh checkout with user email
    const url = new URL(checkoutUrl)
    url.searchParams.set('customer_email', user.email)
    url.searchParams.set('success_url', window.location.origin + '?checkout=success')
    url.searchParams.set('cancel_url', window.location.origin + '?checkout=cancel')
    
    window.location.href = url.toString()
  }

  const currentPlan = subscription?.plan_id || 'free'

  return (
    <div className="pricing-modal-overlay" onClick={onClose}>
      <div className="pricing-modal" onClick={(e) => e.stopPropagation()}>
        <button className="pricing-modal-close" onClick={onClose}>×</button>
        
        <div className="pricing-header">
          <h2>Choose Your Plan</h2>
          <p>Unlock the full power of AI-powered paper reviews</p>
        </div>

        <div className="pricing-grid">
          {plans.map((plan) => (
            <div 
              key={plan.id} 
              className={`pricing-card ${plan.popular ? 'popular' : ''} ${currentPlan === plan.id ? 'current' : ''}`}
            >
              {plan.popular && <div className="popular-badge">Most Popular</div>}
              
              <div className="pricing-card-header">
                <h3>{plan.name}</h3>
                <div className="pricing-price">
                  <span className="price">{plan.price}</span>
                  <span className="period">{plan.period}</span>
                </div>
                <p className="pricing-description">{plan.description}</p>
              </div>

              <ul className="pricing-features">
                {plan.features.map((feature, idx) => (
                  <li key={idx}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                className={`pricing-cta ${plan.popular ? 'primary' : 'secondary'}`}
                onClick={() => handleSelectPlan(plan.id)}
                disabled={currentPlan === plan.id || loading === plan.id}
              >
                {loading === plan.id ? 'Loading...' : currentPlan === plan.id ? 'Current Plan' : plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="pricing-footer">
          <p>Powered by <a href="https://polar.sh" target="_blank" rel="noopener noreferrer">Polar.sh</a></p>
          <p className="pricing-guarantee">30-day money-back guarantee • Cancel anytime</p>
        </div>
      </div>
    </div>
  )
}
