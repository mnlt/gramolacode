import { useMemo } from 'react'

interface ArtifactRendererProps {
  code: string
}

export default function ArtifactRenderer({ code }: ArtifactRendererProps) {
  const iframeContent = useMemo(() => {
    const trimmedCode = code.trim()
    
    if (/^<!doctype|^<html/i.test(trimmedCode)) {
      return generatePlainHTML(trimmedCode)
    }
    
    return generateReactHTML(trimmedCode)
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
  // Extraer nombre del componente
  let componentName = 'App'
  const exportFuncMatch = code.match(/export\s+default\s+function\s+(\w+)/)
  if (exportFuncMatch) {
    componentName = exportFuncMatch[1]
  } else {
    const exportNameMatch = code.match(/export\s+default\s+(\w+)\s*;?\s*$/)
    if (exportNameMatch) {
      componentName = exportNameMatch[1]
    }
  }

  // Limpiar código
  const cleanCode = code
    // Quitar imports
    .replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '')
    .replace(/^import\s+['"].*?['"];?\s*$/gm, '')
    // Quitar export default function -> function
    .replace(/export\s+default\s+function\s+/, 'function ')
    // Quitar export default Component al final
    .replace(/export\s+default\s+\w+\s*;?\s*$/, '')
    .trim()

  // Escapar para meter en script
  const escaped = cleanCode
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$')

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <script src="https://unpkg.com/lucide-react@0.263.1/dist/umd/lucide-react.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; min-height: 100vh; }
    #root { min-height: 100vh; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    // Hooks de React
    const { useState, useEffect, useRef, useMemo, useCallback, createContext, useContext, Fragment, useReducer, useId, memo, forwardRef } = React;
    
    // Lucide icons
    const Icons = window.lucide || {};
    Object.keys(Icons).forEach(key => window[key] = Icons[key]);

    const code = \`${escaped}\`;
    
    try {
      const transformed = Babel.transform(code, { 
        presets: ['react', 'typescript'],
        filename: 'artifact.tsx'
      }).code;
      
      eval(transformed);
      
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(${componentName}));
    } catch (err) {
      document.getElementById('root').innerHTML = '<div style="padding: 20px; color: #dc2626;"><strong>Error:</strong> ' + err.message + '</div>';
      console.error(err);
    }
  </script>
</body>
</html>`
}

function generatePlainHTML(code: string): string {
  if (!code.includes('tailwindcss')) {
    return code.replace(/<head>/i, `<head>\n    <script src="https://cdn.tailwindcss.com"></script>`)
  }
  return code
}