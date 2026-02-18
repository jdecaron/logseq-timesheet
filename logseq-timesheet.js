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

function countAllPropertyValues(content, clientSlug) {
  const lines = content.split('\n');
  const timePropertyRegex = new RegExp(`${clientSlug}-time::\\s*([\\d.]+)`);
  let total = 0;

  for (const line of lines) {
    const match = line.match(timePropertyRegex);
    if (match) {
      total += parseFloat(match[1]);
    }
  }
  return total;
}

function exportTimesheet(clientName) {
  const clientSlug = getClientSlug(clientName);
  const journalFiles = findTimeJournals();
  let allEntries = [];
  let doubleCheckTotal = 0;

  for (const file of journalFiles) {
    const filePath = path.join(LOGSEQ_PAGES_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    allEntries = allEntries.concat(parseTimeJournal(content, clientSlug));
    doubleCheckTotal += countAllPropertyValues(content, clientSlug);
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

  const entriesTotal = allEntries.reduce((sum, e) => sum + e.hours, 0);

  return {
    csv: lines.join('\n'),
    doubleCheckTotal,
    entriesTotal
  };
}

const clientName = process.argv[2] || 'Bain Ultra';
const month = process.argv[3] || new Date().toISOString().slice(0, 7); // YYYY-MM

const result = exportTimesheet(clientName);
const outputFile = `${month}-invoice-jean-denis-caron-total-${result.doubleCheckTotal}.csv`;

fs.writeFileSync(outputFile, result.csv);
console.log(`Written to ${outputFile}`);
console.log(`Entries total: ${result.entriesTotal}`);
console.log(`Double-check total: ${result.doubleCheckTotal}`);
if (result.entriesTotal !== result.doubleCheckTotal) {
  console.log(`WARNING: Totals do not match!`);
}
