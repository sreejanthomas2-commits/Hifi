/* ╔══════════════════════════════════════════════════════════════════╗
   ║  SETTINGS — who sees you, who can reach you, what you see         ║
   ║                                                                   ║
   ║  Three questions that people actually ask, kept apart because     ║
   ║  they have different answers: who can see what I post, who can    ║
   ║  interact with me, and what am I shown.                           ║
   ║                                                                   ║
   ║  The lists — blocked, restricted, close friends, favourites,      ║
   ║  muted — are the same component four times over, because they     ║
   ║  are the same thing: a set of people and a way out of it.         ║
   ╚══════════════════════════════════════════════════════════════════╝ */

'use strict';

export default function register(SET) {

  const { reg, DO, esc, toast, ask, askText, empty, person, P } = SET._;
  const { row, sw, pick, sec } = SET;

  const AUDIENCE = [
    ['everyone', 'Everyone', 'Anyone on Trending'],
    ['following', 'People you follow', 'Only accounts you follow back'],
    ['nobody', 'No one', 'Nobody can']
  ];

  /* ── The list screens ────────────────────────────────────────────── */

  /* One builder for blocked, restricted, close friends and favourites.
     Each list differs only in what it means and what adding does. */
  function listScreen(id, o) {
    reg(id, {
      t: o.t, i: o.i, p: o.p || 'root', k: o.k,
      html: () => {
        const list = P().listAll(o.list);
        return [
          `<p class="st-lead">${o.lead}</p>`,
          sec('', [row({ icon: 'person_add', label: o.addLabel, act: 'addto', arg: o.list, chev: true })]),
          list.length
            ? sec(list.length + (list.length === 1 ? ' account' : ' accounts'), list.map(h => person(h, o.list, o.rowSub)))
            : empty(o.emptyIcon || o.i, o.emptyTitle, o.emptyText)
        ].join('');
      }
    });
  }

  listScreen('blocked', {
    t: 'Blocked', i: 'block', list: 'blocked',
    k: 'blocked block unblock accounts people hide stop',
    lead: 'Blocked accounts cannot find your profile, posts or story, and cannot message you. They are not told.',
    addLabel: 'Block an account', rowSub: 'Blocked',
    emptyTitle: 'Nobody is blocked', emptyText: 'Block someone from their profile, or add them here.'
  });

  listScreen('restricted', {
    t: 'Restricted', i: 'person_off', list: 'restricted',
    k: 'restricted restrict limit quietly comments approve',
    lead: 'A restricted account can still see you, but their comments are only visible to them until you approve, and their messages go to requests. They are not told.',
    addLabel: 'Restrict an account', rowSub: 'Restricted',
    emptyTitle: 'Nobody is restricted', emptyText: 'Restricting is the quieter alternative to blocking.'
  });

  listScreen('closefriends', {
    t: 'Close friends', i: 'stars', list: 'closeFriends',
    k: 'close friends list story green private circle',
    lead: 'Post a story or a note to close friends only. Nobody is told they are on the list, and only you can see it.',
    addLabel: 'Add a close friend', rowSub: 'Close friend',
    emptyTitle: 'No close friends yet', emptyText: 'Add people here, then choose “Close friends” when you post a story.'
  });

  listScreen('favorites', {
    t: 'Favourites', i: 'star', list: 'favorites',
    k: 'favourites favorites prioritise creators feed top first',
    lead: 'Posts from favourites appear higher in your feed. They are not told.',
    addLabel: 'Add a favourite', rowSub: 'Shown higher in your feed',
    emptyTitle: 'No favourites yet', emptyText: 'Add the accounts you never want to miss.'
  });

  DO.addto = async list => {
    const label = { blocked: 'block', restricted: 'restrict', closeFriends: 'add as a close friend', favorites: 'add to favourites', mutedAccounts: 'mute' }[list] || 'add';
    const v = await askText('Username to ' + label, '', { title: 'Add an account', ok: 'Add' });
    if (v == null) return;
    const h = String(v).trim().replace(/^@+/, '');
    if (!h) return;
    if (!/^[a-z0-9._]{2,30}$/i.test(h)) { toast('That is not a username.'); return; }
    if (h.toLowerCase() === String(SET._.myHandle()).replace(/^@/, '').toLowerCase()) { toast('That is you.'); return; }
    if (P().listHas(list, h)) { toast('@' + h + ' is already on this list.'); return; }
    /* Blocking and restricting are opposites of favouriting, so a
       person never sits on both sides at once. */
    if (list === 'blocked') { P().listRemove('favorites', h); P().listRemove('closeFriends', h); }
    if (list === 'favorites' || list === 'closeFriends') P().listRemove('blocked', h);
    P().listAdd(list, h, list === 'mutedAccounts' ? { posts: true, stories: true } : null);
    toast('@' + h + ' added');
    SET.repaint();
  };

  /* ── Account privacy ─────────────────────────────────────────────── */

  reg('privacy', {
    t: 'Account privacy', i: 'lock_person', p: 'root',
    k: 'account privacy private public who can see profile posts followers approve',
    html: () => {
      const priv = P().get('privacy.account') === 'private';
      return [
        `<p class="st-lead">Who can see what you post.</p>`,
        pick('privacy.account', [
          ['public', 'Public account', 'Anyone can see your posts, and anyone can follow you'],
          ['private', 'Private account', 'Only people you approve can see your posts and stories']
        ]),
        sec('', [
          sw('privacy.activityStatus', 'Show when you are active', 'People you message can see you are online', { icon: 'circle' }),
          sw('privacy.readReceipts', 'Read receipts', 'People can see when you have read a message', { icon: 'done_all' })
        ]),
        priv ? `<p class="st-note">Your existing followers keep their access. New followers have to be approved.</p>` : '',
        sec('Also worth checking', [
          row({ icon: 'auto_stories', label: 'Story, live and location', to: 'storylive' }),
          row({ icon: 'stars', label: 'Close friends', to: 'closefriends' }),
          row({ icon: 'block', label: 'Blocked', to: 'blocked' })
        ])
      ].join('');
    }
  });

  /* ── Crossposting ────────────────────────────────────────────────── */

  reg('xpost', {
    t: 'Crossposting', i: 'dashboard_customize', p: 'root',
    k: 'crossposting cross post share automatically communities threads recommend',
    html: () => [
      `<p class="st-lead">Whether something you post here is offered to the other places you are part of. Nothing is ever posted without you choosing it in the composer.</p>`,
      sec('Inside Trending', [
        sw('privacy.xpostCommunities', 'Offer to share to your communities', 'The composer suggests communities you are in', { icon: 'groups' })
      ]),
      sec('Outside Trending', [
        sw('privacy.xpostThreads', 'Offer to share to connected services', 'Only services you have connected yourself', { icon: 'share' })
      ]),
      `<p class="st-note">Connect a service under <b>Account Centre → Connected accounts</b>. Trending never posts anywhere on your behalf without you tapping share.</p>`
    ].join('')
  });

  /* ── Story, live and location ────────────────────────────────────── */

  reg('storylive', {
    t: 'Story, live and location', i: 'auto_stories', p: 'root',
    k: 'story live location audience replies sharing streams who can see broadcast',
    html: () => [
      `<p class="st-lead">Who sees your story and your streams, and whether posts carry a place.</p>`,
      sec('Story audience', [], ''),
      pick('privacy.storyAudience', [
        ['everyone', 'Everyone', 'Anyone can see your story'],
        ['followers', 'Followers', 'Only people who follow you'],
        ['close', 'Close friends only', P().listCount('closeFriends') + ' people'],
        ['nobody', 'Nobody', 'Stories stay private to you']
      ]),
      sec('Story replies', []),
      pick('privacy.storyReplies', AUDIENCE),
      sec('Live', []),
      pick('privacy.liveAudience', [
        ['everyone', 'Anyone can watch', ''],
        ['followers', 'Followers only', ''],
        ['nobody', 'Nobody — do not go live', '']
      ]),
      sec('', [sw('privacy.liveChat', 'Live chat', 'Let viewers comment during a stream',
        { icon: 'forum', value: P().get('privacy.liveChat') !== 'nobody', act: 'tglivechat' })]),
      sec('Location', [
        sw('privacy.location', 'Add a location to posts', 'Off means a post never carries where you were', { icon: 'location_on', act: 'tglocation' })
      ]),
      `<p class="st-note">Trending only reads your location when you tap to add one, and only if the device allows it.</p>`
    ].join('')
  });

  DO.tglivechat = (a, b, el) => { P().set('privacy.liveChat', el.checked ? 'followers' : 'nobody'); SET.repaint(); };

  DO.tglocation = async (a, b, el) => {
    if (!el.checked) { P().set('privacy.location', false); toast('Posts will not carry a location'); SET.repaint(); return; }
    const state = await P().request('location');
    if (state !== 'granted') {
      toast(state === 'denied' ? 'Your device is blocking location for this site.' : 'Location is not available here.');
      SET.repaint();
      return;
    }
    P().set('privacy.location', true);
    toast('You can add a location when you post');
    SET.repaint();
  };

  /* ── Activity in friends' feed ───────────────────────────────────── */

  reg('friendsact', {
    t: 'Activity in friends’ feed', i: 'groups', p: 'root',
    k: 'activity friends feed likes comments follows communities visible show',
    html: () => [
      `<p class="st-lead">Which of the things you do can appear in what your followers see.</p>`,
      sec('', [
        sw('privacy.actLikes', 'Posts you like', '', { icon: 'favorite' }),
        sw('privacy.actComments', 'Posts you comment on', '', { icon: 'mode_comment' }),
        sw('privacy.actFollows', 'Accounts you follow', '', { icon: 'person_add' }),
        sw('privacy.actCommunities', 'Communities you join', '', { icon: 'groups' })
      ]),
      `<p class="st-note">Turning all of these off does not hide the like itself from the person who posted — it keeps it out of other people’s feeds.</p>`
    ].join('')
  });

  /* ── Messages and story replies ──────────────────────────────────── */

  reg('msgprivacy', {
    t: 'Messages and story replies', i: 'send', p: 'root',
    k: 'messages story replies dm who can message requests group invites read receipts activity status',
    html: () => [
      `<p class="st-lead">Who can start a conversation with you.</p>`,
      sec('Who can message you', []),
      pick('interact.messages', [
        ['everyone', 'Everyone', 'Anyone can message; people you do not follow land in requests'],
        ['following', 'People you follow', 'Everyone else has to send a request'],
        ['nobody', 'No one', 'Only people already in a conversation with you']
      ]),
      sec('Requests', [
        sw('interact.requests', 'Allow message requests', 'Off means messages from strangers are refused outright', { icon: 'mark_email_unread' }),
        sw('interact.hideRequests', 'Filter request inbox', 'Hide requests that look like spam', { icon: 'filter_alt' })
      ]),
      sec('Group invitations', []),
      pick('interact.groupInvites', AUDIENCE),
      sec('Story replies', []),
      pick('privacy.storyReplies', AUDIENCE),
      sec('Conversations', [
        sw('privacy.readReceipts', 'Read receipts', 'People can see when you have read a message', { icon: 'done_all' }),
        sw('privacy.activityStatus', 'Activity status', 'People can see when you were last active', { icon: 'circle' })
      ])
    ].join('')
  });

  /* ── Tags and mentions ───────────────────────────────────────────── */

  reg('tags', {
    t: 'Tags and mentions', i: 'alternate_email', p: 'root',
    k: 'tags mentions tagged who can tag approve manually everyone nobody',
    html: () => [
      `<p class="st-lead">Who can put your name on something.</p>`,
      sec('Who can tag you', []),
      pick('interact.tags', AUDIENCE),
      sec('Who can mention you', []),
      pick('interact.mentions', AUDIENCE),
      sec('', [
        sw('interact.tagApproval', 'Approve tags manually', 'A tag only appears on your profile once you allow it', { icon: 'fact_check' })
      ])
    ].join('')
  });

  /* ── Comments ────────────────────────────────────────────────────── */

  reg('comments', {
    t: 'Comments', i: 'mode_comment', p: 'root',
    k: 'comments who can comment filter offensive spam block hide words',
    html: () => [
      `<p class="st-lead">Who can comment on your posts, and what gets filtered out.</p>`,
      sec('Who can comment', []),
      pick('interact.comments', AUDIENCE),
      sec('Filters', [
        sw('interact.commentOffensive', 'Hide offensive comments', 'Comments with likely offensive words are hidden from everyone but their author', { icon: 'shield' }),
        sw('interact.commentSpam', 'Hide spam', 'Repeated and scam-shaped comments', { icon: 'block' })
      ]),
      sec('', [
        row({ icon: 'text_fields', label: 'Hidden words', sub: 'Your own list of words to filter', to: 'hiddenwords' }),
        row({ icon: 'person_off', label: 'Restricted accounts', sub: 'Their comments need your approval', to: 'restricted' })
      ])
    ].join('')
  });

  /* ── Sharing ─────────────────────────────────────────────────────── */

  reg('sharing', {
    t: 'Sharing', i: 'ios_share', p: 'root',
    k: 'sharing share posts stories repost reshare send message allow',
    html: () => [
      `<p class="st-lead">What other people may do with what you post.</p>`,
      sec('Others can share', [
        sw('interact.shPosts', 'Your posts', '', { icon: 'grid_on' }),
        sw('interact.shShorty', 'Your Shorty videos', '', { icon: 'slow_motion_video' }),
        sw('interact.shStories', 'Your stories', '', { icon: 'auto_stories' })
      ]),
      sec('How', [
        sw('interact.shRepost', 'Repost to their own profile', '', { icon: 'repeat' }),
        sw('interact.shDm', 'Send in a message', '', { icon: 'send' })
      ]),
      `<p class="st-note">Turning sharing off removes the buttons. It cannot stop someone taking a screenshot.</p>`
    ].join('')
  });

  /* ── Limit interactions ──────────────────────────────────────────── */

  reg('limits', {
    t: 'Limit interactions', i: 'error', p: 'root',
    k: 'limit interactions temporarily reduce comments messages mentions tags follow requests wave',
    html: () => {
      const on = !!P().get('interact.limitOn');
      return [
        `<p class="st-lead">For when a post takes off, or something turns unpleasant. This hides interaction from accounts that do not already follow you — without blocking anyone.</p>`,
        sec('', [sw('interact.limitOn', 'Limit interactions', on ? 'On since you turned it on' : 'Off', { icon: 'shield_moon' })]),
        sec('While limited, hide from people who do not follow you', [
          sw('interact.limitComments', 'Comments', '', { icon: 'mode_comment', off: !on }),
          sw('interact.limitMessages', 'Messages', '', { icon: 'chat', off: !on }),
          sw('interact.limitMentions', 'Mentions', '', { icon: 'alternate_email', off: !on }),
          sw('interact.limitTags', 'Tags', '', { icon: 'sell', off: !on }),
          sw('interact.limitFollows', 'Follow requests', '', { icon: 'person_add', off: !on })
        ]),
        !on ? `<p class="st-note">Turn it on to choose what gets limited. Nothing is lost while it is on — it is waiting for you, not deleted.</p>` : ''
      ].join('');
    }
  });

  /* ── Hidden words ────────────────────────────────────────────────── */

  reg('hiddenwords', {
    t: 'Hidden words', i: 'text_fields', p: 'root',
    k: 'hidden words offensive filter custom list spam comments message requests mute words',
    html: () => {
      const list = P().words();
      return [
        `<p class="st-lead">Comments, messages and requests containing these are hidden from you. Their author still sees their own.</p>`,
        sec('Automatic', [
          sw('interact.hideOffensive', 'Hide likely offensive words', 'A built-in list, including the usual crypto scam phrasing', { icon: 'shield' }),
          sw('interact.hideSpam', 'Hide spam', 'Repeated and mass-sent content', { icon: 'block' }),
          sw('interact.hideRequests', 'Filter message requests', '', { icon: 'mark_email_unread' })
        ]),
        sec('Your own list', [
          sw('interact.hideCustom', 'Use my list', list.length + (list.length === 1 ? ' word' : ' words'), { icon: 'playlist_add_check' }),
          row({ icon: 'add', label: 'Add a word or phrase', act: 'addword', chev: true })
        ]),
        list.length ? sec('Hidden', list.map(w => `
          <div class="st-person" data-label="${esc(w)}">
            <span class="st-person-av word">${esc(w.slice(0, 2))}</span>
            <span class="st-person-t"><b>${esc(w)}</b></span>
            <button type="button" class="st-person-x" data-st="delword" data-a="${esc(w)}">Remove</button>
          </div>`)) : '',
        `<p class="st-note">Matching is on whole words, so “class” is not caught by a filter on “ass”.</p>`
      ].join('');
    }
  });

  DO.addword = async () => {
    const v = await askText('Word or phrase to hide', '', { title: 'Hidden words', ok: 'Add' });
    if (v == null) return;
    const w = String(v).trim();
    if (!w) return;
    if (w.length > 40) { toast('That is too long to filter on.'); return; }
    if (!P().wordAdd(w)) { toast('“' + w + '” is already on the list.'); return; }
    toast('“' + w + '” will be hidden');
    SET.repaint();
  };

  DO.delword = w => { P().wordRemove(w); toast('“' + w + '” removed'); SET.repaint(); };

  /* ── Follow and invite ───────────────────────────────────────────── */

  reg('follow', {
    t: 'Follow and invite friends', i: 'person_add', p: 'root',
    k: 'follow invite friends contacts link qr profile share discover people',
    html: () => [
      `<p class="st-lead">Ways of finding people, and of being found.</p>`,
      sec('', [
        row({ icon: 'travel_explore', label: 'Discover people', sub: 'Creators and communities picked for you', act: 'discoverpeople', chev: true }),
        row({ icon: 'qr_code_2', label: 'Your profile QR code', sub: 'Someone scans it and lands on your profile', act: 'myqr', chev: true }),
        row({ icon: 'link', label: 'Copy your profile link', act: 'copylink', chev: true }),
        row({ icon: 'ios_share', label: 'Share your profile', act: 'shareprofile', chev: true })
      ]),
      sec('Contacts', [
        row({ icon: 'contacts', label: 'Find friends from contacts',
          sub: 'Trending never uploads your contacts — the matching happens on this device',
          act: 'contacts', chev: true })
      ])
    ].join('')
  });

  DO.discoverpeople = () => {
    if (window.DX && DX.open) { DX.open(); if (DX.chip) DX.chip('creators'); }
    else if (typeof navigateTo === 'function') navigateTo('explore');
  };
  DO.myqr = () => { if (window.PAY && PAY.openMyQR) PAY.openMyQR(); else toast('Your code is still loading…'); };

  DO.copylink = async () => {
    const h = String(SET._.myHandle()).replace(/^@/, '');
    const url = 'https://trending.app/' + encodeURIComponent(h);
    try { await navigator.clipboard.writeText(url); toast('Profile link copied'); }
    catch (e) { toast(url); }
  };

  DO.shareprofile = async () => {
    const h = String(SET._.myHandle()).replace(/^@/, '');
    const url = 'https://trending.app/' + encodeURIComponent(h);
    if (navigator.share) {
      try { await navigator.share({ title: SET._.myName() + ' on Trending', text: 'Follow @' + h + ' on Trending', url }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    DO.copylink();
  };

  /* The Contacts Picker exists on very few browsers, and asking for the
     whole address book when it does would be worse than not offering
     it. So it opens the picker where there is one and says so plainly
     where there is not. */
  DO.contacts = async () => {
    if (!navigator.contacts || !navigator.contacts.select) {
      await ask('This browser does not let a website read contacts. On the Trending app for Android or iOS, matching happens on the device and nothing is uploaded.',
        { title: 'Find friends from contacts', ok: 'Got it', alert: true });
      return;
    }
    try {
      const picked = await navigator.contacts.select(['name'], { multiple: true });
      toast(picked.length ? picked.length + ' contacts checked — no matches on Trending yet' : 'Nothing selected');
    } catch (e) { toast('No contacts were shared.'); }
  };

  /* ── Muted accounts ──────────────────────────────────────────────── */

  /* Muting is not one switch: most people want the stories gone and the
     posts kept, or the other way round. */
  reg('muted', {
    t: 'Muted accounts', i: 'volume_off', p: 'root',
    k: 'muted mute accounts posts stories notes messages hide quiet',
    html: () => {
      const all = P().listAll('mutedAccounts');
      const topics = (window.DX && DX._ && DX._.P) ? Object.keys(DX._.P.muted || {}) : [];
      return [
        `<p class="st-lead">Muted accounts stay followed and are never told. You choose what goes quiet.</p>`,
        sec('', [row({ icon: 'person_add', label: 'Mute an account', act: 'addto', arg: 'mutedAccounts', chev: true })]),
        all.length ? sec('Accounts', all.map(h => {
          const m = (P().all().mutedAccounts || {})[h] || {};
          const on = ['posts', 'stories', 'notes', 'messages'].filter(k => m[k]);
          return row({
            icon: 'volume_off', label: '@' + h,
            sub: on.length ? 'Muted: ' + on.join(', ') : 'Nothing muted yet',
            act: 'mutewhat', arg: h, chev: true
          });
        })) : empty('volume_up', 'Nobody is muted', 'Mute someone from their profile, or add them here.'),
        topics.length ? sec('Muted topics', topics.map(t => `
          <div class="st-person" data-label="${esc(t)}">
            <span class="st-person-av word">${esc(t.slice(0, 2))}</span>
            <span class="st-person-t"><b>${esc(t)}</b><em>Hidden from Discover</em></span>
            <button type="button" class="st-person-x" data-st="unmutetopic" data-a="${esc(t)}">Unmute</button>
          </div>`)) : ''
      ].join('');
    }
  });

  DO.mutewhat = h => {
    const m = (P().all().mutedAccounts || {})[h] || {};
    const line = (k, l, s) => sw('', l, s, { value: !!m[k], act: 'tgmute', a: h, b: k });
    SET.sheet('Mute @' + h, [
      `<p class="st-sheet-p">They are not told, and you still follow them.</p>`,
      `<div class="st-rows">`,
      line('posts', 'Posts', 'Keep them out of your feed'),
      line('stories', 'Stories', 'Move them to the end and stop the ring'),
      line('notes', 'Notes', ''),
      line('messages', 'Messages', 'Their chat stops notifying you'),
      `</div>`,
      `<button type="button" class="btn btn-ghost w100 mt12" data-st="unlist" data-a="mutedAccounts" data-b="${esc(h)}">Unmute completely</button>`
    ].join(''));
  };

  DO.tgmute = (h, k, el) => {
    const all = P().all().mutedAccounts || {};
    const m = Object.assign({}, all[h]);
    m[k] = el.checked;
    P().listAdd('mutedAccounts', h, m);
    SET.repaint();
  };

  DO.unmutetopic = t => { if (window.DX && DX.unmute) DX.unmute(t); toast(t + ' unmuted'); SET.repaint(); };

  /* ── Content preferences ─────────────────────────────────────────── */

  reg('content', {
    t: 'Content preferences', i: 'tune', p: 'root',
    k: 'content preferences interested not interested sensitive topics suggested feed personalisation crypto finance gaming',
    html: () => {
      const dp = (window.DX && DX._ && DX._.P) || {};
      const topics = (window.DX && DX.TOPICS) || {};
      const personal = dp.personalized !== false;
      const skipped = Object.keys(dp.notInterested || {}).length;
      const mine = P().get('see.topics') || {};
      const KEYS = ['crypto', 'finance', 'tech', 'gaming', 'music', 'science', 'ent', 'sports', 'nature', 'education', 'life'];
      const nameOf = k => (topics[k] && topics[k][0]) || k.charAt(0).toUpperCase() + k.slice(1);
      return [
        `<p class="st-lead">What your feed and Discover put in front of you.</p>`,
        sec('Personalisation', [
          SET.sw('see.personalized', 'Personalised recommendations', 'Use what you watch, like, follow and search. Off shows what is popular and recent.',
            { icon: 'auto_awesome', value: personal, act: 'tgpersonal' }),
          SET.sw('see.suggested', 'Suggested posts', 'Accounts you do not follow, mixed into the feed', { icon: 'recommend' })
        ]),
        sec('Topics', [], 'Tell Trending to show more or less. This is separate from what it learns on its own.'),
        `<div class="st-topics">${KEYS.map(k => {
          const v = mine[k] || '';
          return `<div class="st-topic" data-label="${esc(nameOf(k))}">
            <b>${esc(nameOf(k))}</b>
            <span class="st-topic-b">
              <button type="button" class="st-tb${v === 'more' ? ' on' : ''}" data-st="topic" data-a="${k}" data-b="more" aria-label="More ${esc(nameOf(k))}">More</button>
              <button type="button" class="st-tb${v === 'less' ? ' off' : ''}" data-st="topic" data-a="${k}" data-b="less" aria-label="Less ${esc(nameOf(k))}">Less</button>
            </span>
          </div>`;
        }).join('')}</div>`,
        sec('Sensitive content', []),
        pick('see.sensitive', [
          ['less', 'Show less', 'Limit anything upsetting or graphic as far as possible'],
          ['standard', 'Standard', 'The default for most accounts'],
          ['more', 'Show more', 'Fewer limits — only for accounts over 18']
        ]),
        sec('What you have told us', [
          row({ icon: 'thumb_down', label: 'Not interested', value: skipped ? String(skipped) : 'Nothing yet',
            sub: 'Posts you have skipped', act: 'resetskipped', chev: !!skipped }),
          row({ icon: 'tune', label: 'Tune Discover', sub: 'Interests, muted topics and hidden accounts', act: 'tunediscover', chev: true }),
          row({ icon: 'restart_alt', label: 'Reset recommendations', act: 'resetdiscover', danger: true, chev: true })
        ])
      ].join('');
    }
  });

  DO.tgpersonal = (a, b, el) => {
    if (window.DX && DX.setPersonal) DX.setPersonal(el.checked);
    P().set('see.personalized', el.checked);
    toast(el.checked ? 'Recommendations are personalised' : 'Showing what is popular and recent');
    SET.repaint();
  };

  DO.topic = (k, v) => {
    const mine = Object.assign({}, P().get('see.topics') || {});
    if (mine[k] === v) delete mine[k]; else mine[k] = v;
    P().set('see.topics', mine);
    /* "Less" is also a mute in Discover, so the two agree. */
    if (window.DX && DX._ && DX._.P) {
      const dp = DX._.P;
      if (mine[k] === 'less') dp.muted[k] = 1; else delete dp.muted[k];
    }
    toast(!mine[k] ? 'No preference' : mine[k] === 'more' ? 'More of this' : 'Less of this');
    SET.repaint();
  };

  DO.resetskipped = async () => {
    if (!(await ask('Forget every post you marked “not interested”?', { ok: 'Forget', danger: true }))) return;
    if (window.DX && DX.resetSkipped) DX.resetSkipped();
    toast('Skipped posts forgotten');
    SET.repaint();
  };

  /* ── Like and share counts ───────────────────────────────────────── */

  reg('counts', {
    t: 'Like and share counts', i: 'favorite', p: 'root',
    k: 'like share counts hide numbers engagement views',
    html: () => [
      `<p class="st-lead">Hiding counts does not change them — it only changes whether you see them.</p>`,
      sec('Likes', []),
      pick('see.likeCounts', [
        ['show', 'Show all', ''],
        ['hideOthers', 'Hide on other people’s posts', 'You still see your own'],
        ['hideAll', 'Hide everywhere', 'Including your own']
      ]),
      sec('Shares and reposts', []),
      pick('see.shareCounts', [
        ['show', 'Show all', ''],
        ['hideOthers', 'Hide on other people’s posts', ''],
        ['hideAll', 'Hide everywhere', '']
      ])
    ].join('')
  });
}
