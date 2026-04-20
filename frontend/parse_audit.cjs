const fs = require('fs');
const path = require('path');

const raw = fs.readFileSync('audit_report_raw.txt', 'utf16le'); 
let lines = raw.split(/\r?\n/);
if (lines.length < 10) {
  lines = fs.readFileSync('audit_report_raw.txt', 'utf8').split(/\r?\n/);
}

const report = {};

const lineRegex = /^(src[\\/].*?\.tsx?):(\d+):\s*(.*)$/i;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i].trim();
  if (!line) continue;
  
  const match = line.match(lineRegex);
  if (match) {
    const [_, filePath, lineNum, content] = match;
    const cleanPath = filePath.replace(/\\/g, '/');
    if (!report[cleanPath]) {
      report[cleanPath] = [];
    }
    
    let type = 'Referencia General';
    if (content.includes("from('programs')") || content.includes('programs!')) type = 'Query DB Directa';
    else if (content.includes('program_id:') || content.includes('programId:')) type = 'Propiedad de Objeto / Interface';
    else if (content.includes('program_id?:') || content.includes('programId?:')) type = 'Definición de Tipo TS';
    else if (content.includes('const programId') || content.includes('setProgram')) type = 'Variable de Estado / Local';
    else if (content.includes('programId={') || content.includes('program_id={')) type = 'Propiedad de Componente (Props)';
    else if (content.includes('p_program_id')) type = 'Parámetro / RPC (Supabase)';

    report[cleanPath].push({
      line: parseInt(lineNum, 10),
      content: content.trim(),
      type: type
    });
  }
}

let md = `# Auditoría de Referencias Legacy: programs y program_id\n\n`;
md += `Se buscaron las siguientes referencias en el frontend (src/):\n`;
md += `- program_id\n- programId\n- programName\n- program_name\n- \`from('programs')\`\n- .programs\n- p_program_id\n\n`;

let totalMatches = 0;

for (const [file, matches] of Object.entries(report)) {
  totalMatches += matches.length;
  md += `## [${path.basename(file)}](file:///c:/Users/Usuario/Documents/demo/sportmaps-demo/frontend/${file})\n`;
  md += `**Ruta completa:** \`${file}\`\n\n`;
  md += `| Línea | Contexto (Tipo) | Código |\n`;
  md += `| --- | --- | --- |\n`;
  matches.forEach(m => {
    let code = m.content;
    if (code.length > 80) code = code.substring(0, 77) + '...';
    code = code.replace(/\|/g, '\\|');
    md += `| ${m.line} | ${m.type} | \`${code}\` |\n`;
  });
  md += `\n`;
}

md += `---\n**Total de hallazgos (líneas con coincidencias):** ${totalMatches}\n`;

fs.writeFileSync('C:\\Users\\Usuario\\.gemini\\antigravity\\brain\\7e161d21-7fb0-4cfe-a0c3-f65707099b32\\audit_report.md', md, 'utf8');
console.log(`Report generated with ${totalMatches} occurrences.`);
