$explore = Get-Content -Raw -Path 'C:\Users\ASUS\.gemini\antigravity\scratch\trending\js\pages\explore.js' -Encoding UTF8

$oldLogic = @"
  const titleEl = `$id('cat-title'); if (titleEl) titleEl.innerHTML = titles[cat] || '<span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:var(--blue); vertical-align:middle; margin-right:6px">explore</span><span>Category</span> Portal';
  const descEl = `$id('cat-description'); if (descEl) descEl.textContent = descs[cat] || 'Explore advanced multimedia feeds.';
  
  navigateTo('category');
  renderCategoryPortal(cat);
"@

$newLogic = @"
  navigateTo('category');

  const titleEl = `$id('cat-title'); if (titleEl) titleEl.innerHTML = titles[cat] || '<span class="material-symbols-rounded emoji-3d" style="font-size:24px; color:var(--blue); vertical-align:middle; margin-right:6px">explore</span><span>Category</span> Portal';
  const descEl = `$id('cat-description'); if (descEl) descEl.textContent = descs[cat] || 'Explore advanced multimedia feeds.';
  
  renderCategoryPortal(cat);
"@

$explore = $explore.Replace($oldLogic, $newLogic)
Set-Content -Path 'C:\Users\ASUS\.gemini\antigravity\scratch\trending\js\pages\explore.js' -Value $explore -Encoding UTF8
