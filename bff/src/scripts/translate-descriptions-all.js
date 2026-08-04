const fs = require('fs');
const path = require('path');
const { translate } = require('@vitalets/google-translate-api');

const filePath = path.join(__dirname, '../data/exercises.json');

async function main() {
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
  const data = JSON.parse(content);

  const enWords = [' the ', ' and ', ' with ', ' your ', ' back ', ' to ', ' from '];
  
  // Find items that need translation (missing or likely English)
  const toTranslate = data.value.filter(x => {
    if (!x.description) return false;
    const desc = x.description.toLowerCase();
    // si tiene palabras clave en ingles muy comunes, probablemente esté en inglés
    return enWords.some(w => desc.includes(w)) && !desc.includes('siéntate') && !desc.includes('acuéstate');
  });

  console.log(`Found ${toTranslate.length} items that seem to have English descriptions.`);

  let count = 0;
  for (const item of toTranslate) {
    count++;
    try {
      const res = await translate(item.description, { to: 'es' });
      item.description = res.text;
      console.log(`[${count}/${toTranslate.length}] Translated ID ${item.id}`);
      
      // Save every 50 translations to avoid losing progress
      if (count % 50 === 0) {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
        console.log('--- Saved progress ---');
      }
      
      // Rate limiting prevention
      await new Promise(r => setTimeout(r, 200)); 
    } catch (err) {
      console.error(`Failed on ID ${item.id}:`, err.message);
      // Wait longer on error (might be rate limit)
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  console.log('All translations finished!');
}

main().catch(console.error);
