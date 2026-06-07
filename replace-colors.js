const fs = require('fs');
const path = require('path');

const replacements = {
  // text colors
  'text-slate-900': 'text-foreground',
  'text-gray-900': 'text-foreground',
  'text-slate-800': 'text-foreground',
  'text-gray-800': 'text-foreground',
  'text-slate-700': 'text-foreground',
  'text-gray-700': 'text-foreground',
  'text-slate-600': 'text-muted',
  'text-gray-600': 'text-muted',
  'text-slate-500': 'text-muted',
  'text-gray-500': 'text-muted',
  'text-slate-400': 'text-muted',
  'text-gray-400': 'text-muted',
  
  // bg colors
  'bg-white': 'bg-background',
  'bg-slate-50': 'bg-background-elevated',
  'bg-gray-50': 'bg-background-elevated',
  'hover:bg-slate-50': 'hover:bg-background-elevated',
  'hover:bg-gray-50': 'hover:bg-background-elevated',
  'hover:bg-slate-100': 'hover:bg-background-elevated',

  // border colors
  'border-slate-200': 'border-border',
  'border-gray-200': 'border-border',
  'border-slate-100': 'border-border',
  'border-gray-100': 'border-border',

  // specific fixes for loading spinners
  'border-slate-200 border-t-slate-800': 'border-border border-t-foreground'
};

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;
      
      for (const [oldClass, newClass] of Object.entries(replacements)) {
        // use regex to match the exact class word, preventing partial matches
        const regex = new RegExp(`\\b${oldClass}\\b`, 'g');
        if (regex.test(content)) {
          content = content.replace(regex, newClass);
          modified = true;
        }
      }
      
      if (modified) {
        fs.writeFileSync(fullPath, content);
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

processDirectory(path.join(__dirname, 'src', 'app'));
