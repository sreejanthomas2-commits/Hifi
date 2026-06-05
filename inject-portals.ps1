$appLines = Get-Content 'C:\Users\ASUS\.gemini\antigravity-ide\scratch\trending\app.js'
$portals = Get-Content -Raw 'C:\Users\ASUS\.gemini\antigravity-ide\scratch\trending\portals.js'

$before = $appLines[0..882]
$after = $appLines[1248..($appLines.Count - 1)]

$newContent = ($before -join "`r`n") + "`r`n" + $portals + "`r`n" + ($after -join "`r`n")
Set-Content -Path 'C:\Users\ASUS\.gemini\antigravity-ide\scratch\trending\app.js' -Value $newContent
