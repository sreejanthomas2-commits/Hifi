$content = Get-Content -Raw -Path 'C:\Users\ASUS\.gemini\antigravity-ide\scratch\trending\app.js'

# Remove the specific broken topics block
$content = $content -replace '(?s)  topics: \[\r?\n\s+\{ emoji:.*?Finance & Business.*?\r?\n\s+\{ emoji:.*?Food & Lifestyle.*?\r?\n\s+\{ emoji:.*?Startups.*?\r?\n  \],', ''

Set-Content -Path 'C:\Users\ASUS\.gemini\antigravity-ide\scratch\trending\app.js' -Value $content
