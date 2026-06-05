// ── NAVIGATION ───────────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-item[data-pane]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent default raw browser hash URL shifts
      navigateTo(el.dataset.pane);
      closeSidebar();
    });
  });
  document.querySelectorAll('.m-nav-btn[data-pane]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent default raw browser hash URL shifts
      navigateTo(el.dataset.pane);
    });
  });
  const ham = $id('hamburger');
  if (ham) ham.addEventListener('click', toggleSidebar);
  const ov = $id('sidebar-overlay');
  if (ov) ov.addEventListener('click', closeSidebar);
}

function navigateTo(pane) {
  // Clear the sidebar drawer overlays and drawer states
  closeSidebar();
  
  // Clear any modal or blur classes on document body
  document.body.classList.remove('modal-open');
  document.body.classList.remove('blurred-state');
  
  // Hide active modal popups to prevent obscuring views on transition
  const playStoreModal = $id('play-store-modal'); if (playStoreModal) { playStoreModal.style.display = 'none'; playStoreModal.classList.add('hidden'); }
  const courseDetailModal = $id('course-detail-modal'); if (courseDetailModal) { courseDetailModal.style.display = 'none'; courseDetailModal.classList.add('hidden'); }
  const gigWorkspaceModal = $id('gig-workspace-modal'); if (gigWorkspaceModal) { gigWorkspaceModal.style.display = 'none'; gigWorkspaceModal.classList.add('hidden'); }
  const eduReelsModal = $id('edu-reels-modal'); if (eduReelsModal) { eduReelsModal.style.display = 'none'; eduReelsModal.classList.add('hidden'); }
  const callModal = $id('call-modal'); if (callModal) { callModal.style.display = 'none'; callModal.classList.add('hidden'); }
  const categoryModal = $id('category-modal'); if (categoryModal) { categoryModal.style.display = 'none'; categoryModal.classList.add('hidden'); }
  
  // Stop continuous simulations if leaving their respective category
  if (S.pane === 'category') {
    stopCryptoLiveChart();
    stopWildlifeCanvasSim();
  }
  if (S.pane === 'fitness' && pane !== 'fitness') stopEKG();

  document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
  let target = $id(`pane-${pane}`);
  if (!target) {
    const funcName = `get${pane.charAt(0).toUpperCase()}${pane.slice(1)}Template`;
    if (typeof window[funcName] === 'function') {
      const htmlContent = window[funcName]();
      const mainContent = $id('main-content');
      if (mainContent) {
        mainContent.insertAdjacentHTML('beforeend', htmlContent);
        target = $id(`pane-${pane}`);
      }
    }
  }
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const navEl = document.querySelector(`.nav-item[data-pane="${pane}"]`);
  if (navEl) navEl.classList.add('active');

  document.querySelectorAll('.m-nav-btn').forEach(n => n.classList.remove('active'));
  const mEl = document.querySelector(`.m-nav-btn[data-pane="${pane}"]`);
  if (mEl) mEl.classList.add('active');

  S.pane = pane;

  // Re-start EKG when entering fitness
  if (pane === 'fitness') {
    _safe(renderFitness, 'renderFitness');
    _safe(startEKG, 'startEKG');
  }
  if (pane === 'learn') _safe(renderAgriHub, 'renderAgriHub');
  if (pane === 'feeds') {
    _safe(renderFeed, 'renderFeed');
    _safe(renderStories, 'renderStories');
    _safe(renderWhoToFollow, 'renderWhoToFollow');
    _safe(renderTrending, 'renderTrending');
  }
  if (pane === 'explore') _safe(renderExplore, 'renderExplore');
  if (pane === 'reels') _safe(renderReels, 'renderReels');
  if (pane === 'creator') _safe(renderCreator, 'renderCreator');
  if (pane === 'community') _safe(renderCommunity, 'renderCommunity');
  if (pane === 'profile') _safe(renderProfile, 'renderProfile');
  if (pane === 'messages') _safe(setupMessages, 'setupMessages');
  if (pane === 'designstudio') _safe(renderDesignStudio, 'renderDesignStudio');
  if (pane === 'fashionverse') _safe(renderFashionVerse, 'renderFashionVerse');
  if (pane === 'fashionhub') _safe(renderFashionHub, 'renderFashionHub');
  if (pane === 'settings') _safe(renderSettings, 'renderSettings');
}

function toggleSidebar() {
  const s = document.querySelector('.sidebar');
  const o = $id('sidebar-overlay');
  if (s) s.classList.toggle('open');
  if (o) o.classList.toggle('open');
}
function closeSidebar() {
  const s = document.querySelector('.sidebar');
  const o = $id('sidebar-overlay');
  if (s) s.classList.remove('open');
  if (o) o.classList.remove('open');
}


