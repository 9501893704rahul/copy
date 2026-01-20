import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function UserMenu({ onOpenPricing }) {
  const { user, subscription, signOut } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (!user) return null

  const planName = subscription?.plan_id === 'pro' ? 'Pro' : 
                   subscription?.plan_id === 'team' ? 'Team' : 'Free'

  const getInitials = (email) => {
    return email.substring(0, 2).toUpperCase()
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button className="user-menu-trigger" onClick={() => setIsOpen(!isOpen)}>
        <div className="user-avatar">
          {user.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} alt="Avatar" />
          ) : (
            <span>{getInitials(user.email)}</span>
          )}
        </div>
        <svg className={`user-menu-arrow ${isOpen ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && (
        <div className="user-menu-dropdown">
          <div className="user-menu-header">
            <p className="user-email">{user.email}</p>
            <span className={`user-plan-badge ${planName.toLowerCase()}`}>{planName}</span>
          </div>
          
          <div className="user-menu-divider" />
          
          <button className="user-menu-item" onClick={() => { onOpenPricing(); setIsOpen(false); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            {planName === 'Free' ? 'Upgrade Plan' : 'Manage Subscription'}
          </button>
          
          <button className="user-menu-item" onClick={() => { signOut(); setIsOpen(false); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}
