import fs from 'fs';
const content = fs.readFileSync('src/App.jsx', 'utf8');

const components = content.split(/function\s+(\w+)/);
for (let i = 1; i < components.length; i += 2) {
  const name = components[i];
  const body = components[i + 1];
  
  // Naive check for state updates outside handlers/effects
  const lines = body.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('set') && line.includes('(') && !line.includes('=>') && !line.includes('useEffect')) {
       // Check if its inside a callback like onClick
       if (!line.includes('onClick') && !line.includes('onChange')) {
         console.log(`Potential Loop at ${name} line ${idx}: ${line.trim()}`);
       }
    }
  });
}
