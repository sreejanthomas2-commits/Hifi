$content = Get-Content -Raw -Path 'C:\Users\ASUS\.gemini\antigravity-ide\scratch\trending\app.js'
$content = $content.Replace('<div class="topic-card" onclick="clickCategory(''science'')">', '<div class="topic-card" onclick="clickCategory(''${t.cat || ''tech''}'')">')
Set-Content -Path 'C:\Users\ASUS\.gemini\antigravity-ide\scratch\trending\app.js' -Value $content
