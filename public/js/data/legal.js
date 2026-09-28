/* ── The legal pages ──────────────────────────────────────────────────
   One copy of the Terms, the Privacy Notice and the rest, so Settings
   and the sign-in screen show the same words, and so the version a
   person agreed to can be kept with the agreement.

   Every statement here was checked against the code on 28 September
   2026: where data is stored, who can read it, which services the
   browser calls. It is not yet reviewed by a lawyer, and it still lacks
   what only the operator can supply: the legal entity behind Trending, a
   contact address, a grievance officer (India's DPDP Act asks for one),
   and how long each kind of record is kept.

   Change LEGAL_VERSION whenever the Terms or the Privacy Notice change.
   Paragraphs are separated by a blank line; <b> is the only markup. */

export const LEGAL_VERSION = '2026-09-28';

export const LEGAL = {
  terms: ['Terms of service',
    'These terms apply whenever you use Trending. By creating an account, or by continuing to use the app, you agree to them.\n\n' +
    '<b>Who can use Trending.</b> You must be 18 or older.\n\n' +
    '<b>What you post.</b> You keep the rights to it. You give Trending permission to store it and to show it to the people you chose to show it to. Posts to the feed are public: anyone can see them, signed in or not.\n\n' +
    '<b>Practice money.</b> The trading desk, Earn, P2P, the Card, memberships, tips and the payments in Trending Pay are <b>simulated</b>. No money changes hands, nothing is charged, and a practice balance has no value and cannot be withdrawn.\n\n' +
    '<b>Real crypto stays yours.</b> When you send crypto you do it from a wallet you control. Trending does not hold your coins, and never signs or broadcasts a transaction.\n\n' +
    '<b>Not financial advice.</b> Prices, charts, news and anything other people post are information, not advice. Crypto prices move fast, and you can lose money.\n\n' +
    '<b>Using Trending fairly.</b> Follow the Community guidelines. Do not use Trending to break the law, to deceive or harm people, or to attack the app or its users. Content or accounts that do may be removed.\n\n' +
    '<b>No guarantees.</b> Trending is provided as it is, and may change or stop. Market data comes from other services and can be late or wrong.'],
  privacy: ['Privacy notice',
    'What Trending collects, where it is kept, who can see it, and what you can do about it.\n\n' +
    '<b>Your account.</b> Signing in runs on Google’s Firebase. It holds your email address or phone number and, if you use Google or Apple, the name and photo they share. Your account record (name, email, photo, level and synced settings) can be read only by you.\n\n' +
    '<b>What is public.</b> Your handle, your display name and everything you post to the feed can be seen by anyone, including people who are not signed in. Who liked a post is visible only to the person who liked it; the count is public.\n\n' +
    '<b>What stays on this device.</b> Drafts, chats, settings, practice balances and trades are kept in this browser’s storage, not on a server. Clearing the site’s data erases them.\n\n' +
    '<b>Trending’s server.</b> Like every website, it receives your IP address with each request. Security logs keep a shortened address, with the last part removed, and a scrambled account ID. The full address is used only to limit how often one visitor can call the server, and is not stored. The hosting provider keeps its own request logs. If you use Trending Pay or open a support ticket, those records are kept on the server.\n\n' +
    '<b>Services the app calls.</b> To show live data, your browser connects straight to other services, which see your IP address. They include CoinGecko and Binance (prices), rss2json (news), mempool.space (network fees), Google Fonts and jsDelivr (fonts and code), and Unsplash (images). Automatic captions download a speech model from Hugging Face; the captions themselves are made on your device.\n\n' +
    '<b>AI features.</b> They run on this device. What you type is not sent to an AI company.\n\n' +
    '<b>What Trending never does.</b> It never stores a recovery phrase, a private key, a password or a card number. It shows no advertising and does not track you across other websites.\n\n' +
    '<b>Your choices.</b> Download what this device holds from Settings → Account Centre → Download your information. Delete your account, your profile and your posts from Settings → Account Centre → Delete account.\n\n' +
    '<b>Age.</b> Trending is for people aged 18 and over.'],
  guidelines: ['Community guidelines',
    'Be someone other people are glad to find here.\n\nNo harassment, no hate, no sexual content involving minors, no incitement to violence.\n\nOn crypto specifically: no fake giveaways, no impersonating a project or an exchange, and never ask anyone for a recovery phrase or a private key. Anyone asking for one is trying to rob you, without exception.'],
  cookies: ['Cookies and storage',
    'Trending uses your browser’s own storage to keep your sign-in, drafts, chats, settings and practice balances on this device. It does not set advertising cookies and does not track you across other websites.\n\nClearing your browser’s site data for Trending erases all of it, which is why the download option exists.'],
  licences: ['Open-source licences',
    'Trending is built on open-source work. Material Symbols is licensed under Apache 2.0. Firebase is used for sign-in and profile sync under its own terms. Market data comes from CoinGecko, network fees from each chain’s public endpoints, and Bitcoin fee estimates from mempool.space.\n\nThank you to everyone whose work this is built on.']
};
