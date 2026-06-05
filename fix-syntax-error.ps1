$content = Get-Content -Raw -Path 'C:\Users\ASUS\.gemini\antigravity-ide\scratch\trending\app.js'

$content = $content -replace "emoji_block:'dYZ`"o`"dY'dYOY'", "emoji_block:''"

Set-Content -Path 'C:\Users\ASUS\.gemini\antigravity-ide\scratch\trending\app.js' -Value $content -Encoding UTF8
