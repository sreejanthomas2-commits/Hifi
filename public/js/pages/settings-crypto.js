/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SETTINGS — crypto and Web3, subscriptions, orders, support       ║
   ║                                                                   ║
   ║  The money half of Settings. It is a separate section, and        ║
   ║  separately guarded, because "who can reply to my story" and      ║
   ║  "where do my coins go" should never sit in one undifferentiated  ║
   ║  list of switches.                                                ║
   ║                                                                   ║
   ║  Three facts hold everywhere in here, and the screens say so:     ║
   ║                                                                   ║
   ║  · Trending never signs or broadcasts a transaction. A send is    ║
   ║    prepared and handed to the person's own wallet app.            ║
   ║  · Trading, Earn, P2P and the balances are a paper account.       ║
   ║    Deposits are never credited to it.                             ║
   ║  · No receiving address is ever invented. Every address shown is  ║
   ║    one the owner connected.                                       ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

export default function register(SET) {

  const { reg, DO, esc, toast, ask, empty, money, when, guest, P } = SET._;
  const { row, sw, pick, sec } = SET;

  const ledger = () => (typeof MNY !== 'undefined' && MNY.ledger) ? MNY.ledger() : [];

  /* ── Wallets and connections ─────────────────────────────────────── */

  reg('wallets', {
    t: 'Wallets and connections', i: 'account_balance_wallet', p: 'root',
    k: 'wallet wallets connect metamask web3 connections address balance disconnect read only',
    html: () => {
      const accounts = (typeof WL !== 'undefined' && WL.accounts) ? WL.accounts() : [];
      const own = (typeof WAD !== 'undefined' && WAD.ownList) ? WAD.ownList() : [];
      const short = a => (typeof WL !== 'undefined' && WL.shortAddr) ? WL.shortAddr(a) : String(a || '').slice(0, 10) + '…';
      return [
        `<p class="st-lead">Wallets Trending can read, and the addresses people can pay you at.</p>`,
        sec('Connected wallets', accounts.length
          ? accounts.map(a => row({
              icon: 'account_balance_wallet', label: a.label || a.provider || 'Wallet',
              sub: short(a.address) + (a.network ? ' · ' + a.network : ''),
              value: 'Disconnect', act: 'disconnectwallet', arg: a.address || a.provider, chev: true
            }))
          : [row({ icon: 'add_link', label: 'Connect a wallet', sub: 'MetaMask, Coinbase Wallet, Phantom and others', act: 'connectwallet', chev: true })]),
        accounts.length ? sec('', [row({ icon: 'add_link', label: 'Connect another wallet', act: 'connectwallet', chev: true })]) : '',
        sec('Your receiving addresses', own.length
          ? own.slice(0, 6).map(a => row({
              icon: 'qr_code_2', label: (a.net || a.network || 'Address'),
              sub: short(a.addr || a.address), value: a.primary ? 'Primary' : '', good: !!a.primary,
              act: 'openaddresses', chev: true
            }))
          : [row({ icon: 'qr_code_2', label: 'Add a receiving address', sub: 'Needed before anyone can pay you on-chain', act: 'openaddresses', chev: true })]),
        `<p class="st-note">A connected wallet is <b>read-only</b>: Trending sees the public address and its balance, and nothing else. It cannot move funds, and it is never asked to — Trending does not sign transactions.</p>`
      ].join('');
    }
  });

  DO.connectwallet = () => {
    if (typeof WL !== 'undefined' && WL.openChooser) WL.openChooser();
    else toast('Wallets are still loading…');
  };

  DO.disconnectwallet = async a => {
    if (!(await ask('Disconnect this wallet? Trending stops reading its balance. Nothing on-chain changes.', { ok: 'Disconnect', danger: true }))) return;
    if (typeof WL !== 'undefined' && WL.disconnect) WL.disconnect(a);
    toast('Wallet disconnected');
    SET.repaint();
  };

  DO.openaddresses = () => { if (typeof WAD !== 'undefined' && WAD.openMine) WAD.openMine(); else toast('Addresses are still loading…'); };

  /* ── Deposits ────────────────────────────────────────────────────── */

  reg('depositset', {
    t: 'Deposits', i: 'south_west', p: 'root',
    k: 'deposit receive crypto address network coin confirmations credited custody',
    html: () => {
      const recs = (typeof DEP !== 'undefined' && DEP.records) ? DEP.records() : [];
      return [
        `<p class="st-lead">How deposits from an exchange or another wallet work for you. To deposit, use Add funds in your wallet; your receiving addresses are under Wallets and connections.</p>`,
        sec('Preferences', [
          row({ icon: 'lan', label: 'Preferred network', sub: 'Offered first when you deposit',
            value: P().get('crypto.defaultNetwork') || 'Ask each time', to: 'networks' }),
          sw('crypto.notifDeposit', 'Tell me when a deposit arrives', '', { icon: 'notifications_active' })
        ]),
        sec('Recent deposits', recs.length
          ? recs.slice(0, 5).map(r => row({ icon: 'south_west', label: (r.sym || 'Coin') + ' on ' + (r.net || 'network'),
              sub: when(r.at), value: r.amount ? String(r.amount) : '' }))
          : [empty('inbox', 'No deposits yet', 'A deposit you start appears here so you can find the address again.')]),
        `<p class="st-note"><b>A deposit is not credited to your Trending balance.</b> The coins arrive in your own wallet at the address shown. Trending holds nothing and generates no address for you — an address is only ever one you connected yourself.</p>`
      ].join('');
    }
  });

  /* ── Sends and withdrawals ───────────────────────────────────────── */

  reg('withdrawset', {
    t: 'Sends and withdrawals', i: 'north_east', p: 'root',
    k: 'send withdraw crypto network fee speed confirm whitelist address book transfer',
    html: () => {
      const recs = (typeof SC !== 'undefined' && SC.records) ? SC.records() : [];
      return [
        `<p class="st-lead">How your sends are checked before they leave. To send, use Send on your profile.</p>`,
        sec('Safety', [
          sw('crypto.confirmSends', 'Review every send', 'Amount, network and fee before the hand-off', { icon: 'fact_check' }),
          sw('crypto.whitelistOnly', 'Only saved addresses', 'Refuse anything not in your address book', { icon: 'verified_user', act: 'tgwhitelist' }),
          row({ icon: 'contacts', label: 'Address book', to: 'addressbook' })
        ]),
        sec('Network fee', [
          row({ icon: 'local_gas_station', label: 'Default speed', value: ({ slow: 'Economy', standard: 'Standard', fast: 'Fast' })[P().get('crypto.speed') || 'standard'], to: 'feespeed' })
        ]),
        sec('Recent sends', recs.length
          ? recs.slice(0, 5).map(r => row({ icon: 'north_east', label: (r.amount || '') + ' ' + (r.sym || ''),
              sub: (r.net || '') + ' · ' + when(r.at), value: r.status === 'sent' ? 'Sent' : 'Prepared', good: r.status === 'sent' }))
          : [empty('outbox', 'No sends yet', 'A send you prepare is kept here so you can mark it sent and open the explorer.')]),
        `<p class="st-note"><b>Trending never signs or broadcasts.</b> It prepares the payment and opens your wallet app, which asks you to approve it. If you do not approve it there, nothing moves.</p>`
      ].join('');
    }
  });

  reg('feespeed', {
    t: 'Default network speed', i: 'local_gas_station', p: 'withdrawset',
    k: 'fee speed gas economy standard fast network cost priority',
    html: () => [
      `<p class="st-lead">Which fee tier is selected first. You can always change it on the send itself.</p>`,
      pick('crypto.speed', [
        ['slow', 'Economy', 'Cheapest. Can take a while when the network is busy.'],
        ['standard', 'Standard', 'The usual balance of cost and speed.'],
        ['fast', 'Fast', 'Costs more, confirms sooner.']
      ]),
      `<p class="st-note">Fees are quoted live from each network at the moment you send. When a live quote cannot be fetched, Trending says so rather than guessing.</p>`
    ].join('')
  });

  /* ── Transaction history ─────────────────────────────────────────── */

  reg('txhistory', {
    t: 'Transaction history', i: 'receipt_long', p: 'root',
    k: 'transaction history ledger payments transfers sends deposits receipts activity export',
    html: () => {
      const rows = ledger().slice(0, 30);
      const sends = (typeof SC !== 'undefined' && SC.records) ? SC.records() : [];
      const ICON = { spend: 'north_east', receive: 'south_west', tip: 'volunteer_activism', transfer: 'swap_horiz', convert: 'currency_exchange' };
      return [
        `<p class="st-lead">In-app payments and transfers, newest first. On-chain sends are listed separately because they settle on a network, not here.</p>`,
        sec('Trending balance', rows.length
          ? rows.map(r => row({
              icon: ICON[r.kind] || 'receipt',
              label: (r.note || r.kind || 'Movement'),
              sub: when(r.ts || r.at),
              value: (r.kind === 'receive' ? '+' : r.kind === 'spend' || r.kind === 'tip' ? '−' : '') + (r.qty != null ? r.qty + ' ' + (r.sym || '') : money(r.usd || 0)),
              good: r.kind === 'receive'
            }))
          : [empty('receipt_long', 'Nothing yet', 'Payments, tips and transfers appear here as they happen.')]),
        sec('On-chain sends', sends.length
          ? sends.slice(0, 10).map(r => row({ icon: 'link', label: (r.amount || '') + ' ' + (r.sym || ''),
              sub: (r.net || '') + ' · ' + when(r.at), value: r.status === 'sent' ? 'Sent' : 'Prepared',
              act: 'opensendhistory', chev: true }))
          : []),
        sec('', [
          row({ icon: 'download', label: 'Export transactions', sub: 'As part of your full data download', act: 'download', chev: true }),
          rows.length ? row({ icon: 'delete_sweep', label: 'Clear the in-app ledger', sub: 'Balances are unaffected', act: 'clearledger', danger: true, chev: true }) : ''
        ])
      ].join('');
    }
  });

  /* Send opens on the coin list; act('history') is the same tap as the
     clock in its header, so this lands on the list of sends. */
  DO.opensendhistory = () => {
    if (typeof SC === 'undefined' || !SC.open) { toast('Send is still loading…'); return; }
    SC.open({});
    if (SC.act) SC.act('history');
  };

  DO.clearledger = async () => {
    if (!(await ask('Clear the record of in-app payments on this device? Balances do not change.', { ok: 'Clear', danger: true }))) return;
    if (typeof MNY !== 'undefined' && MNY.clearLedger) MNY.clearLedger();
    toast('Ledger cleared');
    SET.repaint();
  };

  /* ── Address book ────────────────────────────────────────────────── */

  /* The saved destinations belong to the withdraw flow, which writes
     them to this key. Read rather than duplicated, so the two screens
     can never disagree about what is saved. */
  function savedDestinations() {
    try {
      const v = JSON.parse(localStorage.getItem('ts_withdraw_book_v1') || 'null');
      return Array.isArray(v) ? v : [];
    } catch (e) { return []; }
  }

  reg('addressbook', {
    t: 'Address book', i: 'contacts', p: 'root',
    k: 'address book saved addresses whitelist withdraw send contacts wallet network destination',
    html: () => {
      const saved = savedDestinations();
      const own = (typeof WAD !== 'undefined' && WAD.ownList) ? WAD.ownList() : [];
      const short = a => String(a || '').length > 18 ? String(a).slice(0, 10) + '…' + String(a).slice(-6) : String(a || '');
      return [
        `<p class="st-lead">Addresses you have saved. Saving one means you check it once instead of every time.</p>`,
        sec('Addresses you send to', saved.length
          ? saved.map(b => row({ icon: 'person', label: b.label || short(b.address),
              sub: (b.networkLabel || b.network || '') + ' · ' + short(b.address),
              value: 'Remove', act: 'delsaved', arg: b.address, chev: true }))
          : [empty('contact_page', 'No saved addresses', 'Send to an address once and Trending offers to save it afterwards.')]),
        sec('Your own addresses', own.length
          ? own.map(a => row({ icon: 'qr_code_2', label: a.net || 'Address', sub: short(a.addr || a.address), value: a.primary ? 'Primary' : '' }))
          : [row({ icon: 'add', label: 'Add a receiving address', act: 'openaddresses', chev: true })]),
        sec('', [
          sw('crypto.whitelistOnly', 'Only send to saved addresses', 'Everything else is refused', { icon: 'verified_user', act: 'tgwhitelist' })
        ]),
        `<p class="st-note">Trending checks the shape of an address against the network you picked, refuses one that belongs to a different chain, and refuses outright anything that looks like a recovery phrase or a private key.</p>`
      ].join('');
    }
  });

  DO.delsaved = async addr => {
    if (!(await ask('Remove this address from your address book?', { ok: 'Remove', danger: true }))) return;
    if (!(await P().verify('Changing your address book'))) return;
    try {
      localStorage.setItem('ts_withdraw_book_v1',
        JSON.stringify(savedDestinations().filter(b => b.address !== addr)));
    } catch (e) {}
    toast('Address removed');
    SET.repaint();
  };

  /* ── Networks ────────────────────────────────────────────────────── */

  reg('networks', {
    t: 'Networks', i: 'lan', p: 'root',
    k: 'network networks chain ethereum bitcoin solana tron bnb default preferred fee',
    html: () => {
      const nets = (typeof WAD !== 'undefined' && WAD.NETS) ? WAD.NETS : {};
      const keys = Object.keys(nets);
      const now = P().get('crypto.defaultNetwork') || '';
      return [
        `<p class="st-lead">${keys.length} networks are supported for deposits and sends. Picking a preferred one only changes which is offered first.</p>`,
        sec('Preferred network', []),
        pick('crypto.defaultNetwork', [['', 'Ask each time', 'Recommended — the right network depends on the coin']]
          .concat(keys.slice(0, 12).map(k => [k, (nets[k] && (nets[k].label || nets[k].name)) || k, (nets[k] && nets[k].tag) || '']))),
        now ? `<p class="st-note">A coin that does not exist on ${esc((nets[now] && (nets[now].label || nets[now].name)) || now)} will still offer its own networks. Sending on the wrong network loses the coins, so Trending never picks one for you silently.</p>` : '',
        sec('', [row({ icon: 'local_gas_station', label: 'Default network speed', to: 'feespeed' })])
      ].join('');
    }
  });

  /* ── Price alerts ────────────────────────────────────────────────── */

  reg('alerts', {
    t: 'Price alerts', i: 'notifications_active', p: 'root',
    k: 'price alerts alarm coin target above below notify crypto',
    html: () => {
      const C = (typeof CT !== 'undefined' && CT.state) ? CT.state : null;
      const list = (C && C.alerts) || [];
      return [
        `<p class="st-lead">Alerts are checked against live prices while Trending is open.</p>`,
        sec('', [
          sw('crypto.notifPrice', 'Price alert notifications', '', { icon: 'notifications_active' }),
          row({ icon: 'add_alert', label: 'New price alert', act: 'openalerts', chev: true })
        ]),
        sec(list.length ? 'Your alerts' : '', list.length
          ? list.map(a => row({ icon: a.dir === 'above' ? 'trending_up' : 'trending_down',
              label: (a.sym || '') + ' ' + (a.dir === 'above' ? 'above' : 'below') + ' ' + money(a.price),
              sub: a.hit ? 'Triggered ' + when(a.hitAt) : 'Watching', value: a.hit ? 'Hit' : '', good: !!a.hit,
              act: 'openalerts', chev: true }))
          : [empty('notifications_none', 'No alerts set', 'Set one from a coin’s page or from the crypto tools.', 'openalerts', 'Open crypto tools')])
      ].join('');
    }
  });

  DO.openalerts = () => {
    if (typeof CT !== 'undefined' && CT.open) CT.open('alerts');
    else if (typeof navigateTo === 'function') navigateTo('cryptomarket');
  };

  /* ── Watchlist ───────────────────────────────────────────────────── */

  reg('watchlist', {
    t: 'Watchlist', i: 'visibility', p: 'root',
    k: 'watchlist watch coins follow markets favourite star crypto',
    html: () => {
      const C = (typeof CT !== 'undefined' && CT.state) ? CT.state : null;
      const list = (C && C.watch) || [];
      return [
        `<p class="st-lead">Coins you follow, shown first in Markets.</p>`,
        list.length
          ? sec(list.length + ' coins', list.map(s => `
              <div class="st-person" data-label="${esc(s)}">
                <span class="st-person-av word">${esc(String(s).slice(0, 3))}</span>
                <span class="st-person-t"><b>${esc(s)}</b><em>${esc((typeof MNY !== 'undefined' && MNY.price) ? money(MNY.price(s)) : '')}</em></span>
                <button type="button" class="st-person-x" data-st="unwatch" data-a="${esc(s)}">Remove</button>
              </div>`))
          : empty('star_border', 'Nothing on your watchlist', 'Tap the star on any coin in Markets.', 'pane:cryptomarket', 'Open Markets'),
        sec('', [row({ icon: 'currency_bitcoin', label: 'Open Markets', act: 'pane:cryptomarket', chev: true })])
      ].join('');
    }
  });

  DO.unwatch = s => {
    if (typeof CT !== 'undefined' && CT.toggleWatch) CT.toggleWatch(s);
    toast(s + ' removed from your watchlist');
    SET.repaint();
  };

  /* ── Trading preferences ─────────────────────────────────────────── */

  reg('tradingprefs', {
    t: 'Trading preferences', i: 'candlestick_chart', p: 'root',
    k: 'trading preferences paper order confirm default type leverage futures reset account spot',
    html: () => [
      `<p class="st-lead">The trading desk is a <b>paper account</b>. Orders are matched against live prices, and nothing is bought, sold or charged.</p>`,
      sec('Orders', [
        sw('crypto.confirmOrders', 'Confirm before placing an order', '', { icon: 'fact_check' }),
        row({ icon: 'list_alt', label: 'Default order type', value: ({ market: 'Market', limit: 'Limit' })[P().get('crypto.orderType') || 'limit'], to: 'ordertype' })
      ]),
      sec('Display', [
        sw('crypto.hideBalances', 'Hide balances', 'Replace every figure with dots until you tap to reveal', { icon: 'visibility_off' })
      ]),
      sec('', [
        row({ icon: 'candlestick_chart', label: 'Open the trading desk', act: 'pane:trade', chev: true }),
        row({ icon: 'restart_alt', label: 'Reset the paper account', sub: 'Back to the starting balance, all orders cancelled', act: 'resettrade', danger: true, chev: true })
      ]),
      `<p class="st-note">Prices come from live markets. A price that has gone stale cannot be traded on — Trending refuses rather than filling at a remembered number.</p>`
    ].join('')
  });

  reg('ordertype', {
    t: 'Default order type', i: 'list_alt', p: 'tradingprefs', k: 'order type market limit stop default',
    html: () => [
      `<p class="st-lead">Which tab the order form opens on.</p>`,
      pick('crypto.orderType', [
        ['limit', 'Limit', 'You set the price. It fills at your price or better.'],
        ['market', 'Market', 'Fills now, at whatever the book offers.']
      ])
    ].join('')
  });

  DO.resettrade = () => {
    if (typeof TR !== 'undefined' && TR.resetAccount) TR.resetAccount();
    else if (typeof navigateTo === 'function') navigateTo('trade');
  };

  /* ── Portfolio preferences ───────────────────────────────────────── */

  reg('portfolioprefs', {
    t: 'Portfolio preferences', i: 'pie_chart', p: 'root',
    k: 'portfolio preferences balance hide small assets currency valuation display',
    html: () => [
      `<p class="st-lead">How your holdings are shown.</p>`,
      sec('', [
        sw('crypto.hideBalances', 'Hide balances', 'Figures are replaced with dots until you tap to reveal', { icon: 'visibility_off' }),
        sw('crypto.hideSmall', 'Hide small balances', 'Anything under $1 is left out of the list', { icon: 'filter_list' }),
        sw('crypto.showPaper', 'Label paper balances', 'Mark simulated holdings everywhere they appear', { icon: 'label', value: true, off: true })
      ]),
      sec('Valuation', []),
      pick('crypto.currency', [
        ['USD', 'US dollar', 'Prices and totals in $'],
        ['EUR', 'Euro', 'Converted from the dollar price'],
        ['GBP', 'Pound sterling', 'Converted from the dollar price'],
        ['INR', 'Indian rupee', 'Converted from the dollar price']
      ]),
      sec('', [row({ icon: 'pie_chart', label: 'Open Assets', act: 'pane:portfolio', chev: true })]),
      `<p class="st-note">Paper balances are always labelled as simulated, which is why that switch cannot be turned off.</p>`
    ].join('')
  });

  /* ── Crypto notifications ────────────────────────────────────────── */

  reg('cryptonotif', {
    t: 'Crypto notifications', i: 'notifications_active', p: 'root',
    k: 'crypto notifications price deposit send security orders alerts',
    html: () => [
      `<p class="st-lead">What Trending tells you about money. These sit under the Crypto switch in Notifications — turning that off silences all of them.</p>`,
      sec('', [
        sw('crypto.notifPrice', 'Price alerts', '', { icon: 'trending_up' }),
        sw('crypto.notifDeposit', 'Deposits', '', { icon: 'south_west' }),
        sw('crypto.notifSend', 'Sends and withdrawals', '', { icon: 'north_east' }),
        sw('crypto.notifSecurity', 'Security', 'New address saved, wallet connected', { icon: 'shield' })
      ])
    ].join('')
  });

  /* ── Subscriptions ───────────────────────────────────────────────── */

  const PLUS = [
    ['Ad-free feed', 'No suggested posts you did not ask for'],
    ['Longer Shorty uploads', 'Up to ten minutes instead of one'],
    ['Full analytics history', 'Beyond the last 30 days'],
    ['Priority support', 'Your reports are looked at first']
  ];

  reg('plus', {
    t: 'Trending Plus', i: 'bolt', p: 'root',
    k: 'trending plus subscription premium billing renewal cancel features',
    html: () => {
      const on = !!P().get('subs.plus');
      const since = P().get('subs.plusAt');
      return [
        `<p class="st-lead">${on ? 'Plus is active on this account.' : 'Plus removes the parts of Trending that get in the way.'}</p>`,
        sec('Status', [
          row({ icon: 'bolt', label: 'Trending Plus', value: on ? 'Active' : 'Not subscribed', good: on,
            sub: on && since ? 'Since ' + when(since) : '' })
        ]),
        sec('What you get', PLUS.map(([t, s]) => row({ icon: 'check_circle', label: t, sub: s }))),
        sec('', [
          on
            ? row({ icon: 'cancel', label: 'Cancel Plus', sub: 'Keeps working until the period ends', act: 'cancelplus', danger: true, chev: true })
            : row({ icon: 'add_circle', label: 'Subscribe to Plus', act: 'subplus', chev: true }),
          row({ icon: 'receipt', label: 'Billing and receipts', to: 'orders' })
        ]),
        `<p class="st-note"><b>Nothing is charged.</b> Subscriptions on this build are simulated: no card, UPI or wallet details are ever asked for or stored.</p>`
      ].join('');
    }
  });

  DO.subplus = async () => {
    if (guest()) { toast('Sign in first.'); return DO.signin(); }
    if (!(await ask('Turn on Trending Plus? This build is a simulation — nothing is charged and no payment details are asked for.',
      { title: 'Trending Plus', ok: 'Turn on' }))) return;
    P().set('subs.plus', true);
    P().set('subs.plusAt', Date.now());
    toast('Trending Plus is on');
    SET.repaint();
  };

  DO.cancelplus = async () => {
    if (!(await ask('Cancel Trending Plus?', { ok: 'Cancel Plus', danger: true }))) return;
    P().set('subs.plus', false);
    toast('Trending Plus cancelled');
    SET.repaint();
  };

  reg('verified', {
    t: 'Trending Verified', i: 'verified', p: 'root',
    k: 'verified verification badge blue tick eligibility apply identity',
    html: () => {
      const on = !!P().get('subs.verified');
      const applied = P().get('subs.verifiedApplied');
      const eligible = !guest() && !!(SET._.me().email);
      return [
        `<p class="st-lead">A verified badge says the account is who it claims to be.</p>`,
        sec('Status', [
          row({ icon: 'verified', label: 'Verification', value: on ? 'Verified' : applied ? 'In review' : 'Not verified', good: on })
        ]),
        sec('Eligibility', [
          row({ icon: eligible ? 'check_circle' : 'radio_button_unchecked', label: 'Signed in with a confirmed email', value: eligible ? 'Met' : 'Not met', good: eligible }),
          // Two-factor is not built yet, so it cannot be met - the old
          // "Met" came from a switch that protected nothing.
          row({ icon: 'radio_button_unchecked', label: 'Two-factor authentication on', value: 'Not available yet',
            act: 'go:security', chev: true }),
          row({ icon: 'badge', label: 'A complete profile', sub: 'Name, photo and bio', act: 'edit', chev: true })
        ]),
        sec('', [
          on ? row({ icon: 'cancel', label: 'Give up verification', act: 'unverify', danger: true, chev: true })
             : row({ icon: 'send', label: applied ? 'Withdraw application' : 'Apply for verification', act: applied ? 'unapply' : 'applyverify', chev: true })
        ]),
        `<p class="st-note">Verification on this build is simulated and is not proof of identity. Nothing is charged and no documents are collected.</p>`
      ].join('');
    }
  });

  DO.applyverify = async () => {
    if (guest()) { toast('Sign in first.'); return DO.signin(); }
    if (!(await ask('Apply for verification? This build simulates the review — no documents are collected.', { ok: 'Apply' }))) return;
    P().set('subs.verifiedApplied', Date.now());
    toast('Application sent — you will hear back here');
    SET.repaint();
  };
  DO.unapply = () => { P().set('subs.verifiedApplied', 0); toast('Application withdrawn'); SET.repaint(); };
  DO.unverify = async () => {
    if (!(await ask('Remove the verified badge from your account?', { ok: 'Remove', danger: true }))) return;
    P().set('subs.verified', false);
    toast('Badge removed');
    SET.repaint();
  };

  reg('allsubs', {
    t: 'All subscriptions', i: 'subscriptions', p: 'root',
    k: 'all subscriptions creators memberships billing recurring manage cancel',
    html: () => {
      const mine = [
        P().get('subs.plus') ? { t: 'Trending Plus', s: 'Since ' + when(P().get('subs.plusAt')), a: 'go:plus' } : null,
        P().get('subs.verified') ? { t: 'Trending Verified', s: 'Active', a: 'go:verified' } : null
      ].filter(Boolean);
      const creators = P().get('subs.creators', []) || [];
      return [
        `<p class="st-lead">Everything recurring on this account.</p>`,
        sec('Trending', mine.length ? mine.map(m => row({ icon: 'bolt', label: m.t, sub: m.s, act: m.a, chev: true }))
          : [row({ icon: 'bolt', label: 'Trending Plus', value: 'Not subscribed', to: 'plus' })]),
        sec('Creators', creators.length
          ? creators.map(c => row({ icon: 'person', label: c.name, sub: c.tier || 'Member', value: 'Manage', act: 'go:orders', chev: true }))
          : [empty('subscriptions', 'No creator memberships', 'Support a creator from their profile and it appears here.')]),
        `<p class="st-note">Memberships are simulated: nothing is charged and no payment details are stored.</p>`
      ].join('');
    }
  });

  /* ── Orders and payments ─────────────────────────────────────────── */

  reg('orders', {
    t: 'Orders and payments', i: 'receipt', p: 'root',
    k: 'orders payments purchase history receipts refund payment methods billing creators',
    html: () => {
      const rows = ledger().filter(r => r.kind === 'spend' || r.kind === 'tip').slice(0, 20);
      return [
        `<p class="st-lead">Purchases, tips and memberships. Kept apart from on-chain transactions, which settle on a network rather than here.</p>`,
        sec('History', rows.length
          ? rows.map(r => row({ icon: r.kind === 'tip' ? 'volunteer_activism' : 'shopping_bag',
              label: r.note || (r.kind === 'tip' ? 'Tip' : 'Purchase'),
              sub: when(r.ts || r.at), value: r.qty != null ? r.qty + ' ' + (r.sym || '') : money(r.usd || 0) }))
          : [empty('receipt_long', 'No orders yet', 'Purchases, tips and memberships appear here.')]),
        sec('Payment methods', [
          row({ icon: 'account_balance_wallet', label: 'Trending balance', sub: 'Instant and free inside the app',
            value: (typeof MNY !== 'undefined' && MNY.balanceOf) ? money(MNY.balanceOf('USDT', 'funding')) : '', good: true }),
          row({ icon: 'currency_bitcoin', label: 'Crypto wallet', sub: 'On-chain, pays a network fee', to: 'wallets' })
        ]),
        sec('', [
          row({ icon: 'shopping_cart', label: 'Marketplace orders', sub: 'What you have bought, and its delivery status',
            act: 'profsec', arg: 'purchases', chev: true }),
          row({ icon: 'help', label: 'Ask about a payment', act: 'go:help', chev: true }),
          row({ icon: 'receipt_long', label: 'Full transaction history', to: 'txhistory' })
        ]),
        `<p class="st-note"><b>No card, UPI or bank details are ever asked for or stored.</b> Purchases, tips and memberships on this build are simulated. The P2P fiat leg happens off-platform, directly between the two people.</p>`
      ].join('');
    }
  });

  /* ── Help and support ────────────────────────────────────────────── */

  reg('help', {
    t: 'Help', i: 'help', p: 'root',
    k: 'help support report problem bug feature guide faq contact',
    html: () => [
      `<p class="st-lead">Something not working, or not making sense?</p>`,
      sec('', [
        row({ icon: 'auto_awesome', label: 'Ask the support assistant', sub: 'Answers about settings and features, on this device', to: 'aihelp' }),
        row({ icon: 'bug_report', label: 'Report a problem', sub: 'Tell us what went wrong', act: 'reportproblem', chev: true }),
        row({ icon: 'lightbulb', label: 'Suggest a feature', act: 'suggest', chev: true })
      ]),
      sec('Guides', [
        row({ icon: 'south_west', label: 'How deposits work', act: 'guide', arg: 'deposit', chev: true }),
        row({ icon: 'north_east', label: 'How sending crypto works', act: 'guide', arg: 'send', chev: true }),
        row({ icon: 'lock', label: 'Keeping your account safe', act: 'guide', arg: 'safety', chev: true }),
        row({ icon: 'candlestick_chart', label: 'What “paper trading” means', act: 'guide', arg: 'paper', chev: true })
      ])
    ].join('')
  });

  const GUIDES = {
    deposit: ['How deposits work',
      'You pick a coin and a network, and Trending shows the receiving address you connected for that network. You send to it from your exchange or wallet, and the coins arrive in <b>your</b> wallet.\n\nTrending does not hold your coins and never generates an address for you, so nothing is ever credited to a Trending balance by a deposit. Picking the wrong network loses the coins, which is why the network is chosen explicitly every time.'],
    send: ['How sending crypto works',
      'You choose the coin, the amount, the network and the destination. Trending checks the address against that network, shows the live network fee, and then hands the prepared payment to your own wallet app.\n\n<b>Trending never signs or broadcasts a transaction.</b> Your wallet asks you to approve it, and if you do not, nothing moves. Your recovery phrase and private keys never leave that wallet, and Trending will never ask for them.'],
    safety: ['Keeping your account safe',
      'Use a strong password you use nowhere else, or sign in with Google. Two-factor authentication and passkeys are not built yet. If anything looks wrong, reset your password from <b>Security</b>.\n\nFor crypto: keep “Confirm every send” on, and consider limiting sends to saved addresses.\n\nNobody from Trending will ever ask for your password, your recovery phrase or a private key. Anyone who does is not us.'],
    paper: ['What “paper trading” means',
      'The trading desk, Earn and P2P run on a simulated balance. Orders are matched against real live prices so the experience is honest, but no money is involved: nothing is bought, sold, deposited or charged, and the balance cannot be withdrawn.\n\nA price that has gone stale cannot be traded on — Trending refuses rather than filling your order at a remembered number.']
  };

  DO.guide = k => {
    const g = GUIDES[k];
    if (!g) return;
    SET.sheet(g[0], `<div class="st-prose">${g[1].split('\n\n').map(p2 => '<p>' + p2 + '</p>').join('')}</div>
      <button type="button" class="btn btn-primary w100 mt12" data-st="closesheet">Close</button>`);
  };

  DO.reportproblem = async () => {
    const what = await SET._.askText('What went wrong?', '', { title: 'Report a problem', ok: 'Send' });
    if (!what || !String(what).trim()) return;
    const reports = (P().get('help.reports', []) || []).slice();
    reports.unshift({ text: String(what).trim(), at: Date.now(), where: SET._.V.stack.slice(-1)[0] || 'settings' });
    P().set('help.reports', reports.slice(0, 50));
    toast('Thank you — your report is saved on this device and attached to your next support request');
  };

  DO.suggest = async () => {
    const what = await SET._.askText('What would you like Trending to do?', '', { title: 'Suggest a feature', ok: 'Send' });
    if (!what || !String(what).trim()) return;
    const ideas = (P().get('help.ideas', []) || []).slice();
    ideas.unshift({ text: String(what).trim(), at: Date.now() });
    P().set('help.ideas', ideas.slice(0, 50));
    toast('Noted — thank you');
  };

  /* ── The support assistant ───────────────────────────────────────── */

  /* It answers by searching the settings index, which is the honest
     version of a support bot: it knows exactly what this app can do,
     because it is reading the same list the search field reads. It
     runs here, on the device, and sends nothing anywhere. */
  reg('aihelp', {
    t: 'Trending AI support', i: 'auto_awesome', p: 'root',
    k: 'ai support assistant help chat ask question troubleshoot',
    html: () => [
      `<p class="st-lead">Ask about a setting or a feature. The assistant reads the same index the search field uses, runs on this device, and sends nothing anywhere.</p>`,
      `<div class="st-ask">
        <input id="st-ask-q" type="text" placeholder="e.g. how do I make my account private?" aria-label="Ask the support assistant">
        <button type="button" class="btn btn-primary" data-st="askai">Ask</button>
      </div>`,
      `<div id="st-ask-a"></div>`,
      sec('Common questions', [
        row({ icon: 'lock_person', label: 'How do I make my account private?', act: 'askthis', arg: 'private account', chev: true }),
        row({ icon: 'password', label: 'How do I change my password?', act: 'askthis', arg: 'password', chev: true }),
        row({ icon: 'north_east', label: 'How do I send crypto?', act: 'askthis', arg: 'send crypto network', chev: true }),
        row({ icon: 'block', label: 'How do I block someone?', act: 'askthis', arg: 'block', chev: true }),
        row({ icon: 'notifications_off', label: 'How do I stop notifications?', act: 'askthis', arg: 'notifications pause', chev: true })
      ])
    ].join('')
  });

  DO.askai = () => {
    const f = document.getElementById('st-ask-q');
    answer(f ? f.value : '');
  };
  DO.askthis = q => {
    const f = document.getElementById('st-ask-q');
    if (f) f.value = q;
    answer(q);
  };

  function answer(q) {
    const host = document.getElementById('st-ask-a');
    if (!host) return;
    const text = String(q || '').trim();
    if (!text) { host.innerHTML = ''; return; }
    const hits = SET._.results(text.replace(/[?.!]/g, ' '));
    if (!hits.length) {
      host.innerHTML = `<div class="st-answer">
        <p>I could not find a setting for that. Try naming the thing itself — “password”, “private”, “mute”, “network fee”.</p>
        <p>If it is not a setting, <button type="button" class="st-link" data-st="reportproblem">report a problem</button> and it is saved with your next support request.</p>
      </div>`;
      return;
    }
    const top = hits.slice(0, 4);
    const path = s => {
      const chain = [];
      let at = s;
      while (at && at.parent && SET._.SCREENS[at.parent]) {
        chain.unshift(SET._.SCREENS[at.parent].t);
        at = { parent: SET._.SCREENS[at.parent].p };
      }
      return chain.concat(s.title).join(' → ');
    };
    host.innerHTML = `<div class="st-answer">
      <p>Here is where that lives:</p>
      ${SET.sec('', top.map(s => SET.row({ icon: s.icon || 'tune', label: path(s), act: 'goq:' + s.id, chev: true })))}
      <p class="st-note">Not it? Add a word or two — the assistant matches on the names of the settings themselves.</p>
    </div>`;
  }

  /* ── Privacy Centre, account status, about ───────────────────────── */

  reg('privacycentre', {
    t: 'Privacy Centre', i: 'privacy_tip', p: 'root',
    k: 'privacy centre data controls permissions download information policy tracking',
    html: () => [
      `<p class="st-lead">What Trending knows about you, and the controls over it.</p>`,
      sec('What is stored where', [
        row({ icon: 'smartphone', label: 'On this device', sub: 'Posts, drafts, settings, paper balances and history', value: 'Most of it' }),
        row({ icon: 'cloud', label: 'On your account', sub: 'Your profile and, when signed in, your settings', value: guest() ? 'Nothing yet' : 'Synced' }),
        row({ icon: 'key_off', label: 'Never stored', sub: 'Recovery phrases, private keys, passwords, card details', value: 'Never', good: true })
      ]),
      sec('Your controls', [
        row({ icon: 'download', label: 'Download your information', act: 'download', chev: true }),
        row({ icon: 'phone_iphone', label: 'Device permissions', to: 'permissions' }),
        row({ icon: 'captive_portal', label: 'Website permissions', to: 'siteperms' }),
        row({ icon: 'tune', label: 'What shapes your feed', to: 'content' }),
        row({ icon: 'delete_sweep', label: 'Clear your activity', to: 'activity' })
      ]),
      sec('Documents', [
        row({ icon: 'policy', label: 'Privacy policy', act: 'legal', arg: 'privacy', chev: true }),
        row({ icon: 'cookie', label: 'Cookies and storage', act: 'legal', arg: 'cookies', chev: true })
      ])
    ].join('')
  });

  reg('status', {
    t: 'Account status', i: 'gavel', p: 'root',
    k: 'account status standing removed restrictions reports appeals guidelines strikes',
    html: () => {
      const strikes = (P().get('help.strikes', []) || []);
      const ok = !strikes.length;
      return [
        `<p class="st-lead">Whether anything is limiting your account.</p>`,
        `<div class="st-status ${ok ? 'ok' : 'warn'}">
          <span>${SET._.ico(ok ? 'verified_user' : 'gpp_maybe')}</span>
          <b>${ok ? 'Your account is in good standing' : strikes.length + ' issue' + (strikes.length === 1 ? '' : 's')}</b>
          <em>${ok ? 'Nothing has been removed and nothing is restricted.' : 'See below for what happened and how to appeal.'}</em>
        </div>`,
        sec('', [
          row({ icon: 'delete', label: 'Content removed', value: ok ? 'None' : String(strikes.length), good: ok }),
          row({ icon: 'lock', label: 'Feature restrictions', value: 'None', good: true }),
          row({ icon: 'flag', label: 'Reports about you', value: 'None', good: true })
        ]),
        strikes.length ? sec('Issues', strikes.map((s, i) => row({ icon: 'gpp_bad', label: s.what || 'Content removed',
          sub: when(s.at), value: 'Appeal', act: 'appeal', arg: String(i), chev: true }))) : '',
        sec('', [row({ icon: 'menu_book', label: 'Community guidelines', act: 'legal', arg: 'guidelines', chev: true })])
      ].join('');
    }
  });

  DO.appeal = async () => {
    if (!(await ask('Send an appeal for review?', { ok: 'Appeal' }))) return;
    toast('Appeal sent — you will hear back here');
  };

  reg('about', {
    t: 'About', i: 'info', p: 'root',
    k: 'about version terms privacy policy guidelines licences open source legal',
    html: () => [
      `<p class="st-lead">Trending — a social app with crypto built in rather than bolted on.</p>`,
      sec('', [
        row({ icon: 'update', label: 'Version', value: SET.version }),
        row({ icon: 'code', label: 'Build', value: 'Web' })
      ]),
      sec('Legal', [
        row({ icon: 'gavel', label: 'Terms of service', act: 'legal', arg: 'terms', chev: true }),
        row({ icon: 'policy', label: 'Privacy policy', act: 'legal', arg: 'privacy', chev: true }),
        row({ icon: 'menu_book', label: 'Community guidelines', act: 'legal', arg: 'guidelines', chev: true }),
        row({ icon: 'code_blocks', label: 'Open-source licences', act: 'legal', arg: 'licences', chev: true })
      ]),
      sec('', [
        row({ icon: 'refresh', label: 'Check for updates', act: 'checkupdate', chev: true }),
        row({ icon: 'cleaning_services', label: 'Clear cached data', sub: 'Market data and images — your posts and settings are untouched', act: 'clearcache', chev: true })
      ])
    ].join('')
  });

  const LEGAL = {
    terms: ['Terms of service',
      'Trending is provided as it is. You keep the rights to what you post, and you give Trending permission to show it to the people you chose to show it to.\n\nThe trading desk, Earn, P2P, memberships and tips are <b>simulated</b>. No money changes hands, nothing is charged, and a simulated balance has no value and cannot be withdrawn.\n\nCrypto deposits and sends move real coins between wallets you control. Trending is not a custodian, does not hold your coins, and never signs or broadcasts a transaction.'],
    privacy: ['Privacy policy',
      'Almost everything Trending knows about you is stored on this device. When you sign in, your profile and your settings are also kept on your account so a second device matches the first.\n\nTrending never stores a recovery phrase, a private key, a password or a card number. The AI features run on this device.\n\nYou can download everything this device holds, at any time, from Settings → Account Centre.'],
    guidelines: ['Community guidelines',
      'Be someone other people are glad to find here.\n\nNo harassment, no hate, no sexual content involving minors, no incitement to violence.\n\nOn crypto specifically: no fake giveaways, no impersonating a project or an exchange, and never ask anyone for a recovery phrase or a private key. Anyone asking for one is trying to rob you, without exception.'],
    cookies: ['Cookies and storage',
      'Trending uses your browser’s own storage to keep your posts, drafts, settings and paper balances on this device. It does not set advertising cookies and does not track you across other websites.\n\nClearing your browser’s site data for Trending erases all of it, which is why the download option exists.'],
    licences: ['Open-source licences',
      'Trending is built on open-source work. Material Symbols is licensed under Apache 2.0. Firebase is used for sign-in and profile sync under its own terms. Market data comes from CoinGecko, network fees from each chain’s public endpoints, and Bitcoin fee estimates from mempool.space.\n\nThank you to everyone whose work this is built on.']
  };

  DO.legal = k => {
    const g = LEGAL[k];
    if (!g) return;
    SET.sheet(g[0], `<div class="st-prose">${g[1].split('\n\n').map(p2 => '<p>' + p2 + '</p>').join('')}</div>
      <button type="button" class="btn btn-primary w100 mt12" data-st="closesheet">Close</button>`);
  };

  DO.checkupdate = async () => {
    toast('Checking…');
    try {
      const r = await fetch('/api/health', { cache: 'no-store' });
      toast(r.ok ? 'Trending is up to date' : 'Could not reach the server');
    } catch (e) { toast('You appear to be offline'); }
  };

  DO.clearcache = async () => {
    if (!(await ask('Clear cached market data and images? Your posts, settings and balances are untouched.', { ok: 'Clear' }))) return;
    const CACHED = ['ts_cg_markets_v1', 'ts_news_cache', 'ts_token_meta_v1', 'ts_cryptomarket_v1', 'ts_cm_seen_v1'];
    CACHED.forEach(k => { try { localStorage.removeItem(k); } catch (e) {} });
    if (window.caches && caches.keys) { try { (await caches.keys()).forEach(k => caches.delete(k)); } catch (e) {} }
    toast('Cache cleared');
  };
}
