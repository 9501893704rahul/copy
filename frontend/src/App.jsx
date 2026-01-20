import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'
import { useAuth, AuthProvider } from './contexts/AuthContext'
import AuthModal from './components/AuthModal'
import PricingModal from './components/PricingModal'
import UserMenu from './components/UserMenu'

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

const API_BASE = '/api'

function AppContent() {
  const { user, loading: authLoading, subscription, isConfigured } = useAuth()
  const [reviewId, setReviewId] = useState(null)
  const [reviewData, setReviewData] = useState(null)
  const [selectedReviewer, setSelectedReviewer] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [numPages, setNumPages] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [dragging, setDragging] = useState(false)
  const [activeHighlight, setActiveHighlight] = useState(null)
  const [pageSize, setPageSize] = useState({ width: 612, height: 792 })
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [reviewsThisMonth, setReviewsThisMonth] = useState(0)
  const fileInputRef = useRef(null)
  const pdfContainerRef = useRef(null)

  const reviewers = [
    { type: 'editor_overview', name: 'Editor Overview', icon: '📝', iconBg: 'bg-blue-100', description: 'High-level editorial assessment' },
    { type: 'methodology_reviewer', name: 'Methodology', icon: '🔬', iconBg: 'bg-amber-100', description: 'Research design evaluation' },
    { type: 'novelty_reviewer', name: 'Novelty', icon: '💡', iconBg: 'bg-pink-100', description: 'Originality assessment' },
    { type: 'clarity_reviewer', name: 'Clarity & Writing', icon: '✍️', iconBg: 'bg-indigo-100', description: 'Writing quality review' },
    { type: 'reproducibility_reviewer', name: 'Reproducibility', icon: '🔄', iconBg: 'bg-emerald-100', description: 'Reproducibility check' },
  ]

  const FREE_REVIEWS_LIMIT = 3
  const canReview = !isConfigured || !user || subscription?.plan_id === 'pro' || subscription?.plan_id === 'team' || reviewsThisMonth < FREE_REVIEWS_LIMIT

  const handleFileUpload = async (file) => {
    if (!file || !file.name.endsWith('.pdf')) {
      alert('Please upload a PDF file')
      return
    }

    if (!canReview) {
      setShowPricingModal(true)
      return
    }

    setLoading(true)
    setLoadingMessage('Uploading PDF...')

    try {
      const formData = new FormData()
      formData.append('file', file)

      const uploadResponse = await axios.post(`${API_BASE}/upload`, formData)
      const { id } = uploadResponse.data

      setReviewId(id)
      setPdfUrl(`${API_BASE}/reviews/${id}/pdf`)

      setLoadingMessage('Analyzing paper with AI reviewers...')

      const analyzeResponse = await axios.post(`${API_BASE}/reviews/${id}/analyze`)
      
      setReviewData({
        ...uploadResponse.data,
        ...analyzeResponse.data,
        highlights: analyzeResponse.data.highlights || []
      })

      if (analyzeResponse.data.reviewers?.length > 0) {
        setSelectedReviewer(analyzeResponse.data.reviewers[0].type)
      }

      setReviewsThisMonth(prev => prev + 1)

    } catch (error) {
      console.error('Error:', error)
      alert('Error processing file: ' + (error.response?.data?.detail || error.message))
    } finally {
      setLoading(false)
      setLoadingMessage('')
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    handleFileUpload(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setDragging(true)
  }

  const handleDragLeave = () => {
    setDragging(false)
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    handleFileUpload(file)
  }

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages)
  }

  const onPageLoadSuccess = (page) => {
    setPageSize({
      width: page.originalWidth,
      height: page.originalHeight
    })
  }

  const getReviewerComments = () => {
    if (!reviewData?.comments || !selectedReviewer) return []
    return reviewData.comments.filter(c => c.reviewer_type === selectedReviewer)
  }

  const getReviewerSummary = () => {
    if (!reviewData?.reviewers || !selectedReviewer) return ''
    const reviewer = reviewData.reviewers.find(r => r.type === selectedReviewer)
    return reviewer?.summary || ''
  }

  const getSelectedReviewerInfo = () => {
    return reviewers.find(r => r.type === selectedReviewer)
  }

  const goToPage = (page) => {
    setCurrentPage(Math.max(1, Math.min(page, numPages || 1)))
  }

  const getCurrentPageHighlights = useCallback(() => {
    if (!reviewData?.highlights) return []
    return reviewData.highlights.filter(h => h.page === currentPage)
  }, [reviewData, currentPage])

  const navigateToHighlight = (comment) => {
    if (comment.highlight_rects && comment.highlight_rects.length > 0) {
      const highlight = comment.highlight_rects[0]
      setCurrentPage(highlight.page)
      setActiveHighlight(highlight.id)
      setTimeout(() => setActiveHighlight(null), 2000)
    } else if (comment.page) {
      setCurrentPage(comment.page)
    }
  }

  const handleHighlightClick = (highlight) => {
    setActiveHighlight(highlight.id)
    const commentElement = document.getElementById(`comment-${highlight.comment_id}`)
    if (commentElement) {
      commentElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      commentElement.classList.add('highlight-pulse')
      setTimeout(() => commentElement.classList.remove('highlight-pulse'), 2000)
    }
  }

  // Upload Screen
  if (!reviewId) {
    return (
      <div className="app-container">
        <header className="header">
          <div className="logo">
            <div className="logo-icon-wrapper">
              <span className="logo-icon">📄</span>
            </div>
            <span className="logo-text">AI Paper Review</span>
          </div>
          <div className="header-actions">
            {isConfigured && !user ? (
              <>
                <button className="btn btn-ghost" onClick={() => setShowPricingModal(true)}>
                  Pricing
                </button>
                <button className="btn btn-primary" onClick={() => setShowAuthModal(true)}>
                  Sign In
                </button>
              </>
            ) : user ? (
              <>
                <button className="btn btn-ghost" onClick={() => setShowPricingModal(true)}>
                  {subscription?.plan_id === 'pro' || subscription?.plan_id === 'team' ? 'Manage Plan' : 'Upgrade'}
                </button>
                <UserMenu onOpenPricing={() => setShowPricingModal(true)} />
              </>
            ) : null}
          </div>
        </header>

        <div className="hero-section">
          <div className="hero-content">
            <div className="hero-badge">
              <span className="hero-badge-icon">✨</span>
              <span>Powered by Advanced AI</span>
            </div>
            <h1 className="hero-title">
              Get Expert Feedback on Your
              <span className="hero-title-highlight"> Research Paper</span>
            </h1>
            <p className="hero-subtitle">
              Upload your paper and receive instant, comprehensive reviews from 5 specialized AI reviewers. 
              Improve your research before submission.
            </p>

            <div className="upload-section">
              <div
                className={`upload-dropzone ${dragging ? 'dragging' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="upload-icon-wrapper">
                  <svg className="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <p className="upload-text">
                  <span className="upload-text-primary">Click to upload</span> or drag and drop
                </p>
                <p className="upload-hint">PDF files up to 50MB</p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              {isConfigured && !user && (
                <p className="upload-limit-notice">
                  <span className="upload-limit-icon">ℹ️</span>
                  {FREE_REVIEWS_LIMIT - reviewsThisMonth} free reviews remaining. 
                  <button onClick={() => setShowAuthModal(true)}>Sign in</button> to track your usage.
                </p>
              )}
            </div>

            <div className="features-grid">
              {reviewers.slice(0, 3).map((reviewer) => (
                <div key={reviewer.type} className="feature-card">
                  <div className={`feature-icon ${reviewer.iconBg}`}>
                    <span>{reviewer.icon}</span>
                  </div>
                  <h3>{reviewer.name}</h3>
                  <p>{reviewer.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {loading && (
          <div className="loading-overlay">
            <div className="loading-card">
              <div className="loading-spinner-wrapper">
                <div className="loading-spinner"></div>
              </div>
              <h3>{loadingMessage}</h3>
              <p>This may take a minute...</p>
              <div className="loading-progress">
                <div className="loading-progress-bar"></div>
              </div>
            </div>
          </div>
        )}

        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
        <PricingModal 
          isOpen={showPricingModal} 
          onClose={() => setShowPricingModal(false)} 
          onAuthRequired={() => { setShowPricingModal(false); setShowAuthModal(true); }}
        />
      </div>
    )
  }

  // Review Screen
  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">
          <div className="logo-icon-wrapper">
            <span className="logo-icon">📄</span>
          </div>
          <span className="logo-text">AI Paper Review</span>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => {
            setReviewId(null)
            setReviewData(null)
            setPdfUrl(null)
            setSelectedReviewer(null)
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            New Review
          </button>
          {user && <UserMenu onOpenPricing={() => setShowPricingModal(true)} />}
        </div>
      </header>

      <div className="main-content">
        {/* Sidebar - Reviewers */}
        <div className="sidebar">
          <div className="sidebar-header">
            <svg className="sidebar-header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>
            <span className="sidebar-title">AI Reviewers</span>
          </div>
          <div className="reviewer-list">
            {reviewers.map((reviewer) => {
              const reviewerData = reviewData?.reviewers?.find(r => r.type === reviewer.type)
              const isCompleted = reviewerData?.status === 'completed'
              const commentCount = reviewData?.comments?.filter(c => c.reviewer_type === reviewer.type).length || 0
              
              return (
                <div
                  key={reviewer.type}
                  className={`reviewer-item ${selectedReviewer === reviewer.type ? 'active' : ''}`}
                  onClick={() => setSelectedReviewer(reviewer.type)}
                >
                  <div className={`reviewer-icon-wrapper ${reviewer.iconBg}`}>
                    <span className="reviewer-icon">{reviewer.icon}</span>
                  </div>
                  <div className="reviewer-info">
                    <div className="reviewer-name">{reviewer.name}</div>
                    <div className="reviewer-comment-count">{commentCount} comments</div>
                  </div>
                  {isCompleted ? (
                    <div className="reviewer-check">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                  ) : (
                    <div className="reviewer-pending"></div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Review Panel */}
        <div className="review-panel">
          {selectedReviewer ? (
            <>
              <div className="review-header">
                <div className="review-header-left">
                  <div className={`review-icon-wrapper ${getSelectedReviewerInfo()?.iconBg}`}>
                    <span>{getSelectedReviewerInfo()?.icon}</span>
                  </div>
                  <div>
                    <h2 className="review-title">{getSelectedReviewerInfo()?.name}</h2>
                    <p className="review-subtitle">{getSelectedReviewerInfo()?.description}</p>
                  </div>
                </div>
              </div>
              <div className="review-content">
                {getReviewerSummary() && (
                  <div className="review-summary">
                    <h3 className="review-summary-title">Summary</h3>
                    <p>{getReviewerSummary()}</p>
                  </div>
                )}
                
                {getReviewerComments().length > 0 && (
                  <div className="comments-section">
                    <h3 className="comments-section-header">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                      </svg>
                      Comments ({getReviewerComments().length})
                    </h3>
                    <div className="comments-list">
                      {getReviewerComments().map((comment, idx) => (
                        <div
                          key={idx}
                          id={`comment-${comment.id}`}
                          className={`comment-card severity-${comment.severity}`}
                          onClick={() => navigateToHighlight(comment)}
                        >
                          <div className="comment-header">
                            <span className="comment-number">{idx + 1}</span>
                            <h4 className="comment-title">{comment.title}</h4>
                            {comment.page && (
                              <span className="comment-page">p.{comment.page}</span>
                            )}
                          </div>
                          <p className="comment-content">{comment.content}</p>
                          {comment.citations && comment.citations.length > 0 && (
                            <div className="citations-list">
                              {comment.citations.map((citation, cidx) => (
                                <div 
                                  key={cidx} 
                                  className="citation-item"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    if (citation.highlight_id) {
                                      const highlight = reviewData.highlights.find(h => h.id === citation.highlight_id)
                                      if (highlight) {
                                        setCurrentPage(highlight.page)
                                        setActiveHighlight(highlight.id)
                                        setTimeout(() => setActiveHighlight(null), 2000)
                                      }
                                    }
                                  }}
                                >
                                  <span className="citation-icon">📌</span>
                                  <span className="citation-quote">"{citation.quote.substring(0, 80)}..."</span>
                                  <span className="citation-page">p.{citation.page}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {getReviewerComments().length === 0 && (
                  <div className="empty-state">
                    <div className="empty-state-icon">📝</div>
                    <p>No comments from this reviewer yet</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="empty-state" style={{ marginTop: 100 }}>
              <div className="empty-state-icon">👈</div>
              <p>Select a reviewer to see their feedback</p>
            </div>
          )}
        </div>

        {/* PDF Viewer */}
        <div className="pdf-viewer">
          <div className="pdf-toolbar">
            <span className="pdf-title">{reviewData?.title || 'Document'}</span>
            <div className="pdf-controls">
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))} title="Zoom out">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
              </button>
              <span className="zoom-display">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(s => Math.min(2, s + 0.1))} title="Zoom in">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  <line x1="11" y1="8" x2="11" y2="14"></line>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
              </button>
              <div className="pdf-divider"></div>
              <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
              <span className="page-display">{currentPage} / {numPages || '?'}</span>
              <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= numPages}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>
          </div>
          <div className="pdf-container" ref={pdfContainerRef}>
            {pdfUrl && (
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={
                  <div className="pdf-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading PDF...</p>
                  </div>
                }
              >
                <div className="pdf-page-wrapper">
                  <Page
                    pageNumber={currentPage}
                    scale={scale}
                    onLoadSuccess={onPageLoadSuccess}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                  <div className="highlights-layer">
                    {getCurrentPageHighlights().map((highlight, idx) => (
                      <div
                        key={idx}
                        className={`pdf-highlight ${activeHighlight === highlight.id ? 'active' : ''}`}
                        style={{
                          left: `${(highlight.x0 / highlight.width) * 100}%`,
                          top: `${(highlight.y0 / highlight.height) * 100}%`,
                          width: `${((highlight.x1 - highlight.x0) / highlight.width) * 100}%`,
                          height: `${((highlight.y1 - highlight.y0) / highlight.height) * 100}%`,
                        }}
                        onClick={() => handleHighlightClick(highlight)}
                        title="Click to see related comment"
                      />
                    ))}
                  </div>
                </div>
              </Document>
            )}
          </div>
        </div>
      </div>

      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <PricingModal 
        isOpen={showPricingModal} 
        onClose={() => setShowPricingModal(false)} 
        onAuthRequired={() => { setShowPricingModal(false); setShowAuthModal(true); }}
      />
    </div>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
