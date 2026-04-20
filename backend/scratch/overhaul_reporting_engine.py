import os

path = 'backend/server.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update the Prompt
NEW_PROMPT = """You are the Lead Data Analyst for an Enterprise Intelligence Suite.
Your task is to synthesize a high-fidelity Executive Analysis Report based on the provided document context and chat history.

STRUCTURE:
1. Executive Analysis: High-level purpose and scope of this investigation.
2. Data Description: Provide a detailed profile of the data (what it is about, record counts, active columns, and the specific business context).
3. Key Findings: Present mission-critical insights derived from the data. 
   - Embed Mermaid.js visualizations (pie charts, bar charts, or xy charts) ONLY for the most important findings. 
   - Do NOT generate plots for every variable; focus only on the core results.
4. Strategic Insights: Potential risks or opportunities identifies in the documents.
5. Final Verdict: Professional recommendation.

CRITICAL RULES:
- Use "Analysis" terminology throughout. NEVER use "Audit".
- NEVER mention "NexGen" or "DocJockey" in the body text or headers. Keep the text brand-neutral.
- Use bold headers and professional enterprise-grade tone.
- Use Markdown for the content to ensure compatibility with our processor."""

if 'const EXECUTIVE_REPORT_PROMPT = `' in content:
    start_idx = content.find('const EXECUTIVE_REPORT_PROMPT = `') + len('const EXECUTIVE_REPORT_PROMPT = `')
    end_idx = content.find('`;', start_idx)
    content = content[:start_idx] + NEW_PROMPT + content[end_idx:]

# 2. Update the HTML Template
NEW_HTML_TEMPLATE = """(contentHtml) => `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Executive Analysis Report</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <script>
        document.addEventListener('DOMContentLoaded', () => {
            mermaid.initialize({ 
                startOnLoad: true, 
                theme: 'dark',
                themeVariables: {
                    primaryColor: '#e63639',
                    primaryTextColor: '#fff',
                    primaryBorderColor: '#e63639',
                    lineColor: '#e63639',
                    secondaryColor: '#1da5a2',
                    tertiaryColor: '#1c1517'
                }
            });
        });
    </script>
    <style>
        :root {
            --primary: #e63639;
            --secondary: #1da5a2;
            --bg: #0b0c10;
            --text: #e2e8eb;
            --surface: #1c1517;
        }
        body { 
            font-family: 'Outfit', sans-serif; 
            line-height: 1.6; 
            color: var(--text); 
            background: var(--bg); 
            margin: 0;
            padding: 40px;
            position: relative;
        }
        .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 15vw;
            color: rgba(255, 255, 255, 0.03);
            font-weight: 900;
            pointer-events: none;
            user-select: none;
            white-space: nowrap;
            z-index: 1000;
            letter-spacing: 0.5em;
        }
        .container { 
            max-width: 900px; 
            margin: 0 auto; 
            background: var(--surface);
            padding: 60px;
            border-radius: 24px;
            box-shadow: 0 40px 100px rgba(0,0,0,0.5);
            border: 1px solid rgba(255,255,255,0.05);
            position: relative;
            z-index: 1;
        }
        .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 60px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            padding-bottom: 30px;
        }
        .analysis-badge {
            background: var(--primary);
            color: white;
            padding: 8px 16px;
            font-weight: 900;
            border-radius: 8px;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        .report-label {
            font-size: 10px;
            font-weight: 900;
            color: rgba(255,255,255,0.3);
            text-transform: uppercase;
            letter-spacing: 4px;
        }
        h1, h2, h3 { color: white; font-weight: 900; text-transform: uppercase; letter-spacing: -0.02em; }
        h1 { font-size: 36px; margin: 0; }
        h2 { font-size: 20px; color: var(--primary); margin-top: 40px; border-left: 4px solid var(--primary); padding-left: 15px; }
        p, li { font-size: 16px; color: rgba(255,255,255,0.7); }
        .footer {
            margin-top: 80px;
            text-align: center;
            border-top: 1px solid rgba(255,255,255,0.1);
            padding-top: 40px;
            font-size: 10px;
            font-weight: 900;
            color: rgba(255,255,255,0.3);
            text-transform: uppercase;
            letter-spacing: 2px;
        }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; background: rgba(0,0,0,0.2); border-radius: 12px; overflow: hidden; }
        th { background: rgba(255,255,255,0.05); color: var(--primary); text-align: left; padding: 12px; font-size: 12px; text-transform: uppercase; font-weight: 900; }
        td { padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.03); font-size: 14px; }
        .mermaid { background: rgba(0,0,0,0.3); padding: 20px; border-radius: 16px; margin: 20px 0; border: 1px solid rgba(255,255,255,0.05); }
    </style>
</head>
<body>
    <div class="watermark">DOCJOCKEY</div>
    <div class="container">
        <div class="header">
            <div>
                <div class="report-label">Strategic Intelligence Result</div>
                <h1>Executive Analysis Report</h1>
            </div>
            <div class="analysis-badge">Confidential Analysis</div>
        </div>
        
        <div class="content">
            ${contentHtml}
        </div>

        <div class="footer">
            Generated by DocJockey AI • Enterprise-Grade Intelligence • Confidential
        </div>
    </div>
</body>
</html>
`"""

if 'const GET_BRANDED_HTML = (contentHtml) => `' in content:
    start_search = 'const GET_BRANDED_HTML = (contentHtml) => `'
    start_idx = content.find(start_search) + len('const GET_BRANDED_HTML = ')
    # Find the end of the template literal (the next `""" is not right, it's `; in JS)
    # Actually the current file uses `...` for the template.
    end_idx = content.find('`;', start_idx) + 1 # +1 to include the backtick
    content = content[:start_idx] + NEW_HTML_TEMPLATE + content[end_idx:]

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(content)

print("Executive Reporting Engine overhauled successfully.")
