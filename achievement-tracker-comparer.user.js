// ==UserScript==
// @name        Achievement Tracker Comparer
// @namespace   https://github.com/RudeySH/achievement-tracker-comparer
// @version     0.5.0
// @author      Rudey
// @description Compare achievements between AStats, completionist.me, Steam Hunters and Steam Community profiles.
// @homepageURL https://github.com/RudeySH/achievement-tracker-comparer
// @supportURL  https://github.com/RudeySH/achievement-tracker-comparer/issues
// @match       https://steamcommunity.com/id/*
// @match       https://steamcommunity.com/profiles/*
// @grant       GM.xmlHttpRequest
// @connect     astats.nl
// @connect     completionist.me
// @connect     steamhunters.com
// @require     https://cdnjs.cloudflare.com/ajax/libs/es6-promise-pool/2.5.0/es6-promise-pool.min.js
// ==/UserScript==

'use strict';

// bypass GreaseMonkey's security model
const g_rgProfileData = unsafeWindow.g_rgProfileData;
const g_sessionID = unsafeWindow.g_sessionID;
const g_steamID = unsafeWindow.g_steamID;

const domParser = new DOMParser();

function getDocument(url) {
	return new Promise((resolve, reject) => {
		GM.xmlHttpRequest({
			method: 'GET',
			overrideMimeType: 'text/html',
			url,
			onabort: reject,
			onerror: reject,
			ontimeout: reject,
			onload: data => {
				resolve(domParser.parseFromString(data.responseText, 'text/html'));
			},
		});
	});
}

function getJSON(url) {
	return new Promise((resolve, reject) => {
		GM.xmlHttpRequest({
			method: 'GET',
			overrideMimeType: 'application/json',
			url,
			onabort: reject,
			onerror: reject,
			ontimeout: reject,
			onload: data => {
				resolve(JSON.parse(data.responseText));
			},
		});
	});
}

