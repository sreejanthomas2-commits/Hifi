$content = Get-Content -Raw -Path 'C:\Users\ASUS\.gemini\antigravity-ide\scratch\trending\app.js'

$content = [System.Text.RegularExpressions.Regex]::Replace($content, "emoji:'[^']+'", "emoji:'\u2728'")
$content = [System.Text.RegularExpressions.Regex]::Replace($content, "icon:'[^']+'", "icon:'\uD83D\uDD25'")
$content = [System.Text.RegularExpressions.Regex]::Replace($content, "emoji: '[^']+'", "emoji: '\u2728'")
$content = [System.Text.RegularExpressions.Regex]::Replace($content, "icon: '[^']+'", "icon: '\uD83D\uDD25'")

Set-Content -Path 'C:\Users\ASUS\.gemini\antigravity-ide\scratch\trending\app.js' -Value $content -Encoding UTF8
