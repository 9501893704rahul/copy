import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/esm/Page/AnnotationLayer.css'
import 'react-pdf/dist/esm/Page/TextLayer.css'

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`

const API_BASE = '/api'

function App() {
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
  const fileInputRef = useRef(null)

  const reviewers = [
    { type: 'editor_overview', name: 'Editor Overview', icon: '📝' },
    { type: 'methodology_reviewer', name: 'Methodology Reviewer', icon: '🔬' },
    { type: 'novelty_reviewer', name: 'Novelty Reviewer', icon: '💡' },
    { type: 'clarity_reviewer', name: 'Clarity & Writing', icon: '✍️' },
    { type: 'reproducibility_reviewer', name: 'Reproducibility', icon: '🔄' },
  ]

  const handleFileUpload = async (file) => {
    if (!file || !file.name.endsWith('.pdf')) {
      alert('Please upload a PDF file')
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

      // Run analysis
      const analyzeResponse = await axios.post(`${API_BASE}/reviews/${id}/analyze`)
      
      setReviewData({
        ...uploadResponse.data,
        ...analyzeResponse.data
      })

      // Select first reviewer by default
      if (analyzeResponse.data.reviewers?.length > 0) {
        setSelectedReviewer(analyzeResponse.data.reviewers[0].type)
      }

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

  // Upload Screen
  if (!reviewId) {
    return (
      <div className="app-container">
        <header className="header">
          <div className="logo">
            <span className="logo-icon">📄</span>
            <span>AI Paper Review</span>
          </div>
        </header>

        <div className="upload-screen">
          <div className="upload-container">
            <h1 className="upload-title">AI-Powered Paper Review</h1>
            <p className="upload-subtitle">
              Upload your research paper and get instant feedback from multiple AI reviewers
            </p>

            <div
              className={`upload-dropzone ${dragging ? 'dragging' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="upload-icon">📤</div>
              <p className="upload-text">Drop your PDF here or click to browse</p>
              <p className="upload-hint">Supports PDF files up to 50MB</p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {loading && (
          <div className="loading-overlay">
            <div className="loading-card">
              <div className="loading-spinner" style={{ width: 40, height: 40, borderWidth: 3 }}></div>
              <h3>{loadingMessage}</h3>
              <p>This may take a minute...</p>
            </div>
          </div>
        )}
      </div>
    )
  }

  // Review Screen
  return (
    <div className="app-container">
      <header className="header">
        <div className="logo">
          <span className="logo-icon">📄</span>
          <span>AI Paper Review</span>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={() => {
            setReviewId(null)
            setReviewData(null)
            setPdfUrl(null)
            setSelectedReviewer(null)
          }}>
            ← Upload New Paper
          </button>
        </div>
      </header>

      <div className="main-content">
        {/* Sidebar - Reviewers */}
        <div className="sidebar">
          <div className="sidebar-header">
            <span>👥</span>
            <span className="sidebar-title">Reviewers</span>
          </div>
          <div className="reviewer-list">
            {reviewers.map((reviewer) => {
              const reviewerData = reviewData?.reviewers?.find(r => r.type === reviewer.type)
              const isCompleted = reviewerData?.status === 'completed'
              
              return (
                <div
                  key={reviewer.type}
                  className={`reviewer-item ${selectedReviewer === reviewer.type ? 'active' : ''}`}
                  onClick={() => setSelectedReviewer(reviewer.type)}
                >
                  <span className="reviewer-icon">{reviewer.icon}</span>
                  <div className="reviewer-info">
                    <div className="reviewer-name">{reviewer.name}</div>
                    <div className="reviewer-status">
                      {isCompleted ? 'Completed' : 'Pending'}
                    </div>
                  </div>
                  {isCompleted && <span className="reviewer-check">✓</span>}
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
                <h2 className="review-title">
                  <span>{getSelectedReviewerInfo()?.icon}</span>
                  {getSelectedReviewerInfo()?.name}
                </h2>
              </div>
              <div className="review-content">
                {getReviewerSummary() && (
                  <p className="review-summary">{getReviewerSummary()}</p>
                )}
                
                <div className="comments-section">
                  <h3>Comments</h3>
                  {getReviewerComments().length > 0 ? (
                    getReviewerComments().map((comment, idx) => (
                      <div
                        key={idx}
                        className={`comment-card severity-${comment.severity}`}
                        onClick={() => goToPage(comment.page)}
                      >
                        <div className="comment-header">
                          <span className="comment-title">{comment.title}</span>
                          <span className="comment-page">Page {comment.page}</span>
                        </div>
                        <p className="comment-content">{comment.content}</p>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      <div className="empty-state-icon">📝</div>
                      <p>No comments from this reviewer yet</p>
                    </div>
                  )}
                </div>
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
              <button onClick={() => setScale(s => Math.max(0.5, s - 0.1))}>−</button>
              <span className="zoom-display">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(s => Math.min(2, s + 0.1))}>+</button>
              <span style={{ margin: '0 8px', color: '#888' }}>|</span>
              <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>◀</button>
              <span className="zoom-display">{currentPage} / {numPages || '?'}</span>
              <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= numPages}>▶</button>
            </div>
          </div>
          <div className="pdf-container">
            {pdfUrl && (
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                loading={<div style={{ color: 'white' }}>Loading PDF...</div>}
              >
                <Page
                  pageNumber={currentPage}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                />
              </Document>
            )}
          </div>
        </div>
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="loading-card">
            <div className="loading-spinner" style={{ width: 40, height: 40, borderWidth: 3 }}></div>
            <h3>{loadingMessage}</h3>
            <p>This may take a minute...</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