function delay(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

class Tracker {
	validate(_game) {
		return []; // can be implemented in sub-class
	}
}

class AStats extends Tracker {
	domain = 'astats.nl';
	name = 'AStats';

	getProfileURL() {
		return `https://astats.astats.nl/astats/User_Info.php?steamID64=${g_rgProfileData.steamid}&utm_campaign=userscript`;
	}

	getGameURL(appid) {
		return `https://astats.astats.nl/astats/Steam_Game_Info.php?AppID=${appid}&SteamID64=${g_rgProfileData.steamid}&utm_campaign=userscript`;
	}

	async getStartedGames() {
		const startedGames = [];
		const document = await getDocument(`https://astats.astats.nl/astats/User_Games.php?SteamID64=${g_rgProfileData.steamid}&AchievementsOnly=1&Limit=0&utm_campaign=userscript`);
		const rows = document.querySelectorAll('table:not(.Pager) tbody tr');

		for (const row of rows) {
			const validUnlocked = parseInt(row.cells[2].textContent);
			const unlocked = validUnlocked + (parseInt(row.cells[3].textContent) || 0);

			if (unlocked <= 0) {
				continue;
			}

			const total = parseInt(row.cells[4].textContent);

			if (total <= 0) {
				continue;
			}

			const appid = parseInt(new URLSearchParams(row.querySelector('a[href*="AppID="]').href).get('AppID'));
			const name = row.cells[1].textContent;
			const validTotal = row.cells[4].textContent.split(' - ').map(x => parseInt(x)).reduce((a, b) => a - b);
			const isPerfect = unlocked >= total;
			const isCompleted = isPerfect || validUnlocked > 0 && validUnlocked >= validTotal;
			const isCounted = isCompleted;

			startedGames.push({ appid, name, unlocked, total, isPerfect, isCompleted, isCounted });
		}

		return startedGames;
	}
}

class Completionist extends Tracker {
	domain = 'completionist.me';
	name = 'completionist.me';

	getProfileURL() {
		return `https://completionist.me/steam/profile/${g_rgProfileData.steamid}?utm_campaign=userscript`;
	}

	getGameURL(appid) {
		return `https://completionist.me/steam/profile/${g_rgProfileData.steamid}/app/${appid}?utm_campaign=userscript`;
	}

	async getStartedGames() {
		const startedGames = [];

		const url = `https://completionist.me/steam/profile/${g_rgProfileData.steamid}/apps?display=flat&sort=started&order=asc&completion=started&utm_campaign=userscript`;
		const document = await this.addStartedGames(startedGames, url);
		const pagination = document.querySelector('.pagination a:last-of-type');

		if (pagination !== null) {
			const pageCount = parseInt(new URLSearchParams(pagination.href).get('page'));
			const iterator = this.getStartedGamesIterator(startedGames, url, pageCount);
			const pool = new PromisePool(iterator, 6);	
			await pool.start();
		}

		return startedGames;
	}

	* getStartedGamesIterator(startedGames, url, pageCount) {
		for (var page = 2; page <= pageCount; page++) {
			yield this.addStartedGames(startedGames, `${url}&page=${page}`);
		}
	}

	async addStartedGames(startedGames, url) {
		const document = await getDocument(url);
		const rows = document.querySelectorAll('.games-list tbody tr');

		for (const row of rows) {
			const nameCell = row.cells[1];
			const anchor = nameCell.querySelector('a');
			const counts = row.cells[4].textContent.split('/').map(s => parseInt(s.trim().replace(/,/g, '')));
			const unlocked = counts[0];
			const total = counts[1] ?? unlocked;
			const isPerfect = unlocked >= total;

			startedGames.push({
				appid: parseInt(anchor.href.substr(anchor.href.lastIndexOf('/') + 1)),
				name: nameCell.textContent.trim(),
				unlocked,
				total,
				isPerfect,
				isCompleted: isPerfect ? true : undefined,
				isCounted: isPerfect,
				isTrusted: nameCell.querySelector('.fa-spinner') === null,
			});
		}

		return document;
	}
}

class SteamHunters extends Tracker {
	domain = 'steamhunters.com';
	name = 'Steam Hunters';

	getProfileURL() {
		return `https://steamhunters.com/profiles/${g_rgProfileData.steamid}?utm_campaign=userscript`;
	}

	getGameURL(appid) {
		return `https://steamhunters.com/profiles/${g_rgProfileData.steamid}/stats/${appid}?utm_campaign=userscript`;
	}

	async getStartedGames() {
		const licenses = await getJSON(`https://steamhunters.com/api/steam-users/${g_rgProfileData.steamid}/licenses?state=started&utm_campaign=userscript`);

		return Object.entries(licenses).map(([appid, license]) => ({
			appid: parseInt(appid),
			name: license.app.name,
			unlocked: license.achievementUnlockCount,
			total: license.app.achievementCount,
			isPerfect: license.achievementUnlockCount >= license.app.achievementCount,
			isCompleted: license.isCompleted,
			isCounted: license.isCompleted && !license.isInvalidated,
			isTrusted: !license.app.isRestricted,
		}));
	}
}

class Steam extends Tracker {
	domain = 'steamcommunity.com';
	name = 'Steam';

	getProfileURL() {
		return g_rgProfileData.url;
	}

	getGameURL(appid) {
		return `https://steamcommunity.com/profiles/${g_rgProfileData.steamid}/stats/${appid}?tab=achievements`;
	}

	async getStartedGames(appids) {
		const document = await getDocument(`${g_rgProfileData.url}edit/showcases`);
		const achievementShowcaseGames = JSON.parse(document.getElementById('showcase_preview_17').innerHTML.match(/g_rgAchievementShowcaseGamesWithAchievements = (.*);/)[1]);
		const completionistShowcaseGames = JSON.parse(document.getElementById('showcase_preview_23').innerHTML.match(/g_rgAchievementsCompletionshipShowcasePerfectGames = (.*);/)[1]);

		appids = [...new Set([
			...appids,
			...achievementShowcaseGames.map(game => game.appid),
			...completionistShowcaseGames.map(game => game.appid),
		])];

		const startedGames = [];
		const iterator = this.getStartedGamesIterator(appids, achievementShowcaseGames, completionistShowcaseGames, startedGames);
		const pool = new PromisePool(iterator, 6);

		await pool.start();

		return startedGames;
	}

	* getStartedGamesIterator(appids, achievementShowcaseGames, completionistShowcaseGames, startedGames) {
		for (const appid of appids) {
			yield this.getGame(appid, achievementShowcaseGames, completionistShowcaseGames).then(game => startedGames.push(game));
		}
	}

	async getGame(appid, achievementShowcaseGames, completionistShowcaseGames) {
		if (appid === 247750) {
			const name = 'The Stanley Parable Demo';
			const unlocked = await this.getAchievementShowcaseCount(appid);
			const isPerfect = unlocked === 1;
			return { appid, name, unlocked, total: 1, isPerfect, isCompleted: isPerfect, isCounted: isPerfect, isTrusted: true };
		}

		const completionistShowcaseGame = completionistShowcaseGames.find(game => game.appid === appid);
		let { unlocked, total } = await this.getFavoriteGameShowcaseCounts(appid);
		total ??= completionistShowcaseGame?.num_achievements;

		if (unlocked === undefined) {
			unlocked = await this.getAchievementShowcaseCount(appid);

			if (unlocked === 9999 && completionistShowcaseGame !== undefined) {
				unlocked = completionistShowcaseGame.num_achievements;
			}
		}

		const achievementShowcaseGame = achievementShowcaseGames.find(game => game.appid === appid);
		const name = achievementShowcaseGame?.name ?? completionistShowcaseGame?.name;
		const isPerfect = total !== undefined ? unlocked >= total : undefined;
		const isCompleted = isPerfect ? true : undefined;
		const isCounted = completionistShowcaseGame !== undefined;
		const isTrusted = achievementShowcaseGame !== undefined;

		return { appid, name, unlocked, total, isPerfect, isCompleted, isCounted, isTrusted };
	}

	async getFavoriteGameShowcaseCounts(appid) {
		const url = `${g_rgProfileData.url}ajaxpreviewshowcase`;

		const body = new FormData();
		body.append('customization_type', '6');
		body.append('sessionid', g_sessionID);
		body.append('slot_data', `{"0":{"appid":${appid}}}`);

		const attempts = 3;
		for (let attempt = 1; attempt <= attempts; attempt++) {
			try {
				const response = await fetch(url, { method: 'POST', body, credentials: 'same-origin' });
				const text = await response.text();

				const template = document.createElement('template');
				template.innerHTML = text.replace(/src="[^"]+"/g, '');

				const ellipsis = template.content.querySelector('.ellipsis');

				let unlocked = undefined;
				let total = undefined;

				if (ellipsis !== null) {
					const split = ellipsis.textContent.split(/\D+/).filter(s => s !== '');
					unlocked = parseInt(split[0]);
					total = parseInt(split[1]);
				}

				return { unlocked, total };
			} catch (error) {
				if (attempt >= attempts) {
					throw error;
				}

				await delay(1000 * attempt);
			}
		}
	}

	async getAchievementShowcaseCount(appid) {
		const url = `${g_rgProfileData.url}ajaxgetachievementsforgame/${appid}`;

		const attempts = 3;
		for (let attempt = 1; attempt <= attempts; attempt++) {
			try {
				const response = await fetch(url);
				const text = await response.text();

				const template = document.createElement('template');
				template.innerHTML = text;

				const list = template.content.querySelector('.achievement_list');

				if (list === null) {
					const h3 = template.content.querySelector('h3');
					throw new Error(h3?.textContent ?? `Response is invalid: ${url}`);
				}

				return list.querySelectorAll('.achievement_list_item').length;
			} catch (error) {
				if (attempt >= attempts) {
					throw error;
				}

				await delay(1000 * attempt);
			}
		}
	}

	validate(game) {
		const messages = [];

		if (game.isCounted === true) {
			if (game.isPerfect === false) {
				messages.push(`counted but not perfect on Steam`);
			}
			if (game.isTrusted === false) {
				messages.push(`counted but not trusted on Steam`);
			}
		} else {
			if (game.isPerfect === true && game.isTrusted === true) {
				messages.push(`perfect & trusted but not counted on Steam`);
			}
		}

		return messages;
	}
}

const trackers = [new AStats(), new Completionist(), new SteamHunters()];
const isOwnProfile = g_rgProfileData.steamid === g_steamID;

async function findDifferences(trackerNames, output) {
	output.innerHTML = '';

	let results = await Promise.all(trackers
		.filter(tracker => trackerNames.includes(tracker.name))
		.map(async tracker => ({ tracker, games: await tracker.getStartedGames() })));

	if (trackerNames.includes('Steam')) {
		const appids = new Set();
		results.forEach(result => result.games.forEach(game => appids.add(game.appid)));

		const tracker = new Steam();
		results.push({ tracker, games: await tracker.getStartedGames([...appids]) });
	}

	results = results.filter(result => result.games.length !== 0);

	if (results.length < 2) {
		return;
	}

	output.innerHTML = `
		<div class="profile_comment_area">
			${results.filter(result => result.tracker.name !== 'Steam').map(result => {
				const appids = [...new Set(results
					.filter(r => r.tracker !== result)
					.flatMap(r => r.games.map(g => g.appid))
					.filter(appid => !result.games.some(g => g.appid === appid)))];
				return `
					<p>
						Missing achievements on ${result.tracker.name}:
					</p>
					<div class="commentthread_entry_quotebox">
						<textarea class="commentthread_textarea" readonly>${appids}</textarea>
					</div>
				`;
			}).join('')}
		</div>`;

	for (let sourceIndex = 0; sourceIndex < results.length; sourceIndex++) {
		const source = results[sourceIndex];

		const validationErrors = [];

		for (const game of source.games) {
			const messages = source.tracker.validate(game);

			if (messages.length !== 0) {
				validationErrors.push({ name: game.name ?? `Unknown App ${game.appid}`, messages: messages.join(', ') });
			}
		}

		// TODO: display validation errors on screen instead of logging to console
		if (validationErrors.length !== 0) {
			console.log(`Validation errors on ${source.tracker.name}:`);
			console.table(validationErrors);
		}

		for (let targetIndex = sourceIndex + 1; targetIndex < results.length; targetIndex++) {
			const target = results[targetIndex];

			// join games from both trackers into map
			const gamesMap = new Map();

			for (const game of source.games) {
				gamesMap.set(game.appid, { source: game });
			}

			for (const game of target.games) {
				let value = gamesMap.get(game.appid);

				if (value === undefined) {
					value = {};
					gamesMap.set(game.appid, value);
				}

				value.target = game;
			}

			// convert map into array
			const games = [...gamesMap].map(([appid, game]) => {
				game.appid = appid;
				game.name = game.source?.name ?? game.target?.name ?? `Unknown App ${appid}`;
				return game;
			});

			const differences = [];

			for (const game of games) {
				const messages = [];

				if (game.source === undefined) {
					messages.push(`missing on ${source.tracker.name}`);
				} else if (game.target === undefined) {
					messages.push(`missing on ${target.tracker.name}`);
				} else {
					if (game.source.unlocked > game.target.unlocked) {
						messages.push(`+${game.source.unlocked - game.target.unlocked} unlocked on ${source.tracker.name}`);
					} else if (game.target.unlocked > game.source.unlocked) {
						messages.push(`+${game.target.unlocked - game.source.unlocked} unlocked on ${target.tracker.name}`);
					} else if (game.source.isPerfect === true && game.target.isPerfect === false) {
						messages.push(`perfect on ${source.tracker.name} but not on ${target.tracker.name}`);
					} else if (game.target.isPerfect === true && game.source.isPerfect === false) {
						messages.push(`perfect on ${target.tracker.name} but not on ${source.tracker.name}`);
					} else if (game.source.isCompleted === true && game.target.isCompleted === false) {
						messages.push(`completed on ${source.tracker.name} but not on ${target.tracker.name}`);
					} else if (game.target.isCompleted === true && game.source.isCompleted === false) {
						messages.push(`completed on ${target.tracker.name} but not on ${source.tracker.name}`);
					} else if (game.source.isCounted === true && game.target.isCounted === false) {
						messages.push(`counts on ${source.tracker.name} but not on ${target.tracker.name}`);
					} else if (game.target.isCounted === true && game.source.isCounted === false) {
						messages.push(`counts on ${target.tracker.name} but not on ${source.tracker.name}`);
					}

					if (game.source.isTrusted === true && game.target.isTrusted === false) {
						messages.push(`trusted on ${source.tracker.name} but not on ${target.tracker.name}`);
					} else if (game.target.isTrusted === true && game.source.isTrusted === false) {
						messages.push(`trusted on ${target.tracker.name} but not on ${source.tracker.name}`);
					}
				}

				if (messages.length !== 0) {
					differences.push({
						appid: game.appid,
						name: game.name,
						messages: messages.join('; '),
						sourceURL: source.tracker.getGameURL(game.appid),
						targetURL: target.tracker.getGameURL(game.appid),
					});
				}
			}

			// TODO: display differences on screen instead of logging to console

			if (differences.length === 0) {
				console.log(`No differences between ${source.tracker.name} and ${target.tracker.name}.`);
				return;
			}

			differences.sort((a, b) => a.appid - b.appid);

			console.log(`Differences between ${source.tracker.name} and ${target.tracker.name}:`);
			console.table(differences);

			const csv = `App ID,Name,Differences,${source.tracker.name} URL,${target.tracker.name} URL\n`
				+ differences.map(d => `${d.appid},${escapeCSV(d.name)},${d.messages},${d.sourceURL},${d.targetURL}`).join('\n');

			console.log(csv);

			if (document.hasFocus()) {
				try {
					await navigator.clipboard.writeText(csv);
					console.log('Copied to clipboard!');
				} catch (error) {
					console.error(error);
				}
			}
		}
	}
}

function escapeCSV(string) {
	if (string.indexOf('"') !== -1) {
		return `"${string.replace(/"/g, '""')}"`;
	} else if (string.indexOf(',') !== -1) {
		return `"${string}"`;
	}

	return string;
}

window.addEventListener('load', () => {
	const container = document.querySelector('.profile_rightcol');

	if (container === null) {
		return;
	}

	const style = document.createElement('style');
	style.innerHTML = `
		.atc button {
			border: none;
		}

		.atc button:disabled {
			pointer-events: none;
		}

		.atc input[type="checkbox"] {
			vertical-align: top;
		}

		.atc textarea {
			font-size: inherit;
			overflow-y: scroll;
		}

		.atc .profile_comment_area {
			margin-top: 0;
		}

		.atc .whiteLink {
			float: right;
		}`;

	document.head.appendChild(style);

	const template = document.createElement('template');
	template.innerHTML = `
		<form class="atc">
			<div class="profile_item_links">
				<div class="profile_count_link ellipsis">
					<a>
						<span class="count_link_label">Trackers</span>&nbsp;
						<span class="profile_count_link_total">${trackers.length}</span>
					</a>
				</div>
				${trackers.map(tracker =>
					`<div>
						<label>
							<input type="checkbox" name="trackerName" value="${tracker.name}" />
							${tracker.name}
						</label>
						<a class="whiteLink" target="_blank" href="${tracker.getProfileURL()}">${tracker.domain}</a>
					</div>`).join('')}
				<p ${isOwnProfile ? '' : 'hidden'}>
					<label>
						<input type="checkbox" name="trackerName" value="Steam" />
						Steam profile showcases (slow)
					</label>
				</p>
				<p>
					<button type="button" class="btn_profile_action btn_medium" id="atc_btn" disabled>
						<span>Find Differences</span>
					</button>
					<span id="atc_counter">0</span>
					selected
				</p>
				<div id="atc_output"></div>
			</div>
		</form>`;

	const form = document.importNode(template.content, true).firstElementChild;

	const button = form.querySelector('#atc_btn');
	const buttonSpan = button.querySelector('span');
	const counter = form.querySelector('#atc_counter');
	const output = form.querySelector('#atc_output');

	form.addEventListener('change', () => {
		const formData = new FormData(form);
		const trackerNames = formData.getAll('trackerName');
		button.disabled = trackerNames.length < 2;
		counter.textContent = trackerNames.length;
	});

	button.addEventListener('click', async () => {
		button.disabled = true;
		buttonSpan.textContent = 'Loading...';

		const formData = new FormData(form);
		const trackerNames = formData.getAll('trackerName');

		try {
			await findDifferences(trackerNames, output);
		} catch (reason) {
			console.error(reason);
		}

		buttonSpan.textContent = 'Find Differences';
		button.disabled = false;
	});

	container.appendChild(form);
});
