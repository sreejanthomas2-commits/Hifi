$content = Get-Content -Raw -Path 'C:\Users\ASUS\.gemini\antigravity-ide\scratch\trending\index.html'

$content = $content -replace '<span class="fs11 tc-2">\?\? Complete Core Syllabus', '<span class="fs11 tc-2">📚 Complete Core Syllabus'
$content = $content -replace '<div class="fs10 tc-green">\? Ready to narrate', '<div class="fs10 tc-green">✅ Ready to narrate'

Set-Content -Path 'C:\Users\ASUS\.gemini\antigravity-ide\scratch\trending\index.html' -Value $content -Encoding UTF8
