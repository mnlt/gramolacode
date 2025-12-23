import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase, type Artifact } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

export default function HomePage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [artifacts, setArtifacts] = useState<Artifact[]>([])
  const [loadingArtifacts, setLoadingArtifacts] = useState(true)
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    async function fetchArtifacts() {
      if (!user) return

      try {
        const { data, error: fetchError } = await supabase
          .from('artifacts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })

        if (fetchError) throw fetchError
        setArtifacts(data || [])
      } catch (err) {
        console.error('Error fetching artifacts:', err)
      } finally {
        setLoadingArtifacts(false)
      }
    }

    if (!authLoading) {
      fetchArtifacts()
    }
  }, [user, authLoading])

  const handleSubmit = async () => {
    if (!code.trim()) {
      setError('Please paste your artifact code')
      return
    }

    if (!user) {
      setError('Connecting, please wait...')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: insertError } = await supabase
        .from('artifacts')
        .insert({ 
          code: code.trim(),
          user_id: user.id
        })
        .select('id')
        .single()

      if (insertError) throw insertError

      navigate(`/a/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error saving artifact')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.logo}>gramola</div>
      </header>

      <main style={styles.main}>
        {/* Hero */}
        <section style={styles.hero}>
          <h1 style={styles.title}>Paste. Share. Iterate.</h1>
          <p style={styles.subtitle}>
          Turn any AI-generated artifact - code, images, markdown, text — into a live link. Anyone can open it and leave feedback instantly. No signup required.
          </p>
        </section>

        {/* Composer */}
        <section style={styles.composer}>
          <div style={styles.field}>
            <textarea
              style={styles.textarea}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste your artifact code…"
              aria-label="Paste your artifact code here"
            />

            <div style={styles.actionbar}>
              {error && <span style={styles.error}>{error}</span>}
              <button
                style={{
                  ...styles.cta,
                  opacity: loading || authLoading ? 0.7 : 1,
                }}
                onClick={handleSubmit}
                disabled={loading || authLoading}
                type="button"
                data-cta
              >
                {authLoading ? 'Connecting...' : loading ? 'Generating...' : 'Generate link'}
                <span style={styles.arrow}>→</span>
              </button>
            </div>
          </div>
        </section>

        {/* Your links - only shown if there are artifacts */}
        {!authLoading && !loadingArtifacts && artifacts.length > 0 && (
          <section style={styles.linksSection}>
            <h2 style={styles.linksTitle}>Your links</h2>
            <div style={styles.linksList}>
              {artifacts.map((artifact) => (
                <Link
                  key={artifact.id}
                  to={`/a/${artifact.id}`}
                  style={styles.linkItem}
                >
                  <div style={styles.linkPreview}>
                    {artifact.code.slice(0, 60)}...
                  </div>
                  <div style={styles.linkDate}>
                    {formatDate(artifact.created_at)}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f6f2ea',
  },
  header: {
    maxWidth: '960px',
    margin: '0 auto',
    padding: '26px 20px 0',
  },
  logo: {
    fontWeight: 700,
    letterSpacing: '-0.02em',
    fontSize: '18px',
    textTransform: 'lowercase',
    color: '#14120f',
  },
  main: {
    maxWidth: '960px',
    margin: '0 auto',
    padding: '44px 20px 72px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  hero: {
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'ui-serif, "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif',
    fontWeight: 600,
    letterSpacing: '-0.02em',
    lineHeight: 1.06,
    fontSize: 'clamp(34px, 4.5vw, 56px)',
    margin: 0,
    color: '#14120f',
  },
  subtitle: {
    margin: 0,
    color: 'rgba(20, 18, 15, 0.62)',
    lineHeight: 1.55,
    fontSize: '16px',
    maxWidth: '62ch',
  },
  composer: {
    border: '1px solid rgba(20, 18, 15, 0.14)',
    borderRadius: '16px',
    backgroundColor: '#ffffff',
    padding: '14px',
  },
  field: {
    position: 'relative',
    borderRadius: '12px',
    border: '1px solid rgba(20, 18, 15, 0.14)',
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  textarea: {
    width: '100%',
    minHeight: '320px',
    resize: 'vertical',
    border: 0,
    outline: 'none',
    backgroundColor: 'transparent',
    padding: '16px 16px 64px 16px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: '13px',
    lineHeight: 1.55,
    color: 'rgba(20, 18, 15, 0.92)',
  },
  actionbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: '8px 10px',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: '#fff',
    borderTop: '1px solid rgba(20, 18, 15, 0.10)',
  },
  error: {
    color: '#dc2626',
    fontSize: '13px',
  },
  cta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(20, 18, 15, 0.18)',
    backgroundColor: 'rgba(20, 18, 15, 0.94)',
    color: 'white',
    fontSize: '13px',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    cursor: 'pointer',
  },
  arrow: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '22px',
    height: '22px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    fontSize: '14px',
  },
  linksSection: {
    marginTop: '16px',
  },
  linksTitle: {
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '12px',
    color: 'rgba(20, 18, 15, 0.62)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  linksList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  linkItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    padding: '12px 16px',
    textDecoration: 'none',
    border: '1px solid rgba(20, 18, 15, 0.14)',
    transition: 'border-color 0.2s',
  },
  linkPreview: {
    fontSize: '13px',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    color: 'rgba(20, 18, 15, 0.72)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    flex: 1,
    marginRight: '16px',
  },
  linkDate: {
    fontSize: '12px',
    color: 'rgba(20, 18, 15, 0.5)',
    whiteSpace: 'nowrap',
  },
}