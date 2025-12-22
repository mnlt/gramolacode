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

  // Cargar artefactos del usuario
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
      setError('Por favor, pega el código del artefacto')
      return
    }

    if (!user) {
      setError('Iniciando sesión, espera un momento...')
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
      setError(err instanceof Error ? err.message : 'Error al guardar el artefacto')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.logo}>gramola</h1>
      </header>

      <main style={styles.main}>
        <div style={styles.content}>
          {/* Formulario para crear */}
          <div style={styles.card}>
            <h2 style={styles.title}>Pega tu artefacto</h2>
            <p style={styles.subtitle}>
              Soporta código React/JSX y HTML de Claude, GPT o Gemini
            </p>

            <textarea
              style={styles.textarea}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={`// Pega aquí el código de tu artefacto...
// Por ejemplo:

export default function MyComponent() {
  return (
    <div className="p-4 bg-blue-500 text-white">
      ¡Hola mundo!
    </div>
  )
}`}
            />

            {error && <p style={styles.error}>{error}</p>}

            <button
              style={{
                ...styles.button,
                opacity: loading || authLoading ? 0.7 : 1,
              }}
              onClick={handleSubmit}
              disabled={loading || authLoading}
            >
              {authLoading ? 'Conectando...' : loading ? 'Guardando...' : 'Ver artefacto'}
            </button>
          </div>

          {/* Lista de artefactos */}
          {!authLoading && artifacts.length > 0 && (
            <div style={styles.artifactsSection}>
              <h3 style={styles.artifactsTitle}>Mis artefactos</h3>
              <div style={styles.artifactsList}>
                {artifacts.map((artifact) => (
                  <Link
                    key={artifact.id}
                    to={`/a/${artifact.id}`}
                    style={styles.artifactItem}
                  >
                    <div style={styles.artifactPreview}>
                      {artifact.code.slice(0, 80)}...
                    </div>
                    <div style={styles.artifactDate}>
                      {formatDate(artifact.created_at)}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {!authLoading && !loadingArtifacts && artifacts.length === 0 && (
            <p style={styles.noArtifacts}>
              Aún no has creado ningún artefacto
            </p>
          )}
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
  },
  header: {
    padding: '16px 24px',
    borderBottom: '1px solid #e5e5e5',
    backgroundColor: '#fff',
  },
  logo: {
    fontSize: '24px',
    fontWeight: 700,
    color: '#1a1a1a',
    margin: 0,
  },
  main: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    padding: '24px',
  },
  content: {
    width: '100%',
    maxWidth: '600px',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '32px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  },
  title: {
    fontSize: '24px',
    fontWeight: 600,
    marginBottom: '8px',
  },
  subtitle: {
    color: '#666',
    marginBottom: '24px',
  },
  textarea: {
    width: '100%',
    height: '250px',
    padding: '16px',
    fontSize: '14px',
    fontFamily: 'Monaco, Consolas, monospace',
    border: '1px solid #ddd',
    borderRadius: '8px',
    resize: 'vertical',
    marginBottom: '16px',
  },
  error: {
    color: '#dc2626',
    marginBottom: '16px',
  },
  button: {
    width: '100%',
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: 500,
    color: '#fff',
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  artifactsSection: {
    marginTop: '32px',
  },
  artifactsTitle: {
    fontSize: '18px',
    fontWeight: 600,
    marginBottom: '16px',
    color: '#1a1a1a',
  },
  artifactsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  artifactItem: {
    display: 'block',
    backgroundColor: '#fff',
    borderRadius: '8px',
    padding: '16px',
    textDecoration: 'none',
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
    transition: 'box-shadow 0.2s',
  },
  artifactPreview: {
    fontSize: '13px',
    fontFamily: 'Monaco, Consolas, monospace',
    color: '#374151',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginBottom: '8px',
  },
  artifactDate: {
    fontSize: '12px',
    color: '#9ca3af',
  },
  noArtifacts: {
    textAlign: 'center',
    color: '#9ca3af',
    marginTop: '32px',
  },
}