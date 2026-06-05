$router = Get-Content -Raw -Path 'C:\Users\ASUS\.gemini\antigravity\scratch\trending\js\router.js' -Encoding UTF8

$oldLogic = @"
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
  const target = `$id(`"pane-`${pane}`");
  if (target) target.classList.add('active');
"@

$newLogic = @"
  // SPA Component Mounting
  const mainContent = `$id('main-content');
  if (mainContent) {
    try {
      const funcName = 'get' + pane.charAt(0).toUpperCase() + pane.slice(1) + 'Template';
      if (typeof window[funcName] === 'function') {
        mainContent.innerHTML = window[funcName]();
      } else {
        console.warn('Template missing for:', pane);
      }
    } catch(e) {
      console.error(e);
    }
  }
"@

$router = $router.Replace($oldLogic, $newLogic)
Set-Content -Path 'C:\Users\ASUS\.gemini\antigravity\scratch\trending\js\router.js' -Value $router -Encoding UTF8
