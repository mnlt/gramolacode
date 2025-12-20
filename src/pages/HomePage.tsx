import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function HomePage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleSubmit = async () => {
    if (!code.trim()) {
      setError('Por favor, pega el código del artefacto')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data, error: insertError } = await supabase
        .from('artifacts')
        .insert({ code: code.trim() })
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

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.logo}>gramola</h1>
      </header>

      <main style={styles.main}>
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
              opacity: loading ? 0.7 : 1,
            }}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Guardando...' : 'Ver artefacto'}
          </button>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: '12px',
    padding: '32px',
    width: '100%',
    maxWidth: '600px',
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
    height: '300px',
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
}
