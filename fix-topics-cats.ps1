$content = Get-Content -Raw -Path 'C:\Users\ASUS\.gemini\antigravity-ide\scratch\trending\app.js'

$content = $content -replace "name:'Artificial Intelligence', count:'2.4M posts', cat:'tech'", "name:'Artificial Intelligence', count:'2.4M posts', cat:'ai'"
$content = $content -replace "name:'Fitness & Wellness',      count:'1.8M posts', cat:'science'", "name:'Fitness & Wellness',      count:'1.8M posts', cat:'fitness'"
$content = $content -replace "name:'Design & Art',            count:'1.5M posts', cat:'tech'", "name:'Design & Art',            count:'1.5M posts', cat:'design'"
$content = $content -replace "name:'Tech & Coding',           count:'1.3M posts', cat:'tech'", "name:'Tech & Coding',           count:'1.3M posts', cat:'tech'"
$content = $content -replace "name:'Gaming',                  count:'1.1M posts', cat:'gaming'", "name:'Gaming',                  count:'1.1M posts', cat:'gaming'"
$content = $content -replace "name:'Travel & Culture',        count:'980K posts', cat:'local'", "name:'Travel & Culture',        count:'980K posts', cat:'travel'"
$content = $content -replace "name:'Music & Audio',           count:'870K posts', cat:'music'", "name:'Music & Audio',           count:'870K posts', cat:'music'"
$content = $content -replace "name:'Finance & Business',      count:'760K posts', cat:'crypto'", "name:'Finance & Business',      count:'760K posts', cat:'finance'"
$content = $content -replace "name:'Food & Lifestyle',        count:'690K posts', cat:'local'", "name:'Food & Lifestyle',        count:'690K posts', cat:'food'"
$content = $content -replace "name:'Startups',               count:'540K posts', cat:'crypto'", "name:'Startups',               count:'540K posts', cat:'startup'"

Set-Content -Path 'C:\Users\ASUS\.gemini\antigravity-ide\scratch\trending\app.js' -Value $content -Encoding UTF8
