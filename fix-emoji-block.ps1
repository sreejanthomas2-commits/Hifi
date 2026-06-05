$content = Get-Content -Raw -Path 'C:\Users\ASUS\.gemini\antigravity-ide\scratch\trending\app.js'
$content = [System.Text.RegularExpressions.Regex]::Replace($content, "emoji_block:'.*?',", "emoji_block:'',")
Set-Content -Path 'C:\Users\ASUS\.gemini\antigravity-ide\scratch\trending\app.js' -Value $content -Encoding UTF8
