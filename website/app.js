/* Kissa website: latest-APK button + live story list from the repo. No backend. */
(function () {
  'use strict';
  var OWNER = 'pushparaj9749';
  var REPO = 'ankitstorychat';
  var RAW = 'https://raw.githubusercontent.com/' + OWNER + '/' + REPO + '/main';
  var RELEASES_PAGE = 'https://github.com/' + OWNER + '/' + REPO + '/releases/latest';

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

  // 2) Live story list from content/manifest.json.
  var grid = document.getElementById('storyGrid');
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  fetch(RAW + '/content/manifest.json')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (m) {
      if (!m || !m.stories || !m.stories.length) throw new Error('empty');
      grid.innerHTML = '';
      m.stories.forEach(function (s) {
        var cover = s.coverUrl || (s.coverBundled ? RAW + '/assets/covers/' + s.coverBundled + '.jpg' : '');
        var card = document.createElement('div');
        card.className = 'story-card';
        card.innerHTML =
          (cover ? '<img loading="lazy" src="' + esc(cover) + '" alt="' + esc(s.title) + ' cover" />' : '') +
          '<div class="story-body"><h3>' + esc(s.title) + '</h3>' +
          '<p class="story-tag">' + esc(s.tagline || '') + '</p>' +
          '<div class="story-meta">' +
          '<span class="badge ' + (s.contentLevel === 'mature' ? 'mature' : 'teen') + '">' + esc(s.ageRating) + '</span>' +
          '<span class="badge genre">' + esc((s.genres || [])[0] || 'Story') + '</span>' +
          '</div></div>';
        grid.appendChild(card);
      });
    })
    .catch(function () {
      grid.innerHTML = '<p class="loading">Stories could not be loaded (offline?). The app ships 6 stories built-in.</p>';
    });
})();
