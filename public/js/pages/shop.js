// ── SHOP ─────────────────────────────────────────────────────────
/* This is the Shop grid and cart. It used to share a file with the
   virtual-try-on page that was removed; nothing here belongs to it.

   Note that none of it can run yet: renderShop and updateCart write
   into #product-grid, #shop-cats, #cart-count, #cart-items and
   #cart-total, and there is no Shop pane in index.html that declares
   them, so every lookup misses and returns early. Kept because it is
   the Shop, not the page that was deleted. */
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

/* ── Global bridge ───────────────────────────────────────────────────
   This file is an ES module, so its top-level names are private to it.
   Inline onclick= handlers and every other module still look them up
   on the global object, so they are republished here. */
import { publish } from '../globals.js?v=3';
publish('pages/shop.js', {
  renderShop: () => renderShop,
  addToCart: () => addToCart,
  updateCart: () => updateCart
});
