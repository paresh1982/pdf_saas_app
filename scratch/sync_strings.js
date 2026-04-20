const fs = require('fs'); 
const serverPath = 'backend/server.js';
let content = fs.readFileSync(serverPath, 'utf8');
const oldKw = 'const magicSummaryKeyword = "Briefly summarize what this data is about and provide a meta-description"';
const newKw = 'const magicSummaryKeyword = "[STRATEGIC_OVERVIEW_REQUEST]"';
if (content.includes(oldKw)) {
    content = content.replace(oldKw, newKw);
    fs.writeFileSync(serverPath, content, 'utf8');
    console.log('Server.js updated');
} else {
    console.log('Server.js target not found or already updated');
}

const reportPath = 'frontend/src/components/Reporting/ReportingEngine.jsx';
let reportContent = fs.readFileSync(reportPath, 'utf8');
const newPrompt = 'sendMessage("[STRATEGIC_OVERVIEW_REQUEST] Briefly summarize what this data is about and provide a meta-description.")';
if (reportContent.includes('Briefly summarize what this data is about')) {
    reportContent = reportContent.replace(/sendMessage\s*\(\s*".*?"\s*\)/, newPrompt);
    fs.writeFileSync(reportPath, reportContent, 'utf8');
    console.log('ReportingEngine.jsx updated');
} else {
    console.log('ReportingEngine.jsx target not found or already updated');
}
