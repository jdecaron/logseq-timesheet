#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const LOGSEQ_PAGES_DIR = path.join(os.homedir(), 'Documents/Logseq/Documents/pages');

function getClientSlug(clientName) {
  return clientName.toLowerCase().replace(/\s+/g, '-');
}

function parseTimeJournal(content, clientSlug) {
  const entries = [];
  const lines = content.split('\n');
  let currentDate = null;
  let currentDescription = null;
  const timePropertyRegex = new RegExp(`${clientSlug}-time::\\s*([\\d.]+)`);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dateMatch = line.match(/^-\s*\[\[([A-Za-z]+\s+\d+[a-z]*,\s*\d{4})\]\]/);
    if (dateMatch) {
      currentDate = dateMatch[1];
      currentDescription = null;
      continue;
    }
    const descMatch = line.match(/^\t-\s*(.+)$/);
    if (descMatch && currentDate && !currentDescription) {
      currentDescription = descMatch[1].replace(/\[\[([^\]]+)\]\]/g, '$1');
      continue;
    }
    const timeMatch = line.match(timePropertyRegex);
    if (timeMatch && currentDate) {
      const hours = parseFloat(timeMatch[1]);
      const formattedDate = currentDate.replace(',', ';');
      entries.push({ date: formattedDate, description: currentDescription || '', hours });
    }
  }
  return entries;
}

function findTimeJournals() {
  const files = fs.readdirSync(LOGSEQ_PAGES_DIR);
  return files.filter(f => f.startsWith('⏰') && f.endsWith('.md'));
}

function exportTimesheet(clientName) {
  const clientSlug = getClientSlug(clientName);
  const journalFiles = findTimeJournals();
  let allEntries = [];

  for (const file of journalFiles) {
    const filePath = path.join(LOGSEQ_PAGES_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    allEntries = allEntries.concat(parseTimeJournal(content, clientSlug));
  }

  allEntries.sort((a, b) => {
    const dateA = new Date(a.date.replace(';', ','));
    const dateB = new Date(b.date.replace(';', ','));
    return dateA - dateB;
  });

  const lines = allEntries.map(entry => {
    const desc = entry.description.replace(/"/g, '""');
    return `${entry.date},"${desc}",${entry.hours}`;
  });

  return lines.join('\n');
}

const clientName = process.argv[2] || 'Bain Ultra';
const month = process.argv[3] || new Date().toISOString().slice(0, 7); // YYYY-MM
const outputFile = `${month}-invoice-jean-denis-caron.csv`;

const csv = exportTimesheet(clientName);
fs.writeFileSync(outputFile, csv);
console.log(`Written to ${outputFile}`);
