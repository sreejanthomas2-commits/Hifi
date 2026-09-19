// ── SHOP ─────────────────────────────────────────────────────────
/* Strict mode, ahead of this file becoming an ES module - modules are
   always strict, and doing it here first means any breakage shows up
   on its own rather than mixed into the module conversion. */
'use strict';

function renderShop(cat = 'All') {
  const el = $id('product-grid'); if (!el) return;
  const items = cat === 'All' ? DATA.products : DATA.products.filter(p => p.cat === cat);
  el.innerHTML = (items.length ? items : DATA.products).map(p => {
    const iconData = get3DIconForEmoji(p.emoji);
    return `
    <div class="product-card">
      <div class="product-thumb" style="background:${p.bg||'var(--card2)'}; display:flex; align-items:center; justify-content:center">
        <span class="material-symbols-rounded emoji-3d" style="font-size:40px; color:${iconData.color}">${iconData.icon}</span>
        ${p.badge ? `<div class="product-badge-tag">${p.badge}</div>` : ''}
        <div class="product-wishlist" onclick="showToast('Added to wishlist ❤️')" style="display:inline-flex; align-items:center; justify-content:center">
          <span class="material-symbols-rounded" style="font-size:18px; color:var(--pink)">favorite</span>
        </div>
      </div>
      <div class="product-info">
        <div class="product-name">${p.name}</div>
        <div class="product-seller">${p.seller}</div>
        <div class="product-stars">${p.rating}</div>
        <div class="product-price-row">
          <div>
            <div class="product-price">$${p.price.toFixed(2)}</div>
            ${p.oldPrice ? `<div class="product-price-old">$${p.oldPrice.toFixed(2)}</div>` : ''}
          </div>
          <button class="product-add" onclick="addToCart('${p.name.substring(0,20)}','${p.price}')" style="display:inline-flex; align-items:center; justify-content:center">
            <span class="material-symbols-rounded" style="font-size:20px; color:#fff">add</span>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');

  const cats = $id('shop-cats');
  if (cats) {
    cats.innerHTML = DATA.shopCategories.map(c => `
      <span class="chip${c===cat?' active':''}" onclick="renderShop('${c}')">${c}</span>`).join('');
  }
  updateCart();
}

function addToCart(name, price) {
  S.cart.push({ name, price: parseFloat(price) });
  updateCart();
  showToast(`${name.substring(0,20)}... added to cart 🛒`);
}
function updateCart() {
  const count = $id('cart-count');
  if (count) count.textContent = S.cart.length;
  const items = $id('cart-items');
  if (items) {
    items.innerHTML = S.cart.length ? S.cart.slice(-4).map(i => `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${i.name}</div>
          <div class="cart-item-price">$${i.price.toFixed(2)}</div>
        </div>
      </div>`).join('') : '<div style="color:var(--t3);font-size:12px;padding:12px 0">Your cart is empty</div>';
  }
  const total = $id('cart-total');
  if (total) total.textContent = '$' + S.cart.reduce((a,i) => a+i.price, 0).toFixed(2);
}



function renderFashionVerse(brandFilter) {
  const brand = brandFilter || 'All';
  const grid = $id('fv-product-grid');
  if (grid) {
    const items = brand === 'All' ? DATA.fvProducts : DATA.fvProducts.filter(p => p.brand === brand);
    grid.innerHTML = (items.length ? items : DATA.fvProducts).map(p => {
      const iconData = get3DIconForEmoji(p.emoji);
      return `
      <div class="product-card">
        <div class="product-thumb" style="background:${p.bg||'var(--card2)'}; display:flex; align-items:center; justify-content:center">
          <span class="material-symbols-rounded emoji-3d" style="font-size:40px; color:${iconData.color}">${iconData.icon}</span>
          ${p.badge ? `<div class="product-badge-tag">${p.badge}</div>` : ''}
          <div class="product-wishlist" onclick="showToast('Added to wishlist ❤️')" style="display:inline-flex; align-items:center; justify-content:center">
            <span class="material-symbols-rounded" style="font-size:18px; color:var(--pink)">favorite</span>
          </div>
        </div>
        <div class="product-info">
          <div class="product-name">${p.name}</div>
          <div class="product-seller">${p.brand}</div>
          <div class="product-stars">${p.rating}</div>
          <div class="product-price-row">
            <div>
              <div class="product-price">${p.price > 0 ? '$' + p.price.toFixed(2) : 'Free Drop'}</div>
            </div>
            ${p.arEnabled ? `<button class="btn-small" onclick="showToast('AR Try-On launching... 👓')" style="font-size:11px; padding:4px 10px; margin-right:4px; display:inline-flex; align-items:center; gap:4px;"><span class="material-symbols-rounded" style="font-size:14px">view_in_ar</span>AR</button>` : ''}
            <button class="product-add" onclick="addToCart('${p.name.substring(0,20)}','${p.price}')" style="display:inline-flex; align-items:center; justify-content:center">
              <span class="material-symbols-rounded" style="font-size:20px; color:#fff">add</span>
            </button>
          </div>
        </div>
      </div>`;
    }).join('');
  }

  const brandsContainer = $id('fv-brands-container');
  if (brandsContainer) {
    brandsContainer.innerHTML = DATA.fvBrands.map(b => `
      <span class="chip${b===brand?' active':''}" onclick="renderFashionVerse('${b}')">${b}</span>`).join('');
  }
}

function getFashionverseTemplate() {
  return `<section id="pane-fashionverse" class="pane">
        <div class="shop-hero" style="background: linear-gradient(135deg, rgba(255,42,133,0.2) 0%, rgba(138,43,226,0.2) 100%); border-radius: var(--r3); padding: 32px 20px; text-align: center; margin-bottom: 24px; border: 1px solid rgba(255,255,255,0.1); position: relative; overflow: hidden;">
          <h1 class="shop-hero-title" style="display:flex; align-items:center; justify-content:center; gap:8px; margin-bottom: 8px;">
            <span class="material-symbols-rounded emoji-3d" style="font-size:42px; color:var(--pink)">view_in_ar</span>
            <span>FashionVerse</span>
          </h1>
          <p class="shop-hero-sub" style="opacity:0.8; margin-bottom:16px;">Try on trending virtual fashion, earn XP, and unlock future drops.</p>
          <div class="shop-hero-search" style="margin: 0 auto; max-width: 400px; display: flex; align-items: center; background: rgba(0,0,0,0.4); border-radius: 30px; padding: 4px 16px;">
            <span class="material-symbols-rounded" style="opacity:0.6; font-size:18px">search</span>
            <input type="text" id="fv-search" placeholder="Search brands, sneakers, outfits..." style="background:transparent; border:none; color:#fff; padding:10px; width:100%; outline:none;">
          </div>
        </div>

        <div class="section-hdr mb12">
          <span class="section-title" style="display:flex; align-items:center; gap:6px"><span class="material-symbols-rounded" style="color:var(--blue)">local_fire_department</span> Trending Brands</span>
        </div>
        <div class="chips-row mb24" id="fv-brands-container"></div>

        <div class="shop-layout-inner" style="display:block;">
          <!-- Products -->
          <div class="product-grid" id="fv-product-grid"></div>
        </div>
      </section>`;
}

/* ── Global bridge ───────────────────────────────────────────────────
   This file is an ES module now, so its top-level names are private
   to it. Inline onclick= handlers and every other module still look
   them up on the global object, so they are republished here.

   Each one is a thunk because the list is produced by scanning, and
   scanning over-collects — a line inside a template literal can look
   like a declaration. publish() calls each thunk and skips the ones
   that do not resolve, so a phantom costs one caught error and not a
   dead module graph. */
import { publish } from '../globals.js?v=2';
publish('pages/fashionverse.js', {
  renderShop: () => renderShop, addToCart: () => addToCart,
  updateCart: () => updateCart,
  renderFashionVerse: () => renderFashionVerse,
  getFashionverseTemplate: () => getFashionverseTemplate
});
