/* Kissa — owner's analytics page (website/downloads.html).
 *
 * Part 1 — website analytics from the Kissa API (GET /api/stats): anonymous
 * daily counts of visitors, new visitors and Download-button clicks.
 *
 * Part 2 — GitHub APK downloads:
 * Adds up the GitHub download count of every Kissa APK ever released
 * (every version, every release). Public GitHub numbers only: no backend,
 * no token, no user data. GitHub counts each APK download (website button,
 * in-app update or the releases page); it cannot tell people apart, so the
 * owner's own test downloads are included too.
 */
(function () {
  'use strict';
  var API = 'https://api.github.com/repos/pushparaj9749/ankitstorychat/releases?per_page=100&page=';

  /** releases (GitHub API objects) → { total, versions: [{ tag, date, downloads }] }, newest first. */
  function summarize(releases) {
    var versions = [];
    var total = 0;
    (releases || []).forEach(function (rel) {
      if (!rel || rel.draft) return;
      var n = 0;
      var hasApk = false;
      (rel.assets || []).forEach(function (a) {
        if (a && /\.apk$/i.test(a.name || '')) {
          hasApk = true;
          n += Number(a.download_count) || 0;
        }
      });
      if (!hasApk) return;
      total += n;
      versions.push({ tag: rel.tag_name, date: rel.published_at || rel.created_at || '', downloads: n });
    });
    versions.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    return { total: total, versions: versions };
  }

  /** Where the stats API lives for a given page host. */
  function statsUrl(hostname) {
    var base = /(^|\.)beyondredeye\.site$/.test(hostname || '') ? '' : 'https://beyondredeye.site';
    return base + '/api/stats?days=14';
  }

  /** Number with Indian grouping; "+" when the day hit the counting limit. */
  function fmtCount(n, capped) {
    return (Number(n) || 0).toLocaleString('en-IN') + (capped ? '+' : '');
  }

  /** A totals block → HTML lines (numbers only). */
  function totalsHtml(t) {
    t = t || {};
    return '<div class="an-line"><span>Visitors</span><b>' + fmtCount(t.visitors, t.capped) + '</b></div>' +
      '<div class="an-line"><span>Naye visitors</span><b>' + fmtCount(t.newVisitors, t.capped) + '</b></div>' +
      '<div class="an-line dl"><span>Download</span><b>' + fmtCount(t.downloads, t.capped) + '</b></div>';
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { summarize: summarize, statsUrl: statsUrl, fmtCount: fmtCount, totalsHtml: totalsHtml };
    return;
  }

  function el(id) { return document.getElementById(id); }
  function fmtDate(iso) {
    if (!iso) return '-';
    var d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fetchAll(page, acc) {
    return fetch(API + page, { headers: { Accept: 'application/vnd.github+json' } }).then(function (r) {
      if (r.status === 403 || r.status === 429) throw new Error('limit');
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(function (list) {
      acc = acc.concat(list);
      return list.length === 100 && page < 20 ? fetchAll(page + 1, acc) : acc;
    });
  }

  function render(sum) {
    el('total').textContent = sum.total.toLocaleString('en-IN');
    var latest = sum.versions[0];
    el('latest').textContent = latest ? latest.tag + ': ' + latest.downloads.toLocaleString('en-IN') + ' downloads' : '-';
    el('count').textContent = sum.versions.length + ' versions';
    var rows = sum.versions.map(function (v) {
      return '<tr><td>' + v.tag + '</td><td>' + fmtDate(v.date) + '</td><td class="num">' +
        v.downloads.toLocaleString('en-IN') + '</td></tr>';
    }).join('');
    el('rows').innerHTML = rows;
    el('updated').textContent = 'Abhi update hua: ' + new Date().toLocaleString('en-IN');
  }

  function fmtDay(day) {
    var d = new Date(day + 'T00:00:00Z');
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  }

  function renderStats(s) {
    el('anToday').innerHTML = totalsHtml(s.today);
    el('an7').innerHTML = totalsHtml(s.last7);
    el('an30').innerHTML = totalsHtml(s.last30);
    el('anAll').innerHTML = totalsHtml(s.allTime);
    el('anRows').innerHTML = (s.days || []).map(function (r) {
      return '<tr><td>' + fmtDay(r.date) + '</td><td class="num">' + fmtCount(r.visitors, r.capped) +
        '</td><td class="num">' + fmtCount(r.newVisitors, r.capped) + '</td><td class="num">' +
        fmtCount(r.downloads, r.capped) + '</td></tr>';
    }).join('');
    el('anStatus').textContent = s.since ? 'Ginti shuru: ' + fmtDay(s.since) : 'Abhi tak koi visitor nahi gina gaya.';
  }

  function loadStats() {
    el('anStatus').textContent = 'Gin raha hoon...';
    return fetch(statsUrl(location.hostname), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(renderStats).catch(function () {
      el('anStatus').textContent = 'Website ki ginti abhi nahi mili. Thodi der baad Refresh karo.';
    });
  }

  function load() {
    loadStats();
    el('status').textContent = 'Gin raha hoon...';
    el('refresh').disabled = true;
    fetchAll(1, []).then(function (all) {
      render(summarize(all));
      el('status').textContent = '';
    }).catch(function (e) {
      el('status').textContent = e && e.message === 'limit'
        ? 'GitHub ki limit (ek ghante mein 60 baar) poori ho gayi. Thodi der baad Refresh karo.'
        : 'Internet ya GitHub se jawab nahi aaya. Refresh karo.';
    }).then(function () { el('refresh').disabled = false; });
  }

  el('refresh').addEventListener('click', load);
  load();
})();
