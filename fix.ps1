$content = Get-Content -Path "C:\Users\ASUS\.gemini\antigravity-ide\scratch\trending\index.html" -Raw
$startStr = "<!-- ===================== PANE: DESIGN STUDIO ===================== -->"
$endStr = "</section>"
$insertStr = "</main><!-- /pane-container -->"

$start = $content.IndexOf($startStr)
$end = $content.IndexOf($endStr, $start) + $endStr.Length

$pane = $content.Substring($start, $end - $start)
$content = $content.Remove($start, $end - $start)

$insertIndex = $content.IndexOf($insertStr)
$content = $content.Insert($insertIndex, "`n" + $pane + "`n")

Set-Content -Path "C:\Users\ASUS\.gemini\antigravity-ide\scratch\trending\index.html" -Value $content
