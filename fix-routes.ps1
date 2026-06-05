$content = Get-Content -Raw -Path 'C:\Users\ASUS\.gemini\antigravity-ide\scratch\trending\app.js'

$oldTopics = @"
  topics: [
    { emoji:'🤖', name:'Artificial Intelligence', count:'2.4M posts', cat:'tech' },
    { emoji:'💪', name:'Fitness & Wellness',      count:'1.8M posts', cat:'science' },
    { emoji:'🎨', name:'Design & Art',            count:'1.5M posts', cat:'tech' },
    { emoji:'💻', name:'Tech & Coding',           count:'1.3M posts', cat:'tech' },
    { emoji:'🎮', name:'Gaming',                  count:'1.1M posts', cat:'gaming' },
    { emoji:'🌍', name:'Travel & Culture',        count:'980K posts', cat:'local' },
    { emoji:'🎵', name:'Music & Audio',           count:'870K posts', cat:'music' },
    { emoji:'📈', name:'Finance & Business',      count:'760K posts', cat:'crypto' },
    { emoji:'🍕', name:'Food & Lifestyle',        count:'690K posts', cat:'local' },
    { emoji:'🚀', name:'Startups',               count:'540K posts', cat:'crypto' },
  ],
"@

$newTopics = @"
  topics: [
    { emoji:'🤖', name:'Artificial Intelligence', count:'2.4M posts', cat:'ai' },
    { emoji:'💪', name:'Fitness & Wellness',      count:'1.8M posts', cat:'fitness' },
    { emoji:'🎨', name:'Design & Art',            count:'1.5M posts', cat:'design' },
    { emoji:'💻', name:'Tech & Coding',           count:'1.3M posts', cat:'tech' },
    { emoji:'🎮', name:'Gaming',                  count:'1.1M posts', cat:'gaming' },
    { emoji:'🌍', name:'Travel & Culture',        count:'980K posts', cat:'travel' },
    { emoji:'🎵', name:'Music & Audio',           count:'870K posts', cat:'music' },
    { emoji:'📈', name:'Finance & Business',      count:'760K posts', cat:'finance' },
    { emoji:'🍕', name:'Food & Lifestyle',        count:'690K posts', cat:'food' },
    { emoji:'🚀', name:'Startups',               count:'540K posts', cat:'startup' },
  ],
"@

$content = $content.Replace($oldTopics, $newTopics)

Set-Content -Path 'C:\Users\ASUS\.gemini\antigravity-ide\scratch\trending\app.js' -Value $content
