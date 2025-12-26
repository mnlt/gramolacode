import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, type Artifact, type Comment } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import ArtifactRenderer from '../components/ArtifactRenderer'

type Mode = 'browsing' | 'feedback'
type View = 'artifact' | 'table'

const NAME_KEY = 'gramola_feedback_name'

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]
const generateDefaultName = () => `${pick(['Curious', 'Quiet', 'Brave', 'Clever', 'Sunny', 'Swift', 'Calm', 'Bold', 'Kind', 'Witty'])} ${pick(['Otter', 'Lynx', 'Koala', 'Panda', 'Fox', 'Dolphin', 'Hawk', 'Badger', 'Turtle', 'Seal'])}`
const getStoredName = () => { const s = localStorage.getItem(NAME_KEY)?.trim(); if (s) return s; const n = generateDefaultName(); localStorage.setItem(NAME_KEY, n); return n }
const getInitials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase()
const formatTime = (ts: string) => { const d = Date.now() - new Date(ts).getTime(); if (d < 60000) return 'just now'; if (d < 3600000) return `${Math.floor(d / 60000)}m ago`; if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`; return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }

const CopyIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
const CheckIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
const EyeIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
const MessageIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
const MessageIconLarge = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
const ExpandIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
const ShrinkIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
const ListIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
const ArrowLeftIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
const SendIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>
const LockIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>

// ============================================================================
// Animated Mode Switch Component (like Claude's code/preview toggle)
// ============================================================================
function ModeSwitch({ mode, onChange, isMobile }: { mode: Mode; onChange: (mode: Mode) => void; isMobile: boolean }) {
  return (
    <div style={switchStyles.container}>
      <div 
        style={{
          ...switchStyles.slider,
          transform: mode === 'feedback' ? 'translateX(100%)' : 'translateX(0)',
        }} 
      />
      <button
        onClick={() => onChange('browsing')}
        style={{
          ...switchStyles.option,
          color: mode === 'browsing' ? '#fff' : 'rgba(20,18,15,0.55)',
          padding: isMobile ? '6px 10px' : '6px 14px',
        }}
        type="button"
      >
        <EyeIcon />
        {!isMobile && <span>Preview</span>}
      </button>
      <button
        onClick={() => onChange('feedback')}
        style={{
          ...switchStyles.option,
          color: mode === 'feedback' ? '#fff' : 'rgba(20,18,15,0.55)',
          padding: isMobile ? '6px 10px' : '6px 14px',
        }}
        type="button"
      >
        <MessageIcon />
        {!isMobile && <span>Feedback</span>}
      </button>
    </div>
  )
}

const switchStyles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    display: 'inline-flex',
    backgroundColor: 'rgba(20,18,15,0.08)',
    borderRadius: '10px',
    padding: '3px',
    gap: '0',
  },
  slider: {
    position: 'absolute',
    top: '3px',
    left: '3px',
    width: 'calc(50% - 3px)',
    height: 'calc(100% - 6px)',
    backgroundColor: 'rgba(20,18,15,0.9)',
    borderRadius: '8px',
    transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 0,
  },
  option: {
    position: 'relative',
    zIndex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    border: 'none',
    background: 'transparent',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'color 0.15s ease',
    whiteSpace: 'nowrap',
  },
}

// ============================================================================
// Main Component
// ============================================================================
export default function ViewerPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  
  const [artifact, setArtifact] = useState<Artifact | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [mode, setMode] = useState<Mode>('browsing')
  const [view, setView] = useState<View>('artifact')
  const [userName, setUserName] = useState(getStoredName)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [copied, setCopied] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [contentHeight, setContentHeight] = useState<number>(500)

  const [copyHover, setCopyHover] = useState(false)
  const [fullscreenHover, setFullscreenHover] = useState(false)
  const [exitHover, setExitHover] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  const inputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)

  const isOwner = artifact && user && artifact.user_id === user.id
  const visibleComments = isOwner ? comments : comments.filter(c => c.user_id === user?.id)

  useEffect(() => {
    if (!id) return
    const fetchData = async () => {
      try {
        const { data: a, error: ae } = await supabase.from('artifacts').select('*').eq('id', id).single()
        if (ae) throw ae
        setArtifact(a)
        const { data: c, error: ce } = await supabase.from('comments').select('*').eq('artifact_id', id).order('created_at', { ascending: true })
        if (ce) throw ce
        setComments(c || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Artifact not found')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [id])

  const handleContentHeight = useCallback((height: number) => {
    if (height > 100) {
      setContentHeight(Math.max(height, 500))
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) setIsFullscreen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const saveName = useCallback((value: string) => {
    const finalName = value.trim().slice(0, 24) || generateDefaultName()
    localStorage.setItem(NAME_KEY, finalName)
    setUserName(finalName)
    setIsEditingName(false)
  }, [])

  const startEditing = () => { setEditValue(userName); setIsEditingName(true); setTimeout(() => inputRef.current?.select(), 0) }
  const handleNameKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') saveName(editValue); else if (e.key === 'Escape') setIsEditingName(false) }

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(window.location.href) } catch { const t = document.createElement('textarea'); t.value = window.location.href; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove() }
    setCopied(true); setTimeout(() => setCopied(false), 1200)
  }

  const handleSubmitComment = async () => {
    if (!commentText.trim() || !id || !user) return
    
    setSubmitting(true)
    try {
      const { data, error: err } = await supabase.from('comments').insert({
        artifact_id: id,
        user_id: user.id,
        user_name: userName,
        message: commentText.trim()
      }).select().single()
      
      if (err) throw err
      setComments([...comments, data])
      setCommentText('')
    } catch (err) {
      console.error('Error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const handleCommentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment() }
  }

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen)

  // ============================================================================
  // Loading State
  // ============================================================================
  if (loading) return (
    <div style={styles.container}>
      <header style={styles.header}><div style={styles.bar}><Link to="/" style={styles.logo}>gramola</Link></div></header>
      <main style={styles.mainCenter}><div style={styles.loading}>Loading...</div></main>
    </div>
  )

  // ============================================================================
  // Error State
  // ============================================================================
  if (error || !artifact) return (
    <div style={styles.container}>
      <header style={styles.header}><div style={styles.bar}><Link to="/" style={styles.logo}>gramola</Link></div></header>
      <main style={styles.mainCenter}>
        <div style={styles.errorCard}>
          <h2 style={styles.errorTitle}>Error</h2>
          <p style={styles.errorText}>{error || 'Artifact not found'}</p>
          <Link to="/" style={styles.backButton}>Back to home</Link>
        </div>
      </main>
    </div>
  )

  // ============================================================================
  // Table View (Owner only)
  // ============================================================================
  if (view === 'table' && isOwner) return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={{ ...styles.bar, ...(isMobile ? { flexDirection: 'column' as const, alignItems: 'stretch', gap: '12px' } : {}) }}>
          <button style={styles.backBtn} onClick={() => setView('artifact')}><ArrowLeftIcon /><span>Back</span></button>
          <div style={{ ...styles.privateBadge, ...(isMobile ? { fontSize: '12px', textAlign: 'center' as const } : {}) }}>
            <LockIcon />
            <span>{isMobile ? 'Private — only you see all feedback' : 'Private view — only you as the link owner can see all feedback'}</span>
          </div>
          {!isMobile && <div style={{ width: 80 }} />}
        </div>
      </header>
      <div style={{ ...styles.tableContainer, ...(isMobile ? { padding: '16px 12px 40px' } : {}) }}>
        <div style={styles.tableHeader}>
          <h2 style={{ ...styles.tableTitle, ...(isMobile ? { fontSize: '18px' } : {}) }}>All Feedback</h2>
          <span style={styles.tableCount}>{comments.length} comments</span>
        </div>
        <div style={styles.table}>
          {!isMobile && <div style={styles.tableRowHeader}><div style={{ ...styles.tableCell, flex: '0 0 160px' }}>User</div><div style={{ ...styles.tableCell, flex: 1 }}>Comment</div></div>}
          {comments.length === 0 ? <div style={styles.tableEmpty}>No feedback yet</div> : comments.map(c => (
            <div key={c.id} style={{ ...styles.tableRow, ...(isMobile ? { flexDirection: 'column' as const, alignItems: 'stretch', gap: '10px' } : {}) }}>
              <div style={isMobile ? { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } : { ...styles.tableCell, flex: '0 0 160px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ ...styles.tableAvatar, backgroundColor: c.user_id === user?.id ? '#6b7cff' : '#14120f' }}>{getInitials(c.user_name)}</div>
                  <div><div style={styles.tableUserName}>{c.user_name}</div><div style={styles.tableTime}>{formatTime(c.created_at)}</div></div>
                </div>
              </div>
              <div style={isMobile ? { color: 'rgba(20,18,15,0.8)', fontSize: '13px', lineHeight: 1.5 } : { ...styles.tableCell, flex: 1, color: 'rgba(20,18,15,0.8)' }}>{c.message}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // ============================================================================
  // Fullscreen View
  // ============================================================================
  if (isFullscreen) return (
    <div style={styles.fullscreenContainer}>
      <div ref={viewerRef} style={{ ...styles.fullscreenViewer, height: contentHeight }}>
        <ArtifactRenderer code={artifact.code} onHeightChange={handleContentHeight} />
      </div>
      <button onClick={toggleFullscreen} onMouseEnter={() => setExitHover(true)} onMouseLeave={() => setExitHover(false)} style={{ ...styles.exitFullscreenBtn, backgroundColor: exitHover ? '#f5f5f5' : '#fff' }} type="button">
        <span style={styles.exitFullscreenText}>gramola</span><span style={styles.exitFullscreenDivider} /><ShrinkIcon />
      </button>
    </div>
  )

  // ============================================================================
  // Main View
  // ============================================================================
  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.bar}>
          <Link to="/" style={styles.logo}>gramola</Link>
          
          <div style={styles.controls}>
            {/* Mode Switch - always visible */}
            <ModeSwitch mode={mode} onChange={setMode} isMobile={isMobile} />

            {/* Browsing mode controls */}
            {mode === 'browsing' && (
              <>
                <div style={styles.separator} />
                <div style={styles.controlGroup}>
                  <button 
                    onClick={copyLink} 
                    onMouseEnter={() => setCopyHover(true)} 
                    onMouseLeave={() => setCopyHover(false)} 
                    style={{ 
                      ...styles.iconButton, 
                      backgroundColor: copied ? '#07c078' : (copyHover ? 'rgba(20,18,15,0.06)' : '#fff'), 
                      color: copied ? '#fff' : 'rgba(20,18,15,0.7)', 
                      borderColor: copied ? '#07c078' : 'rgba(20,18,15,0.16)' 
                    }} 
                    type="button" 
                    title={copied ? 'Copied!' : 'Copy link'}
                  >
                    {copied ? <CheckIcon /> : <CopyIcon />}
                  </button>
                  {!isMobile && (
                    <button 
                      onClick={toggleFullscreen} 
                      onMouseEnter={() => setFullscreenHover(true)} 
                      onMouseLeave={() => setFullscreenHover(false)} 
                      style={{ ...styles.iconButton, backgroundColor: fullscreenHover ? 'rgba(20,18,15,0.06)' : '#fff' }} 
                      type="button" 
                      title="Fullscreen"
                    >
                      <ExpandIcon />
                    </button>
                  )}
                </div>
              </>
            )}

            {/* Feedback mode controls */}
            {mode === 'feedback' && (
              <>
                <div style={styles.separator} />
                <div style={styles.controlGroup}>
                  {/* You pill with name */}
                  <div style={styles.youPill}>
                    <span style={styles.youLabel}>You:</span>
                    {isEditingName ? (
                      <input 
                        ref={inputRef} 
                        type="text" 
                        maxLength={24} 
                        value={editValue} 
                        onChange={(e) => setEditValue(e.target.value)} 
                        onBlur={() => saveName(editValue)} 
                        onKeyDown={handleNameKeyDown} 
                        style={styles.nameEdit} 
                        autoFocus 
                      />
                    ) : (
                      <button 
                        onClick={startEditing} 
                        style={styles.nameBadge} 
                        type="button"
                      >
                        {isMobile ? getInitials(userName) : userName}
                      </button>
                    )}
                  </div>

                  {/* All comments button - owner only */}
                  {isOwner && comments.length > 0 && (
                    <button 
                      style={styles.allCommentsBtn} 
                      onClick={() => setView('table')}
                    >
                      <ListIcon />
                      <span>{isMobile ? comments.length : `All (${comments.length})`}</span>
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main style={styles.mainViewer}>
        <div style={mode === 'feedback' && !isMobile ? styles.layoutFeedback : styles.layoutBrowsing}>
          {/* Viewer */}
          <div 
            ref={viewerRef}
            style={{ 
              ...styles.viewer, 
              borderColor: mode === 'feedback' ? '#6b7cff' : 'rgba(20,18,15,0.18)',
              height: contentHeight,
              minHeight: 500,
              maxWidth: mode === 'browsing' ? '1200px' : 'none',
              width: '100%',
            }}
          >
            <ArtifactRenderer code={artifact.code} onHeightChange={handleContentHeight} />
          </div>

          {/* Comments Panel - only visible in feedback mode and not on mobile */}
          {mode === 'feedback' && !isMobile && (
            <div style={styles.panel}>
              <div style={styles.panelHeader}>
                <div style={styles.panelHeaderContent}>
                  <MessageIconLarge />
                  <span style={styles.panelTitle}>Feedback ({visibleComments.length})</span>
                </div>
              </div>

              <div style={styles.panelContent}>
                {/* Comment Input Form */}
                <div style={styles.commentInputSection}>
                  <textarea
                    ref={textareaRef}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={handleCommentKeyDown}
                    placeholder="Leave your feedback..."
                    style={styles.commentTextarea}
                    rows={3}
                  />
                  <div style={styles.commentInputFooter}>
                    <span style={styles.commentInputHint}>Enter to send</span>
                    <button 
                      onClick={handleSubmitComment} 
                      disabled={!commentText.trim() || submitting} 
                      style={{ ...styles.submitButton, opacity: commentText.trim() && !submitting ? 1 : 0.5 }}
                    >
                      <SendIcon />
                    </button>
                  </div>
                </div>

                {/* Comments List */}
                {visibleComments.length === 0 ? (
                  <div style={styles.emptyState}>
                    <MessageIconLarge />
                    <p>No feedback yet</p>
                    <p style={styles.emptyStateHint}>Be the first to leave feedback</p>
                  </div>
                ) : (
                  <div style={styles.commentsList}>
                    {visibleComments.map((comment) => (
                      <div key={comment.id} style={{ ...styles.commentCard, borderColor: comment.user_id === user?.id ? '#6b7cff' : 'rgba(20,18,15,0.12)' }}>
                        <div style={styles.commentHeader}>
                          <div style={styles.commentAuthor}>
                            <div style={{ ...styles.commentAvatar, backgroundColor: comment.user_id === user?.id ? '#6b7cff' : '#14120f' }}>
                              {getInitials(comment.user_name)}
                            </div>
                            <div>
                              <div style={styles.commentName}>{comment.user_name}</div>
                              <div style={styles.commentTime}>{formatTime(comment.created_at)}</div>
                            </div>
                          </div>
                        </div>
                        
                        <div style={styles.commentMessage}>{comment.message}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mobile feedback input - shown at bottom when in feedback mode on mobile */}
          {mode === 'feedback' && isMobile && (
            <div style={styles.mobileFeedbackPanel}>
              <div style={styles.mobileFeedbackHeader}>
                <MessageIconLarge />
                <span style={styles.panelTitle}>Feedback ({visibleComments.length})</span>
              </div>
              <div style={styles.commentInputSection}>
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={handleCommentKeyDown}
                  placeholder="Leave your feedback..."
                  style={styles.commentTextarea}
                  rows={2}
                />
                <div style={styles.commentInputFooter}>
                  <span style={styles.commentInputHint}>Enter to send</span>
                  <button 
                    onClick={handleSubmitComment} 
                    disabled={!commentText.trim() || submitting} 
                    style={{ ...styles.submitButton, opacity: commentText.trim() && !submitting ? 1 : 0.5 }}
                  >
                    <SendIcon />
                  </button>
                </div>
              </div>
              {visibleComments.length > 0 && (
                <div style={styles.mobileCommentsList}>
                  {visibleComments.slice(-3).map((comment) => (
                    <div key={comment.id} style={{ ...styles.mobileCommentCard, borderLeftColor: comment.user_id === user?.id ? '#6b7cff' : 'rgba(20,18,15,0.2)' }}>
                      <div style={styles.mobileCommentHeader}>
                        <span style={styles.mobileCommentName}>{comment.user_name}</span>
                        <span style={styles.mobileCommentTime}>{formatTime(comment.created_at)}</span>
                      </div>
                      <div style={styles.mobileCommentMessage}>{comment.message}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

// ============================================================================
// Styles
// ============================================================================
const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', backgroundColor: '#f6f2ea' },
  header: { maxWidth: '1400px', margin: '0 auto', padding: '16px 16px 0' },
  bar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' },
  logo: { fontWeight: 700, letterSpacing: '-0.02em', fontSize: '18px', textTransform: 'lowercase', color: '#14120f', textDecoration: 'none' },
  controls: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' },
  controlGroup: { display: 'flex', alignItems: 'center', gap: '8px' },
  separator: { width: '1px', height: '24px', backgroundColor: 'rgba(20,18,15,0.12)' },
  iconButton: { 
    display: 'inline-flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    width: '36px', 
    height: '36px', 
    borderRadius: '10px', 
    border: '1px solid rgba(20,18,15,0.16)', 
    backgroundColor: '#fff', 
    color: 'rgba(20,18,15,0.7)', 
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  youPill: { 
    height: '36px', 
    display: 'inline-flex', 
    alignItems: 'center', 
    gap: '8px', 
    padding: '0 12px', 
    borderRadius: '10px', 
    border: '1px solid rgba(20,18,15,0.16)', 
    backgroundColor: '#fff', 
    whiteSpace: 'nowrap' 
  },
  youLabel: { fontSize: '12px', color: 'rgba(20,18,15,0.5)', userSelect: 'none' },
  nameBadge: { 
    display: 'inline-flex', 
    alignItems: 'center', 
    height: '24px', 
    padding: '0 10px', 
    borderRadius: '8px', 
    border: '1px solid rgba(107,124,255,0.2)', 
    background: 'rgba(107,124,255,0.08)', 
    color: 'rgba(20,18,15,0.85)', 
    fontSize: '13px', 
    fontWeight: 500,
    cursor: 'text' 
  },
  nameEdit: { 
    height: '24px', 
    borderRadius: '8px', 
    border: '1px solid rgba(20,18,15,0.2)', 
    backgroundColor: '#fff', 
    padding: '0 10px', 
    fontSize: '13px', 
    outline: 'none', 
    width: '130px' 
  },
  allCommentsBtn: { 
    display: 'inline-flex', 
    alignItems: 'center', 
    gap: '6px', 
    height: '36px', 
    padding: '0 14px', 
    borderRadius: '10px', 
    border: '1px solid rgba(20,18,15,0.16)', 
    backgroundColor: '#fff', 
    color: '#14120f', 
    fontSize: '13px', 
    fontWeight: 500, 
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  mainCenter: { maxWidth: '1400px', margin: '0 auto', padding: '16px 20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 96px)' },
  mainViewer: { maxWidth: '1400px', margin: '0 auto', padding: '16px 16px 24px' },
  layoutBrowsing: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  layoutFeedback: { display: 'grid', gridTemplateColumns: '1fr 360px', gap: '20px', alignItems: 'start' },
  viewer: { 
    backgroundColor: '#fff', 
    borderRadius: '14px', 
    border: '2px solid', 
    transition: 'border-color 0.2s ease', 
    overflow: 'auto',
  },
  panel: { 
    backgroundColor: '#fff', 
    borderRadius: '14px', 
    border: '1px solid rgba(20,18,15,0.14)', 
    overflow: 'hidden', 
    height: 'fit-content', 
    maxHeight: '700px', 
    display: 'flex', 
    flexDirection: 'column',
    position: 'sticky',
    top: '16px',
  },
  panelHeader: { padding: '16px', borderBottom: '1px solid rgba(20,18,15,0.08)' },
  panelHeaderContent: { display: 'flex', alignItems: 'center', gap: '8px' },
  panelTitle: { fontSize: '14px', fontWeight: 600, color: '#14120f' },
  panelContent: { flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' },
  commentInputSection: { padding: '14px', borderBottom: '1px solid rgba(20,18,15,0.06)' },
  commentTextarea: { 
    width: '100%', 
    padding: '12px', 
    border: '1px solid rgba(20,18,15,0.12)', 
    borderRadius: '10px', 
    fontSize: '13px', 
    lineHeight: '1.5', 
    resize: 'vertical', 
    fontFamily: 'inherit', 
    outline: 'none', 
    backgroundColor: '#fafafa', 
    marginBottom: '8px',
    transition: 'border-color 0.15s ease',
  },
  commentInputFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  commentInputHint: { fontSize: '11px', color: 'rgba(20,18,15,0.35)' },
  submitButton: { 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    width: '34px', 
    height: '34px', 
    border: 'none', 
    borderRadius: '8px', 
    backgroundColor: '#6b7cff', 
    color: '#fff', 
    cursor: 'pointer',
    transition: 'opacity 0.15s ease',
  },
  commentsList: { padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 },
  commentCard: { padding: '12px', border: '1px solid', borderRadius: '10px', backgroundColor: '#fafafa' },
  commentHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' },
  commentAuthor: { display: 'flex', alignItems: 'center', gap: '8px' },
  commentAvatar: { width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '10px', fontWeight: 700, flexShrink: 0 },
  commentName: { fontSize: '13px', fontWeight: 600, color: '#14120f' },
  commentTime: { fontSize: '10px', color: 'rgba(20,18,15,0.4)' },
  commentMessage: { fontSize: '13px', lineHeight: '1.5', color: 'rgba(20,18,15,0.75)' },
  emptyState: { padding: '50px 20px', textAlign: 'center', color: 'rgba(20,18,15,0.35)', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' },
  emptyStateHint: { fontSize: '13px', margin: 0 },
  loading: { fontSize: '16px', color: 'rgba(20,18,15,0.62)' },
  errorCard: { backgroundColor: '#fff', borderRadius: '14px', padding: '32px', textAlign: 'center', border: '1px solid rgba(20,18,15,0.14)', maxWidth: '400px' },
  errorTitle: { fontSize: '24px', fontWeight: 600, color: '#dc2626', marginBottom: '8px' },
  errorText: { color: 'rgba(20,18,15,0.62)', marginBottom: '24px' },
  backButton: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '14px', fontWeight: 600, color: '#fff', backgroundColor: 'rgba(20,18,15,0.94)', borderRadius: '8px', textDecoration: 'none' },
  fullscreenContainer: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff', zIndex: 1000, overflow: 'auto' },
  fullscreenViewer: { position: 'relative', width: '100%', minHeight: '100%' },
  exitFullscreenBtn: { 
    position: 'fixed', 
    top: '16px', 
    right: '16px', 
    display: 'inline-flex', 
    alignItems: 'center', 
    height: '36px', 
    padding: '0 12px 0 14px', 
    borderRadius: '10px', 
    border: '1px solid rgba(20,18,15,0.14)', 
    backgroundColor: '#fff', 
    color: 'rgba(20,18,15,0.8)', 
    fontSize: '13px', 
    fontWeight: 600, 
    cursor: 'pointer', 
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)', 
    zIndex: 1001,
    transition: 'background-color 0.15s ease',
  },
  exitFullscreenText: { letterSpacing: '-0.01em' },
  exitFullscreenDivider: { width: '1px', height: '16px', backgroundColor: 'rgba(20,18,15,0.12)', margin: '0 10px' },
  backBtn: { display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(20,18,15,0.14)', backgroundColor: '#fff', color: '#14120f', fontSize: '13px', fontWeight: 500, cursor: 'pointer' },
  privateBadge: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 14px', borderRadius: '10px', backgroundColor: 'rgba(107,124,255,0.08)', border: '1px solid rgba(107,124,255,0.2)', color: 'rgba(20,18,15,0.7)', fontSize: '13px', fontWeight: 500 },
  tableContainer: { maxWidth: '900px', margin: '0 auto', padding: '20px 20px 40px' },
  tableHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' },
  tableTitle: { fontSize: '20px', fontWeight: 600, color: '#14120f', margin: 0 },
  tableCount: { fontSize: '13px', color: 'rgba(20,18,15,0.5)' },
  table: { backgroundColor: '#fff', borderRadius: '12px', border: '1px solid rgba(20,18,15,0.14)', overflow: 'hidden' },
  tableRowHeader: { display: 'flex', alignItems: 'center', padding: '12px 16px', backgroundColor: 'rgba(20,18,15,0.03)', borderBottom: '1px solid rgba(20,18,15,0.1)', fontSize: '12px', fontWeight: 600, color: 'rgba(20,18,15,0.5)', textTransform: 'uppercase', letterSpacing: '0.03em' },
  tableRow: { display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid rgba(20,18,15,0.06)' },
  tableEmpty: { padding: '40px 20px', textAlign: 'center', color: 'rgba(20,18,15,0.5)', fontSize: '14px' },
  tableCell: { fontSize: '13px' },
  tableAvatar: { width: '32px', height: '32px', borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 },
  tableUserName: { fontWeight: 600, color: '#14120f', fontSize: '13px' },
  tableTime: { fontSize: '11px', color: 'rgba(20,18,15,0.45)' },
  // Mobile feedback styles
  mobileFeedbackPanel: {
    marginTop: '16px',
    backgroundColor: '#fff',
    borderRadius: '14px',
    border: '1px solid rgba(20,18,15,0.14)',
    overflow: 'hidden',
  },
  mobileFeedbackHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 14px 0',
  },
  mobileCommentsList: {
    padding: '12px 14px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  mobileCommentCard: {
    padding: '10px 12px',
    borderLeft: '3px solid',
    backgroundColor: '#fafafa',
    borderRadius: '0 8px 8px 0',
  },
  mobileCommentHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  mobileCommentName: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#14120f',
  },
  mobileCommentTime: {
    fontSize: '10px',
    color: 'rgba(20,18,15,0.4)',
  },
  mobileCommentMessage: {
    fontSize: '13px',
    lineHeight: '1.4',
    color: 'rgba(20,18,15,0.75)',
  },
}