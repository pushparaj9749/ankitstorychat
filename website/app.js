/* Kissa website: latest-APK button + live story list from the Kissa story API,
 * plus an anonymous visit / download-click counter for the owner.
 * No user data — the counter sends no id, cookie or personal info. */
(function () {
  'use strict';
  var OWNER = 'pushparaj9749';
  var REPO = 'ankitstorychat';
  var RELEASES_PAGE = 'https://github.com/' + OWNER + '/' + REPO + '/releases/latest';

  // Story content lives behind the Kissa story API (Cloudflare Worker) — the
  // GitHub repository is never read for content. Try same-origin first (when
  // the site is served from beyondredeye.site), then the absolute API, then —
  // transitional fallback while DNS/Cloudflare is being set up — the legacy
  // public raw files. No credentials are ever used here.
  var API_BASES = [];
  if (location.origin && location.origin.indexOf('http') === 0) {
    API_BASES.push(location.origin + '/api');
  }
  API_BASES.push('https://beyondredeye.site/api');
  var LEGACY_RAW = 'https://raw.githubusercontent.com/' + OWNER + '/' + REPO + '/main';

  function setDownloads(apkUrl, label) {
    ['heroDownload', 'navDownload', 'bottomDownload'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && apkUrl) el.href = apkUrl;
    });
    var note = document.getElementById('dlNote');
    if (note && label) note.textContent = label;
    var note2 = document.getElementById('dlNote2');
    if (note2 && label) note2.textContent = label;
  }

  // 1) Point DOWNLOAD buttons at the latest APK asset (fallback: releases page).
  fetch('https://api.github.com/repos/' + OWNER + '/' + REPO + '/releases/latest')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (rel) {
      if (!rel || !rel.assets) throw new Error('no release');
      var apk = rel.assets.find(function (a) { return /\.apk$/i.test(a.name); });
      if (apk) {
        var mb = (apk.size / 1048576).toFixed(1);
        setDownloads(apk.browser_download_url, 'Android 8.0+ • Free forever • ' + rel.tag_name + ' • ' + mb + ' MB');
      } else {
        setDownloads(RELEASES_PAGE, 'Android 8.0+ • Free forever • See releases page');
      }
    })
    .catch(function () {
      setDownloads(RELEASES_PAGE, 'Android 8.0+ • Free forever • See releases page');
    });

  // 2) Live story list from the story API.
  var grid = document.getElementById('storyGrid');
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // The website has no player name — never show raw placeholders.
  function clean(s) {
    return esc(String(s == null ? '' : s).replace(/\{\{\s*playerName\s*\}\}/g, 'you'));
  }

  function fetchManifest(bases) {
    if (!bases.length) return Promise.reject(new Error('no api base left'));
    var base = bases[0];
    return fetch(base + '/manifest')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (m) {
        if (!m || !m.stories || !m.stories.length) throw new Error('empty');
        return { manifest: m, base: base };
      })
      .catch(function () {
        return fetchManifest(bases.slice(1));
      });
  }

  function coverFor(s, base, isApi) {
    if (s.coverUrl) {
      if (/^https?:\/\//.test(s.coverUrl)) return s.coverUrl; // legacy absolute URL
      return isApi ? base + '/' + s.coverUrl : base + '/content/' + s.coverUrl;
    }
    if (s.coverBundled) {
      return isApi
        ? base + '/covers/' + s.coverBundled + '.jpg'
        : base + '/assets/covers/' + s.coverBundled + '.jpg';
    }
    return '';
  }

  fetchManifest(API_BASES)
    .then(function (res) {
      var m = res.manifest;
      var base = res.base;
      // Relative cover paths resolve against the API that served the
      // manifest; the legacy raw fallback serves repo-relative paths.
      var isApi = base.indexOf('/api') !== -1;
      grid.innerHTML = '';
      m.stories.forEach(function (s) {
        var cover = coverFor(s, base, isApi);
        var card = document.createElement('div');
        card.className = 'story-card';
        card.innerHTML =
          (cover ? '<img loading="lazy" src="' + esc(cover) + '" alt="' + esc(s.title) + ' cover" />' : '') +
          '<div class="story-body"><h3>' + clean(s.title) + '</h3>' +
          '<p class="story-tag">' + clean(s.tagline) + '</p>' +
          '<div class="story-meta">' +
          '<span class="badge ' + (s.contentLevel === 'mature' ? 'mature' : 'teen') + '">' + esc(s.ageRating) + '</span>' +
          '<span class="badge genre">' + clean((s.genres || [])[0] || 'Story') + '</span>' +
          '</div></div>';
        grid.appendChild(card);
      });
    })
    .catch(function () {
      grid.innerHTML = '<p class="loading">Stories could not be loaded (no internet?). New stories arrive over-the-air from the live story API — no app update needed.</p>';
    });

  // 3) Anonymous site analytics (owner's downloads.html page). Each browser
  //    reports at most one "visit" and one "download" per day (India date);
  //    the day marker stays in this browser's own localStorage. Nothing that
  //    identifies a person is sent — just {"e":"visit"} or {"e":"download"}.
  var host = location.hostname || '';
  var STATS_ON = location.protocol.indexOf('http') === 0 && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(host);
  var STATS_URL = /(^|\.)beyondredeye\.site$/.test(host) ? '/api/stats/hit' : 'https://beyondredeye.site/api/stats/hit';

  function istDay() {
    return new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
  }
  function sendStat(event, isNew) {
    var body = JSON.stringify(isNew ? { e: event, n: true } : { e: event });
    try {
      if (navigator.sendBeacon && navigator.sendBeacon(STATS_URL, new Blob([body], { type: 'text/plain' }))) return;
    } catch (e) { /* fall through */ }
    try {
      fetch(STATS_URL, { method: 'POST', body: body, keepalive: true, mode: 'cors', credentials: 'omit', headers: { 'Content-Type': 'text/plain' } }).catch(function () {});
    } catch (e) { /* ignore */ }
  }
  /** Report `event` once per browser per day; returns false when storage is unavailable. */
  function oncePerDay(key, event, markNew) {
    try {
      var today = istDay();
      var last = localStorage.getItem(key);
      if (last === today) return;
      localStorage.setItem(key, today);
      sendStat(event, markNew && !last);
    } catch (e) { /* storage blocked: skip rather than over-count */ }
  }

  if (STATS_ON) {
    oncePerDay('kissa_v', 'visit', true);
    ['heroDownload', 'navDownload', 'bottomDownload'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', function () { oncePerDay('kissa_d', 'download', false); });
    });
  }
})();
