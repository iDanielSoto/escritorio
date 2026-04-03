const fs = require('fs');
const path = require('path');

// Mapa de reemplazos
const replacements = [
  // Fondos
  { from: /className="([^"]*)\bbg-white\b([^"]*)"/g, to: 'className="$1bg-bg-primary$2"' },
  { from: /className="([^"]*)\bbg-gray-50\b([^"]*)"/g, to: 'className="$1bg-bg-secondary$2"' },
  { from: /className="([^"]*)\bbg-gray-100\b([^"]*)"/g, to: 'className="$1bg-bg-secondary$2"' },
  { from: /className="([^"]*)\bbg-gray-200\b([^"]*)"/g, to: 'className="$1bg-bg-tertiary$2"' },
  { from: /className="([^"]*)\bbg-slate-50\b([^"]*)"/g, to: 'className="$1bg-bg-secondary$2"' },
  { from: /className="([^"]*)\bbg-slate-100\b([^"]*)"/g, to: 'className="$1bg-bg-secondary$2"' },
  { from: /className="([^"]*)\bbg-slate-200\b([^"]*)"/g, to: 'className="$1bg-bg-tertiary$2"' },
  { from: /className="([^"]*)\bbg-slate-600\b([^"]*)"/g, to: 'className="$1bg-bg-primary$2"' },
  { from: /className="([^"]*)\bbg-slate-700\b([^"]*)"/g, to: 'className="$1bg-bg-secondary$2"' },

  // Gradientes de fondo (convertir a color sólido adaptativo)
  { from: /className="([^"]*)bg-gradient-to-br from-slate-50 to-slate-100([^"]*)"/g, to: 'className="$1bg-bg-secondary$2"' },
  { from: /className="([^"]*)bg-gradient-to-br from-blue-50 to-indigo-50([^"]*)"/g, to: 'className="$1bg-bg-secondary$2"' },
  { from: /className="([^"]*)bg-gradient-to-r from-slate-700 to-slate-600([^"]*)"/g, to: 'className="$1bg-bg-primary$2"' },

  // Textos
  { from: /className="([^"]*)\btext-gray-800\b([^"]*)"/g, to: 'className="$1text-text-primary$2"' },
  { from: /className="([^"]*)\btext-gray-900\b([^"]*)"/g, to: 'className="$1text-text-primary$2"' },
  { from: /className="([^"]*)\btext-black\b([^"]*)"/g, to: 'className="$1text-text-primary$2"' },
  { from: /className="([^"]*)\btext-gray-700\b([^"]*)"/g, to: 'className="$1text-text-secondary$2"' },
  { from: /className="([^"]*)\btext-gray-600\b([^"]*)"/g, to: 'className="$1text-text-secondary$2"' },
  { from: /className="([^"]*)\btext-gray-500\b([^"]*)"/g, to: 'className="$1text-text-tertiary$2"' },
  { from: /className="([^"]*)\btext-gray-400\b([^"]*)"/g, to: 'className="$1text-text-disabled$2"' },
  { from: /className="([^"]*)\btext-slate-800\b([^"]*)"/g, to: 'className="$1text-text-primary$2"' },
  { from: /className="([^"]*)\btext-slate-700\b([^"]*)"/g, to: 'className="$1text-text-secondary$2"' },
  { from: /className="([^"]*)\btext-slate-600\b([^"]*)"/g, to: 'className="$1text-text-secondary$2"' },
  { from: /className="([^"]*)\btext-slate-500\b([^"]*)"/g, to: 'className="$1text-text-tertiary$2"' },
  { from: /className="([^"]*)\btext-slate-200\b([^"]*)"/g, to: 'className="$1text-text-secondary$2"' },

  // Hover states
  { from: /return "([^"]*)hover:bg-gray-50([^"]*)"/g, to: 'return "$1hover:bg-bg-secondary$2"' },
  { from: /className="([^"]*)hover:bg-slate-700([^"]*)"/g, to: 'className="$1hover:bg-bg-tertiary$2"' },

  // Bordes
  { from: /className="([^"]*)\bborder-gray-300\b([^"]*)"/g, to: 'className="$1border-border-subtle$2"' },
  { from: /className="([^"]*)\bborder-gray-200\b([^"]*)"/g, to: 'className="$1border-border-subtle$2"' },
  { from: /className="([^"]*)\bborder-gray-400\b([^"]*)"/g, to: 'className="$1border-border-medium$2"' },
  { from: /className="([^"]*)\bborder-slate-300\b([^"]*)"/g, to: 'className="$1border-border-subtle$2"' },
  { from: /className="([^"]*)\bborder-slate-200\b([^"]*)"/g, to: 'className="$1border-border-subtle$2"' },

  // Fondos especiales
  { from: /className="([^"]*)\bbg-gray-900\b([^"]*)"/g, to: 'className="$1bg-bg-primary$2"' },

  // Fondos de colores claros -50 (convertir a bg-secondary)
  { from: /className="([^"]*)\bbg-blue-50\b([^"]*)"/g, to: 'className="$1bg-bg-secondary$2"' },
  { from: /className="([^"]*)\bbg-purple-50\b([^"]*)"/g, to: 'className="$1bg-bg-secondary$2"' },
  { from: /className="([^"]*)\bbg-amber-50\b([^"]*)"/g, to: 'className="$1bg-bg-secondary$2"' },

  // Valores en propiedades de objetos
  { from: /bgColor: "bg-blue-50"/g, to: 'bgColor: "bg-bg-secondary"' },
  { from: /bgColor: "bg-green-50"/g, to: 'bgColor: "bg-bg-secondary"' },
  { from: /bgColor: "bg-purple-50"/g, to: 'bgColor: "bg-bg-secondary"' },
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  replacements.forEach(({ from, to }) => {
    const newContent = content.replace(from, to);
    if (newContent !== content) {
      content = newContent;
      modified = true;
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Actualizado: ${filePath}`);
    return true;
  }

  return false;
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  let totalModified = 0;

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        totalModified += walkDir(filePath);
      }
    } else if (file.endsWith('.jsx') || file.endsWith('.tsx')) {
      if (processFile(filePath)) {
        totalModified++;
      }
    }
  });

  return totalModified;
}

const srcPath = path.join(__dirname, 'src');
console.log('🎨 Iniciando migración de colores a variables del tema...\n');
const modified = walkDir(srcPath);
console.log(`\n✨ Migración completada: ${modified} archivos modificados`);
