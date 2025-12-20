import { useMemo } from 'react'

interface ArtifactRendererProps {
  code: string
}

export default function ArtifactRenderer({ code }: ArtifactRendererProps) {
  const iframeContent = useMemo(() => {
    // Detectar si es React (contiene export default, function Component, o JSX)
    const isReact = /export\s+default|function\s+\w+\s*\(|const\s+\w+\s*=\s*\(/.test(code) &&
                    /<\w+/.test(code)

    if (isReact) {
      return generateReactHTML(code)
    } else {
      return generatePlainHTML(code)
    }
  }, [code])

  return (
    <iframe
      srcDoc={iframeContent}
      style={{
        width: '100%',
        height: '100%',
        border: 'none',
        borderRadius: '8px',
        backgroundColor: '#fff',
      }}
      sandbox="allow-scripts"
      title="Artifact Preview"
    />
  )
}

function generateReactHTML(code: string): string {
  // Extraer el nombre del componente exportado
  const exportMatch = code.match(/export\s+default\s+(?:function\s+)?(\w+)/)
  const componentName = exportMatch?.[1] || 'App'

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/lucide-react@0.263.1/dist/umd/lucide-react.min.js"></script>
  <script src="https://unpkg.com/recharts@2.8.0/umd/Recharts.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; }
    #root { min-height: 100vh; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="react">
    const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext } = React;
    
    // Lucide icons (si están disponibles)
    const LucideIcons = window.lucide || {};
    
    // Recharts (si está disponible)
    const { 
      LineChart, Line, BarChart, Bar, PieChart, Pie, 
      XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
      ResponsiveContainer, Cell, Area, AreaChart 
    } = window.Recharts || {};

    // Código del usuario
    ${code}

    // Renderizar
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(${componentName}));
  </script>
</body>
</html>`
}

function generatePlainHTML(code: string): string {
  // Si ya es HTML completo, usarlo directamente
  if (code.includes('<!DOCTYPE') || code.includes('<html')) {
    // Inyectar Tailwind si no lo tiene
    if (!code.includes('tailwindcss')) {
      return code.replace(
        '<head>',
        `<head>
    <script src="https://cdn.tailwindcss.com"></script>`
      )
    }
    return code
  }

  // Si es un fragmento HTML, envolverlo
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body>
  ${code}
</body>
</html>`
}
