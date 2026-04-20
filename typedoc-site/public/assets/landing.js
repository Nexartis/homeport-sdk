// Nexartis NANDA Node SDK — landing page enhancements
// Small, dependency-free: install-command tab switcher + copy-to-clipboard.
(function () {
	'use strict';

	var PKG = '@nexartis/nexartis-nanda-node-sdk';
	var COMMANDS = {
		pnpm: 'pnpm add ' + PKG,
		npm: 'npm install ' + PKG,
		yarn: 'yarn add ' + PKG,
		bun: 'bun add ' + PKG
	};

	function initInstallTabs() {
		var tabs = document.querySelectorAll('.install-tab');
		var cmdEl = document.getElementById('install-cmd');
		if (!tabs.length || !cmdEl) return;

		tabs.forEach(function (tab) {
			tab.addEventListener('click', function () {
				var pkg = tab.getAttribute('data-pkg');
				if (!pkg || !COMMANDS[pkg]) return;
				tabs.forEach(function (t) {
					t.classList.remove('is-active');
					t.setAttribute('aria-selected', 'false');
				});
				tab.classList.add('is-active');
				tab.setAttribute('aria-selected', 'true');
				cmdEl.textContent = COMMANDS[pkg];
			});
		});
	}

	function initCopyButtons() {
		var buttons = document.querySelectorAll('.copy-btn');
		buttons.forEach(function (btn) {
			btn.addEventListener('click', function () {
				var targetId = btn.getAttribute('data-target');
				var target = targetId ? document.getElementById(targetId) : null;
				if (!target) return;
				var text = target.textContent || '';
				var done = function () {
					var original = btn.textContent;
					btn.textContent = 'Copied';
					btn.classList.add('is-copied');
					setTimeout(function () {
						btn.textContent = original;
						btn.classList.remove('is-copied');
					}, 1500);
				};
				if (navigator.clipboard && navigator.clipboard.writeText) {
					navigator.clipboard.writeText(text).then(done, function () {
						legacyCopy(text);
						done();
					});
				} else {
					legacyCopy(text);
					done();
				}
			});
		});
	}

	function legacyCopy(text) {
		var ta = document.createElement('textarea');
		ta.value = text;
		ta.style.position = 'fixed';
		ta.style.opacity = '0';
		document.body.appendChild(ta);
		ta.select();
		try { document.execCommand('copy'); } catch (_) {}
		document.body.removeChild(ta);
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', function () {
			initInstallTabs();
			initCopyButtons();
		});
	} else {
		initInstallTabs();
		initCopyButtons();
	}
})();
