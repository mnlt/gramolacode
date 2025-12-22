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

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.bar}>
          <Link to="/" style={styles.logo}>gramola</Link>

          <div style={styles.controls}>
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

            {/* Segmented control */}
            <div style={styles.seg} role="group" aria-label="Mode">
              <button
                onClick={() => { setMode('browsing'); setShowCursor(false) }}
                style={{
                  ...styles.segButton,
                  ...(mode === 'browsing' ? styles.segButtonBrowsingActive : {}),
                }}
                aria-pressed={mode === 'browsing'}
              >
                Browsing
              </button>
              <button
                onClick={() => setMode('feedback')}
                style={{
                  ...styles.segButton,
                  ...(mode === 'feedback' ? styles.segButtonFeedbackActive : {}),
                }}
                aria-pressed={mode === 'feedback'}
              >
                Feedback
              </button>
            </div>

            {/* Copy link button */}
            <button
              onClick={copyLink}
              style={styles.copyButton}
              type="button"
              aria-label="Copy link"
            >
              Copy link
              {copied && <span style={styles.copyStatus}>· Copied</span>}
            </button>
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
    gap: '10px',
    flex: '0 0 auto',
    flexWrap: 'wrap',
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
  segButton: {
    border: 0,
    background: 'transparent',
    fontSize: '13px',
    padding: '8px 10px',
    borderRadius: '8px',
    cursor: 'pointer',
    color: 'rgba(20, 18, 15, 0.7)',
    lineHeight: 1,
    whiteSpace: 'nowrap',
  },
  segButtonBrowsingActive: {
    backgroundColor: 'rgba(20, 18, 15, 0.9)',
    color: '#fff',
  },
  segButtonFeedbackActive: {
    backgroundColor: '#6b7cff',
    color: '#fff',
  },
  copyButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    height: '34px',
    padding: '0 12px',
    borderRadius: '10px',
    border: '1px solid rgba(0, 0, 0, 0.08)',
    backgroundColor: '#07c078',
    color: '#fff',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  copyStatus: {
    fontSize: '12px',
    opacity: 0.9,
    fontWeight: 600,
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
}