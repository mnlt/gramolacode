import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, type Artifact } from '../lib/supabase'
import ArtifactRenderer from '../components/ArtifactRenderer'

type Mode = 'browsing' | 'feedback'

const NAME_KEY = 'gramola_feedback_name'

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateDefaultName(): string {
  const adjectives = ['Curious', 'Quiet', 'Brave', 'Clever', 'Sunny', 'Swift', 'Calm', 'Bold', 'Kind', 'Witty']
  const animals = ['Otter', 'Lynx', 'Koala', 'Panda', 'Fox', 'Dolphin', 'Hawk', 'Badger', 'Turtle', 'Seal']
  return `${pick(adjectives)} ${pick(animals)}`
}

function getStoredName(): string {
  const saved = (localStorage.getItem(NAME_KEY) || '').trim()
  if (saved) return saved
  const name = generateDefaultName()
  localStorage.setItem(NAME_KEY, name)
  return name
}

// Icons
const CopyIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
)

const MessageIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)

const ExpandIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 3 21 3 21 9"/>
    <polyline points="9 21 3 21 3 15"/>
    <line x1="21" y1="3" x2="14" y2="10"/>
    <line x1="3" y1="21" x2="10" y2="14"/>
  </svg>
)

const ShrinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="4 14 10 14 10 20"/>
    <polyline points="20 10 14 10 14 4"/>
    <line x1="14" y1="10" x2="21" y2="3"/>
    <line x1="3" y1="21" x2="10" y2="14"/>
  </svg>
)

