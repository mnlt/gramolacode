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
const EyeIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
const MessageIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
const ExpandIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
const ShrinkIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
const ListIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
const ArrowLeftIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
const GoToIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 8 16 12 12 16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
const SendIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/></svg>
const LockIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>

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
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })
  const [isOverViewer, setIsOverViewer] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  const [pendingPosition, setPendingPosition] = useState<{ x: number; y: number } | null>(null)
  const [expandedComment, setExpandedComment] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [contentHeight, setContentHeight] = useState<number>(400)

  const [copyHover, setCopyHover] = useState(false)
  const [fullscreenHover, setFullscreenHover] = useState(false)
  const [exitHover, setExitHover] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640)

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

  // Callback para recibir la altura del contenido desde ArtifactRenderer
  const handleContentHeight = useCallback((height: number) => {
    if (height > 100) {
      setContentHeight(height)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) setIsFullscreen(false)
        else if (expandedComment) setExpandedComment(null)
        else if (pendingPosition) { setPendingPosition(null); setInputValue('') }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen, expandedComment, pendingPosition])

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640)
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

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (mode !== 'feedback') return
    const target = e.target as HTMLElement
    if (target.closest('[data-pin]') || target.closest('[data-input-card]')) return
    const overlay = e.currentTarget as HTMLElement
    const rect = overlay.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setExpandedComment(null)
    setPendingPosition({ x, y })
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mode !== 'feedback') return
    const overlay = e.currentTarget as HTMLElement
    const rect = overlay.getBoundingClientRect()
    setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    setIsOverViewer(true)
  }

  const handleMouseLeave = () => setIsOverViewer(false)

  const handlePinClick = (e: React.MouseEvent, comment: Comment) => {
    e.stopPropagation()
    if (isOwner || comment.user_id === user?.id) {
      setExpandedComment(expandedComment === comment.id ? null : comment.id)
      setPendingPosition(null)
    }
  }

  const getCardPosition = (xPercent: number, yPercent: number): React.CSSProperties => ({
    position: 'absolute',
    ...(xPercent > 65 ? { right: '40px', left: 'auto' } : { left: '40px', right: 'auto' }),
    ...(yPercent > 70 ? { bottom: '-10px', top: 'auto' } : { top: '-10px' }),
  })

  const handleSubmitComment = async () => {
    if (!inputValue.trim() || !pendingPosition || !id || !user) return
    setSubmitting(true)
    try {
      const { data, error: err } = await supabase.from('comments').insert({
        artifact_id: id, user_id: user.id, user_name: userName,
        x_percent: pendingPosition.x, y_percent: pendingPosition.y, message: inputValue.trim()
      }).select().single()
      if (err) throw err
      setComments([...comments, data])
      setPendingPosition(null)
      setInputValue('')
    } catch (err) { console.error('Error:', err) }
    finally { setSubmitting(false) }
  }

  const handleCommentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment() }
    else if (e.key === 'Escape') { setPendingPosition(null); setInputValue('') }
  }

  const goToComment = (commentId: string) => {
    const comment = comments.find(c => c.id === commentId)
    setMode('feedback')
    setView('artifact')
    setTimeout(() => {
      setExpandedComment(commentId)
      if (comment && viewerRef.current) {
        const viewerTop = viewerRef.current.offsetTop
        const commentY = (comment.y_percent / 100) * contentHeight
        window.scrollTo({ top: viewerTop + commentY - window.innerHeight / 3, behavior: 'smooth' })
      }
    }, 150)
  }

  const toggleFullscreen = () => setIsFullscreen(!isFullscreen)

  if (loading) return (
    <div style={styles.container}>
      <header style={styles.header}><div style={styles.bar}><Link to="/" style={styles.logo}>gramola</Link></div></header>
      <main style={styles.mainCenter}><div style={styles.loading}>Loading...</div></main>
    </div>
  )

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
          {!isMobile && <div style={styles.tableRowHeader}><div style={{ ...styles.tableCell, flex: '0 0 160px' }}>User</div><div style={{ ...styles.tableCell, flex: 1 }}>Comment</div><div style={{ ...styles.tableCell, flex: '0 0 80px', textAlign: 'right' as const }}></div></div>}
          {comments.length === 0 ? <div style={styles.tableEmpty}>No feedback yet</div> : comments.map(c => (
            <div key={c.id} style={{ ...styles.tableRow, ...(isMobile ? { flexDirection: 'column' as const, alignItems: 'stretch', gap: '10px' } : {}) }}>
              <div style={isMobile ? { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } : { ...styles.tableCell, flex: '0 0 160px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ ...styles.tableAvatar, backgroundColor: c.user_id === user?.id ? '#6b7cff' : '#14120f' }}>{getInitials(c.user_name)}</div>
                  <div><div style={styles.tableUserName}>{c.user_name}</div><div style={styles.tableTime}>{formatTime(c.created_at)}</div></div>
                </div>
                {isMobile && <button style={styles.goToBtn} onClick={() => goToComment(c.id)}><GoToIcon /></button>}
              </div>
              <div style={isMobile ? { color: 'rgba(20,18,15,0.8)', fontSize: '13px', lineHeight: 1.5 } : { ...styles.tableCell, flex: 1, color: 'rgba(20,18,15,0.8)' }}>{c.message}</div>
              {!isMobile && <div style={{ ...styles.tableCell, flex: '0 0 80px', textAlign: 'right' as const }}><button style={styles.goToBtn} onClick={() => goToComment(c.id)}><GoToIcon />Go to</button></div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  if (isFullscreen) return (
    <div style={styles.fullscreenContainer}>
      <div ref={viewerRef} style={{ ...styles.fullscreenViewer, height: contentHeight }}>
        <ArtifactRenderer code={artifact.code} onHeightChange={handleContentHeight} />
        {mode === 'feedback' && (
          <div style={{ ...styles.fullscreenOverlay, height: contentHeight }} onClick={handleOverlayClick} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
            {visibleComments.map(c => {
              const isExpanded = expandedComment === c.id
              const isMine = c.user_id === user?.id
              return (
                <div key={c.id} data-pin="true" style={{ ...styles.pinContainer, left: `${c.x_percent}%`, top: `${c.y_percent}%`, zIndex: isExpanded ? 100 : 10 }}>
                  <div style={{ ...styles.pin, ...(isMine ? styles.pinMine : styles.pinOther), ...(isExpanded ? styles.pinExpanded : {}) }} onClick={(e) => handlePinClick(e, c)}>{getInitials(c.user_name)}</div>
                  {isExpanded && (
                    <div style={{ ...styles.commentCard, ...getCardPosition(c.x_percent, c.y_percent), width: 'min(260px, calc(100vw - 80px))' }}>
                      <div style={styles.commentCardHeader}><div style={styles.commentCardName}>{c.user_name}</div><button style={styles.commentCardClose} onClick={(e) => { e.stopPropagation(); setExpandedComment(null) }}>×</button></div>
                      <div style={styles.commentCardMessage}>{c.message}</div>
                    </div>
                  )}
                </div>
              )
            })}
            {pendingPosition && (
              <div data-input-card="true" style={{ ...styles.pinContainer, left: `${pendingPosition.x}%`, top: `${pendingPosition.y}%`, zIndex: 200 }}>
                <div style={{ ...styles.pin, ...styles.pinMine }}>{getInitials(userName)}</div>
                <div style={{ ...styles.inputCard, ...getCardPosition(pendingPosition.x, pendingPosition.y), width: 'min(260px, calc(100vw - 80px))' }}>
                  <div style={styles.inputCardHeader}><span style={styles.inputCardName}>{userName}</span></div>
                  <textarea ref={textareaRef} style={styles.inputTextarea} placeholder="Add your feedback..." value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleCommentKeyDown} rows={2} />
                  <div style={styles.inputCardFooter}>
                    <span style={styles.inputHint}>Enter ↵</span>
                    <div style={styles.inputActions}>
                      <button style={styles.cancelBtn} onClick={() => { setPendingPosition(null); setInputValue('') }}>Cancel</button>
                      <button style={{ ...styles.sendBtn, opacity: !inputValue.trim() || submitting ? 0.5 : 1 }} onClick={handleSubmitComment} disabled={!inputValue.trim() || submitting}><SendIcon /></button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {isOverViewer && !pendingPosition && !expandedComment && <div style={{ ...styles.cursor, left: cursorPos.x, top: cursorPos.y }}>+ Click to comment</div>}
          </div>
        )}
      </div>
      <button onClick={toggleFullscreen} onMouseEnter={() => setExitHover(true)} onMouseLeave={() => setExitHover(false)} style={{ ...styles.exitFullscreenBtn, backgroundColor: exitHover ? '#f5f5f5' : '#fff' }} type="button">
        <span style={styles.exitFullscreenText}>gramola</span><span style={styles.exitFullscreenDivider} /><ShrinkIcon />
      </button>
    </div>
  )

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.bar}>
          <Link to="/" style={styles.logo}>gramola</Link>
          <div style={{ ...styles.controls, ...(isMobile ? { gap: '8px' } : {}) }}>
            <div style={styles.controlGroup}>
              <div style={styles.seg} role="group">
                <button onClick={() => { setMode('browsing'); setIsOverViewer(false); setPendingPosition(null); setExpandedComment(null) }} style={{ ...styles.segIconButton, ...(mode === 'browsing' ? styles.segButtonBrowsingActive : {}) }} title="Browsing mode"><EyeIcon /></button>
                <button onClick={() => setMode('feedback')} style={{ ...styles.segIconButton, ...(mode === 'feedback' ? styles.segButtonFeedbackActive : {}) }} title="Feedback mode"><MessageIcon /></button>
              </div>
              <div style={{ ...styles.youPill, ...(isMobile ? { padding: '0 8px', gap: 0 } : {}) }}>
                {!isMobile && <span style={styles.youLabel}>You:</span>}
                {isEditingName ? <input ref={inputRef} type="text" maxLength={24} value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => saveName(editValue)} onKeyDown={handleNameKeyDown} style={{ ...styles.nameEdit, ...(isMobile ? { width: '100px' } : {}) }} autoFocus />
                  : <button onClick={startEditing} style={{ ...styles.nameBadge, ...(isMobile ? { maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis' } : {}) }} type="button">{isMobile ? getInitials(userName) : userName}</button>}
              </div>
            </div>
            {!isMobile && <div style={styles.separator} />}
            <div style={styles.controlGroup}>
              {isOwner && comments.length > 0 && <button style={{ ...styles.allCommentsBtn, ...(isMobile ? { padding: '0 10px' } : {}) }} onClick={() => setView('table')}><ListIcon />{!isMobile && <span>All ({comments.length})</span>}{isMobile && <span>{comments.length}</span>}</button>}
              <button onClick={copyLink} onMouseEnter={() => setCopyHover(true)} onMouseLeave={() => setCopyHover(false)} style={{ ...styles.iconButton, backgroundColor: copied ? '#07c078' : (copyHover ? 'rgba(20,18,15,0.06)' : '#fff'), color: copied ? '#fff' : 'rgba(20,18,15,0.7)', borderColor: copied ? '#07c078' : 'rgba(20,18,15,0.16)' }} type="button" title={copied ? 'Copied!' : 'Copy link'}>{copied ? <CheckIcon /> : <CopyIcon />}</button>
              {!isMobile && <button onClick={toggleFullscreen} onMouseEnter={() => setFullscreenHover(true)} onMouseLeave={() => setFullscreenHover(false)} style={{ ...styles.iconButton, backgroundColor: fullscreenHover ? 'rgba(20,18,15,0.06)' : '#fff' }} type="button" title="Fullscreen"><ExpandIcon /></button>}
            </div>
          </div>
        </div>
      </header>

      <main style={styles.mainViewer}>
        <section 
          ref={viewerRef} 
          style={{ 
            ...styles.viewer, 
            borderColor: mode === 'feedback' ? '#6b7cff' : 'rgba(20,18,15,0.25)',
            height: contentHeight,
            minHeight: 400,
          }}
        >
          <ArtifactRenderer code={artifact.code} onHeightChange={handleContentHeight} />
          {mode === 'feedback' && (
            <div 
              style={{ ...styles.overlay, height: contentHeight }} 
              onClick={handleOverlayClick} 
              onMouseMove={handleMouseMove} 
              onMouseLeave={handleMouseLeave}
            >
              {visibleComments.map(c => {
                const isExpanded = expandedComment === c.id
                const isMine = c.user_id === user?.id
                return (
                  <div key={c.id} data-pin="true" style={{ ...styles.pinContainer, left: `${c.x_percent}%`, top: `${c.y_percent}%`, zIndex: isExpanded ? 100 : 10 }}>
                    <div style={{ ...styles.pin, ...(isMine ? styles.pinMine : styles.pinOther), ...(isExpanded ? styles.pinExpanded : {}) }} onClick={(e) => handlePinClick(e, c)}>{getInitials(c.user_name)}</div>
                    {isExpanded && (
                      <div style={{ ...styles.commentCard, ...getCardPosition(c.x_percent, c.y_percent), width: 'min(260px, calc(100vw - 80px))' }}>
                        <div style={styles.commentCardHeader}><div style={styles.commentCardName}>{c.user_name}</div><button style={styles.commentCardClose} onClick={(e) => { e.stopPropagation(); setExpandedComment(null) }}>×</button></div>
                        <div style={styles.commentCardMessage}>{c.message}</div>
                      </div>
                    )}
                  </div>
                )
              })}
              {pendingPosition && (
                <div data-input-card="true" style={{ ...styles.pinContainer, left: `${pendingPosition.x}%`, top: `${pendingPosition.y}%`, zIndex: 200 }}>
                  <div style={{ ...styles.pin, ...styles.pinMine }}>{getInitials(userName)}</div>
                  <div style={{ ...styles.inputCard, ...getCardPosition(pendingPosition.x, pendingPosition.y), width: 'min(260px, calc(100vw - 80px))' }}>
                    <div style={styles.inputCardHeader}><span style={styles.inputCardName}>{userName}</span></div>
                    <textarea ref={textareaRef} style={styles.inputTextarea} placeholder="Add your feedback..." value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={handleCommentKeyDown} rows={2} />
                    <div style={styles.inputCardFooter}>
                      <span style={styles.inputHint}>Enter ↵</span>
                      <div style={styles.inputActions}>
                        <button style={styles.cancelBtn} onClick={() => { setPendingPosition(null); setInputValue('') }}>Cancel</button>
                        <button style={{ ...styles.sendBtn, opacity: !inputValue.trim() || submitting ? 0.5 : 1 }} onClick={handleSubmitComment} disabled={!inputValue.trim() || submitting}><SendIcon /></button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {isOverViewer && !pendingPosition && !expandedComment && <div style={{ ...styles.cursor, left: cursorPos.x, top: cursorPos.y }}>+ Click to comment</div>}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', backgroundColor: '#f6f2ea' },
  header: { maxWidth: '1100px', margin: '0 auto', padding: '18px 16px 0' },
  bar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' },
  logo: { fontWeight: 700, letterSpacing: '-0.02em', fontSize: '18px', textTransform: 'lowercase', color: '#14120f', textDecoration: 'none' },
  controls: { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  controlGroup: { display: 'flex', alignItems: 'center', gap: '8px' },
  separator: { width: '1px', height: '20px', backgroundColor: 'rgba(20,18,15,0.15)' },
  iconButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '34px', height: '34px', borderRadius: '10px', border: '1px solid rgba(20,18,15,0.16)', backgroundColor: '#fff', color: 'rgba(20,18,15,0.7)', cursor: 'pointer' },
  youPill: { height: '34px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0 10px', borderRadius: '10px', border: '1px solid rgba(20,18,15,0.16)', backgroundColor: '#fff', whiteSpace: 'nowrap' },
  youLabel: { fontSize: '12px', color: 'rgba(20,18,15,0.55)', userSelect: 'none' },
  nameBadge: { display: 'inline-flex', alignItems: 'center', height: '22px', padding: '0 8px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', background: '#e8ebff', color: 'rgba(20,18,15,0.82)', fontSize: '13px', cursor: 'text' },
  nameEdit: { height: '22px', borderRadius: '8px', border: '1px solid rgba(20,18,15,0.18)', backgroundColor: '#fff', padding: '0 8px', fontSize: '13px', outline: 'none', width: '120px' },
  seg: { display: 'inline-flex', border: '1px solid rgba(20,18,15,0.18)', borderRadius: '10px', backgroundColor: '#fff', padding: '2px', gap: '2px', height: '34px' },
  segIconButton: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', border: 0, background: 'transparent', borderRadius: '8px', cursor: 'pointer', color: 'rgba(20,18,15,0.5)' },
  segButtonBrowsingActive: { backgroundColor: 'rgba(20,18,15,0.9)', color: '#fff' },
  segButtonFeedbackActive: { backgroundColor: '#6b7cff', color: '#fff' },
  allCommentsBtn: { display: 'inline-flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 12px', borderRadius: '10px', border: '1px solid rgba(20,18,15,0.16)', backgroundColor: '#fff', color: '#14120f', fontSize: '13px', fontWeight: 500, cursor: 'pointer' },
  mainCenter: { maxWidth: '1100px', margin: '0 auto', padding: '16px 20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 96px)' },
  mainViewer: { maxWidth: '1100px', margin: '0 auto', padding: '16px 16px 24px' },
  viewer: { 
    position: 'relative', 
    backgroundColor: '#fff', 
    borderRadius: '14px', 
    border: '2px solid rgba(20,18,15,0.25)', 
    transition: 'border-color 0.2s',
    overflow: 'hidden',
  },
  overlay: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    cursor: 'crosshair', 
    zIndex: 10 
  },
  pinContainer: { position: 'absolute', transform: 'translate(-50%, -50%)' },
  pin: { width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, cursor: 'pointer', border: '2px solid #fff' },
  pinMine: { backgroundColor: '#6b7cff', color: '#fff', boxShadow: '0 2px 8px rgba(107,124,255,0.4)' },
  pinOther: { backgroundColor: '#14120f', color: '#fff', boxShadow: '0 2px 8px rgba(20,18,15,0.3)' },
  pinExpanded: { transform: 'scale(1.1)', boxShadow: '0 4px 12px rgba(107,124,255,0.5)' },
  commentCard: { position: 'absolute', padding: '14px', borderRadius: '12px', backgroundColor: '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1px solid rgba(20,18,15,0.1)' },
  commentCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  commentCardName: { fontSize: '13px', fontWeight: 600, color: '#14120f' },
  commentCardClose: { width: '22px', height: '22px', borderRadius: '6px', border: 'none', backgroundColor: 'rgba(20,18,15,0.06)', color: 'rgba(20,18,15,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' },
  commentCardMessage: { fontSize: '13px', color: 'rgba(20,18,15,0.75)', lineHeight: 1.5 },
  inputCard: { position: 'absolute', padding: '14px', borderRadius: '12px', backgroundColor: '#fff', boxShadow: '0 4px 24px rgba(0,0,0,0.18)', border: '1px solid rgba(107,124,255,0.3)' },
  inputCardHeader: { marginBottom: '10px' },
  inputCardName: { fontSize: '13px', fontWeight: 600, color: '#14120f' },
  inputTextarea: { width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid rgba(20,18,15,0.14)', backgroundColor: '#fafafa', fontSize: '13px', lineHeight: 1.5, resize: 'none', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  inputCardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' },
  inputHint: { fontSize: '11px', color: 'rgba(20,18,15,0.4)' },
  inputActions: { display: 'flex', gap: '6px' },
  cancelBtn: { padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(20,18,15,0.14)', backgroundColor: '#fff', color: 'rgba(20,18,15,0.6)', fontSize: '12px', cursor: 'pointer' },
  sendBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '8px', border: 'none', backgroundColor: '#6b7cff', color: '#fff', cursor: 'pointer' },
  cursor: { position: 'absolute', pointerEvents: 'none', padding: '5px 10px', borderRadius: '6px', backgroundColor: 'rgba(20,18,15,0.8)', color: '#fff', fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap', transform: 'translate(12px, 12px)', zIndex: 1000 },
  loading: { fontSize: '16px', color: 'rgba(20,18,15,0.62)' },
  errorCard: { backgroundColor: '#fff', borderRadius: '14px', padding: '32px', textAlign: 'center', border: '1px solid rgba(20,18,15,0.14)', maxWidth: '400px' },
  errorTitle: { fontSize: '24px', fontWeight: 600, color: '#dc2626', marginBottom: '8px' },
  errorText: { color: 'rgba(20,18,15,0.62)', marginBottom: '24px' },
  backButton: { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '14px', fontWeight: 600, color: '#fff', backgroundColor: 'rgba(20,18,15,0.94)', borderRadius: '8px', textDecoration: 'none' },
  fullscreenContainer: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#fff', zIndex: 1000, overflow: 'auto' },
  fullscreenViewer: { position: 'relative', width: '100%', minHeight: '100%' },
  fullscreenOverlay: { position: 'absolute', top: 0, left: 0, right: 0, cursor: 'crosshair', zIndex: 10 },
  exitFullscreenBtn: { position: 'fixed', top: '16px', right: '16px', display: 'inline-flex', alignItems: 'center', height: '34px', padding: '0 10px 0 12px', borderRadius: '10px', border: '1px solid rgba(20,18,15,0.16)', backgroundColor: '#fff', color: 'rgba(20,18,15,0.8)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', zIndex: 1001 },
  exitFullscreenText: { letterSpacing: '-0.01em' },
  exitFullscreenDivider: { width: '1px', height: '16px', backgroundColor: 'rgba(20,18,15,0.15)', margin: '0 10px' },
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
  goToBtn: { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(107,124,255,0.3)', backgroundColor: 'rgba(107,124,255,0.06)', color: '#6b7cff', fontSize: '12px', fontWeight: 500, cursor: 'pointer' },
}