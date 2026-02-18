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
    const dateMatch = line.match(/^-\s*\[\[([A-Za-z]{3,9}\s+\d+[a-z]*,\s*\d{4})\]\]/);
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

function isInMonth(dateStr, targetMonth) {
  // dateStr format: "Jan 31st; 2026" or "January 15; 2026"
  // targetMonth format: "2026-01"
  const [targetYear, targetMon] = targetMonth.split('-').map(Number);
  const months = {
    'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
  };
  
  // Remove ordinal suffixes (st, nd, rd, th) and parse
  const cleaned = dateStr.replace(/(\d+)(st|nd|rd|th)/i, '$1').replace(';', ',');
  const match = cleaned.match(/^([A-Za-z]+)\s+\d+,\s*(\d{4})$/);
  if (!match) return false;
  
  const monthStr = match[1].toLowerCase().slice(0, 3);
  const year = parseInt(match[2], 10);
  const month = months[monthStr];
  
  return year === targetYear && month === targetMon;
}

function exportTimesheet(clientName, targetMonth) {
  const clientSlug = getClientSlug(clientName);
  const journalFiles = findTimeJournals();
  let allEntries = [];
  let doubleCheckTotal = 0;

  for (const file of journalFiles) {
    const filePath = path.join(LOGSEQ_PAGES_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const entries = parseTimeJournal(content, clientSlug);
    const filteredEntries = entries.filter(e => isInMonth(e.date, targetMonth));
    allEntries = allEntries.concat(filteredEntries);
    doubleCheckTotal += filteredEntries.reduce((sum, e) => sum + e.hours, 0);
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

function showHelp() {
  console.log(`Usage: logseq-timesheet [YYYY-MM] [client-name]

Export timesheet entries from Logseq time journals to CSV.

Arguments:
  YYYY-MM       Month to export (default: current month)
  client-name   Client name for filtering entries (default: "Bain Ultra")

Examples:
  logseq-timesheet                    # Current month, default client
  logseq-timesheet 2026-02            # February 2026, default client
  logseq-timesheet 2026-02 "Acme Co"  # February 2026, Acme Co client
`);
  process.exit(0);
}

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  showHelp();
}

const month = args[0] || new Date().toISOString().slice(0, 7); // YYYY-MM
const clientName = args[1] || 'Bain Ultra';

const result = exportTimesheet(clientName, month);
const outputFile = `${month}-invoice-jean-denis-caron-total-${result.doubleCheckTotal}.csv`;

fs.writeFileSync(outputFile, result.csv);
console.log(`Written to ${outputFile}`);
console.log(`Entries total: ${result.entriesTotal}`);
console.log(`Double-check total: ${result.doubleCheckTotal}`);
if (result.entriesTotal !== result.doubleCheckTotal) {
  console.log(`WARNING: Totals do not match!`);
}