export default function ViewerPage() {
  const { id } = useParams<{ id: string }>()
  const [artifact, setArtifact] = useState<Artifact | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Viewer state
  const [mode, setMode] = useState<Mode>('browsing')
  const [userName, setUserName] = useState(getStoredName)
  const [isEditingName, setIsEditingName] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [copied, setCopied] = useState(false)
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 })
  const [showCursor, setShowCursor] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Hover states
  const [copyHover, setCopyHover] = useState(false)
  const [fullscreenHover, setFullscreenHover] = useState(false)
  const [exitHover, setExitHover] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const viewerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchArtifact() {
      if (!id) return

      try {
        const { data, error: fetchError } = await supabase
          .from('artifacts')
          .select('*')
          .eq('id', id)
          .single()

        if (fetchError) throw fetchError
        setArtifact(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Artifact not found')
      } finally {
        setLoading(false)
      }
    }

    fetchArtifact()
  }, [id])

  // Handle ESC to exit fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen])

  const saveName = useCallback((value: string) => {
    const trimmed = value.trim().slice(0, 24)
    const finalName = trimmed || generateDefaultName()
    localStorage.setItem(NAME_KEY, finalName)
    setUserName(finalName)
    setIsEditingName(false)
  }, [])

  const startEditing = () => {
    setEditValue(userName)
    setIsEditingName(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveName(editValue)
    } else if (e.key === 'Escape') {
      setIsEditingName(false)
    }
  }

  const copyLink = async () => {
    const link = window.location.href
    try {
      await navigator.clipboard.writeText(link)
    } catch {
      const tmp = document.createElement('textarea')
      tmp.value = link
      document.body.appendChild(tmp)
      tmp.select()
      document.execCommand('copy')
      tmp.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mode === 'feedback') {
      setCursorPos({ x: e.clientX, y: e.clientY })
      setShowCursor(true)
    }
  }

  const handleMouseLeave = () => {
    setShowCursor(false)
  }

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.bar}>
            <Link to="/" style={styles.logo}>gramola</Link>
          </div>
        </header>
        <main style={styles.main}>
          <div style={styles.loading}>Loading...</div>
        </main>
      </div>
    )
  }

  if (error || !artifact) {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.bar}>
            <Link to="/" style={styles.logo}>gramola</Link>
          </div>
        </header>
        <main style={styles.main}>
          <div style={styles.errorCard}>
            <h2 style={styles.errorTitle}>Error</h2>
            <p style={styles.errorText}>{error || 'Artifact not found'}</p>
            <Link to="/" style={styles.backButton}>
              Back to home
            </Link>
          </div>
        </main>
      </div>
    )
  }

  // Fullscreen mode
  if (isFullscreen) {
    return (
      <div style={styles.fullscreenContainer}>
        <div
          ref={viewerRef}
          style={{
            ...styles.fullscreenViewer,
            cursor: mode === 'feedback' ? 'none' : 'default',
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <ArtifactRenderer code={artifact.code} />
        </div>

        {/* Exit fullscreen button */}
        <button
          onClick={toggleFullscreen}
          onMouseEnter={() => setExitHover(true)}
          onMouseLeave={() => setExitHover(false)}
          style={{
            ...styles.exitFullscreenBtn,
            backgroundColor: exitHover ? '#f5f5f5' : '#fff',
          }}
          type="button"
          aria-label="Exit fullscreen"
        >
          <span style={styles.exitFullscreenText}>gramola</span>
          <span style={styles.exitFullscreenDivider} />
          <ShrinkIcon />
        </button>

        {/* Cursor label */}
        {showCursor && mode === 'feedback' && (
          <div
            style={{
              ...styles.cursorLabel,
              left: cursorPos.x,
              top: cursorPos.y,
            }}
          >
            {userName}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.bar}>
          <Link to="/" style={styles.logo}>gramola</Link>

          <div style={styles.controls}>
            {/* Left group: Mode toggle + Name */}
            <div style={styles.controlGroup}>
              {/* Mode toggle (icon buttons) */}
              <div style={styles.seg} role="group" aria-label="Mode">
                <button
                  onClick={() => { setMode('browsing'); setShowCursor(false) }}
                  style={{
                    ...styles.segIconButton,
                    ...(mode === 'browsing' ? styles.segButtonBrowsingActive : {}),
                  }}
                  aria-pressed={mode === 'browsing'}
                  title="Browsing mode"
                >
                  <EyeIcon />
                </button>
                <button
                  onClick={() => setMode('feedback')}
                  style={{
                    ...styles.segIconButton,
                    ...(mode === 'feedback' ? styles.segButtonFeedbackActive : {}),
                  }}
                  aria-pressed={mode === 'feedback'}
                  title="Feedback mode"
                >
                  <MessageIcon />
                </button>
              </div>

              {/* You: Name pill */}
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
                    onKeyDown={handleKeyDown}
                    style={styles.nameEdit}
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={startEditing}
                    style={styles.nameBadge}
                    type="button"
                    aria-label="Your name (click to edit)"
                  >
                    {userName}
                  </button>
                )}
              </div>
            </div>

            {/* Separator */}
            <div style={styles.separator} />

            {/* Right group: Copy + Fullscreen */}
            <div style={styles.controlGroup}>
              {/* Copy link button (icon only) */}
              <button
                onClick={copyLink}
                onMouseEnter={() => setCopyHover(true)}
                onMouseLeave={() => setCopyHover(false)}
                style={{
                  ...styles.iconButton,
                  backgroundColor: copied ? '#07c078' : (copyHover ? 'rgba(20, 18, 15, 0.06)' : '#fff'),
                  color: copied ? '#fff' : 'rgba(20, 18, 15, 0.7)',
                  borderColor: copied ? '#07c078' : 'rgba(20, 18, 15, 0.16)',
                }}
                type="button"
                aria-label="Copy link"
                title={copied ? 'Copied!' : 'Copy link'}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
              </button>

              {/* Fullscreen button */}
              <button
                onClick={toggleFullscreen}
                onMouseEnter={() => setFullscreenHover(true)}
                onMouseLeave={() => setFullscreenHover(false)}
                style={{
                  ...styles.iconButton,
                  backgroundColor: fullscreenHover ? 'rgba(20, 18, 15, 0.06)' : '#fff',
                }}
                type="button"
                aria-label="Enter fullscreen"
                title="Fullscreen"
              >
                <ExpandIcon />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main style={styles.mainViewer}>
        <section
          ref={viewerRef}
          style={{
            ...styles.viewer,
            borderColor: mode === 'feedback' ? '#6b7cff' : 'rgba(20, 18, 15, 0.25)',
            cursor: mode === 'feedback' ? 'none' : 'default',
          }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <ArtifactRenderer code={artifact.code} />
        </section>
      </main>

      {/* Cursor label */}
      {showCursor && mode === 'feedback' && (
        <div
          style={{
            ...styles.cursorLabel,
            left: cursorPos.x,
            top: cursorPos.y,
          }}
        >
          {userName}
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f6f2ea',
  },
  header: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '18px 20px 0',
  },
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },
  logo: {
    fontWeight: 700,
    letterSpacing: '-0.02em',
    fontSize: '18px',
    textTransform: 'lowercase',
    color: '#14120f',
    textDecoration: 'none',
    flex: '0 0 auto',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: '0 0 auto',
    flexWrap: 'wrap',
  },
  controlGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  separator: {
    width: '1px',
    height: '20px',
    backgroundColor: 'rgba(20, 18, 15, 0.15)',
  },
  iconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '34px',
    height: '34px',
    borderRadius: '10px',
    border: '1px solid rgba(20, 18, 15, 0.16)',
    backgroundColor: '#fff',
    color: 'rgba(20, 18, 15, 0.7)',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  },
  youPill: {
    height: '34px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 10px',
    borderRadius: '10px',
    border: '1px solid rgba(20, 18, 15, 0.16)',
    backgroundColor: '#fff',
    whiteSpace: 'nowrap',
  },
  youLabel: {
    fontSize: '12px',
    color: 'rgba(20, 18, 15, 0.55)',
    userSelect: 'none',
    lineHeight: 1,
  },
  nameBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    height: '22px',
    padding: '0 8px',
    borderRadius: '8px',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    background: '#e8ebff',
    color: 'rgba(20, 18, 15, 0.82)',
    fontSize: '13px',
    cursor: 'text',
  },
  nameEdit: {
    height: '22px',
    borderRadius: '8px',
    border: '1px solid rgba(20, 18, 15, 0.18)',
    backgroundColor: '#fff',
    padding: '0 8px',
    fontSize: '13px',
    outline: 'none',
    width: '120px',
  },
  seg: {
    display: 'inline-flex',
    border: '1px solid rgba(20, 18, 15, 0.18)',
    borderRadius: '10px',
    backgroundColor: '#fff',
    padding: '2px',
    gap: '2px',
    height: '34px',
  },
  segIconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    border: 0,
    background: 'transparent',
    borderRadius: '8px',
    cursor: 'pointer',
    color: 'rgba(20, 18, 15, 0.5)',
    transition: 'all 0.15s ease',
  },
  segButtonBrowsingActive: {
    backgroundColor: 'rgba(20, 18, 15, 0.9)',
    color: '#fff',
  },
  segButtonFeedbackActive: {
    backgroundColor: '#6b7cff',
    color: '#fff',
  },
  main: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '16px 20px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 'calc(100vh - 96px)',
  },
  mainViewer: {
    maxWidth: '1100px',
    margin: '0 auto',
    padding: '16px 20px 24px',
  },
  viewer: {
    position: 'relative',
    backgroundColor: '#ffffff',
    borderRadius: '14px',
    overflow: 'hidden',
    minHeight: 'calc(100vh - 96px)',
    border: '2px solid rgba(20, 18, 15, 0.25)',
    transition: 'border-color 0.2s',
  },
  loading: {
    fontSize: '16px',
    color: 'rgba(20, 18, 15, 0.62)',
  },
  errorCard: {
    backgroundColor: '#fff',
    borderRadius: '14px',
    padding: '32px',
    textAlign: 'center' as const,
    border: '1px solid rgba(20, 18, 15, 0.14)',
    maxWidth: '400px',
  },
  errorTitle: {
    fontFamily: 'ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
    fontSize: '24px',
    fontWeight: 600,
    color: '#dc2626',
    marginBottom: '8px',
  },
  errorText: {
    color: 'rgba(20, 18, 15, 0.62)',
    marginBottom: '24px',
  },
  backButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: 'rgba(20, 18, 15, 0.94)',
    borderRadius: '8px',
    textDecoration: 'none',
    border: '1px solid rgba(20, 18, 15, 0.18)',
  },
  cursorLabel: {
    position: 'fixed',
    padding: '4px 8px',
    fontSize: '12px',
    borderRadius: '8px',
    backgroundColor: '#6b7cff',
    color: 'white',
    whiteSpace: 'nowrap',
    pointerEvents: 'none',
    transform: 'translate(12px, 12px)',
    zIndex: 999,
  },
  // Fullscreen styles
  fullscreenContainer: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    zIndex: 1000,
  },
  fullscreenViewer: {
    width: '100%',
    height: '100%',
    overflow: 'auto',
  },
  exitFullscreenBtn: {
    position: 'fixed',
    top: '16px',
    right: '16px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0',
    height: '34px',
    padding: '0 10px 0 12px',
    borderRadius: '10px',
    border: '1px solid rgba(20, 18, 15, 0.16)',
    backgroundColor: '#fff',
    color: 'rgba(20, 18, 15, 0.8)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
    zIndex: 1001,
    transition: 'background-color 0.15s ease',
  },
  exitFullscreenText: {
    letterSpacing: '-0.01em',
  },
  exitFullscreenDivider: {
    width: '1px',
    height: '16px',
    backgroundColor: 'rgba(20, 18, 15, 0.15)',
    margin: '0 10px',
  },
}