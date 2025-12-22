import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase, type Artifact } from '../lib/supabase'
import ArtifactRenderer from '../components/ArtifactRenderer'

export default function ViewerPage() {
  const { id } = useParams<{ id: string }>()
  const [artifact, setArtifact] = useState<Artifact | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
        setError(err instanceof Error ? err.message : 'Artefacto no encontrado')
      } finally {
        setLoading(false)
      }
    }

    fetchArtifact()
  }, [id])

  if (loading) {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <Link to="/" style={styles.logo}>gramola</Link>
        </header>
        <main style={styles.main}>
          <div style={styles.loading}>Cargando...</div>
        </main>
      </div>
    )
  }

  if (error || !artifact) {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <Link to="/" style={styles.logo}>gramola</Link>
        </header>
        <main style={styles.main}>
          <div style={styles.errorCard}>
            <h2 style={styles.errorTitle}>Error</h2>
            <p style={styles.errorText}>{error || 'Artefacto no encontrado'}</p>
            <Link to="/" style={styles.backButton}>
              Volver al inicio
            </Link>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <Link to="/" style={styles.logo}>gramola</Link>
      </header>
      <main style={styles.viewerMain}>
        <div style={styles.viewerContainer}>
          <ArtifactRenderer code={artifact.code} />
        </div>
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: '16px 24px',
  },
  logo: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#1a1a1a',
    textDecoration: 'none',
  },
  main: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  viewerMain: {
    flex: 1,
    display: 'flex',
    padding: '24px',
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: '12px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
    minHeight: 'calc(100vh - 100px)',
  },
  loading: {
    fontSize: '18px',
    color: '#666',
  },
  errorCard: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '32px',
    textAlign: 'center' as const,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  },
  errorTitle: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#dc2626',
    marginBottom: '8px',
  },
  errorText: {
    color: '#666',
    marginBottom: '24px',
  },
  backButton: {
    display: 'inline-block',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 500,
    color: '#fff',
    backgroundColor: '#2563eb',
    borderRadius: '8px',
    textDecoration: 'none',
  },
}
