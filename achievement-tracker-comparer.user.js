// ==UserScript==
// @name        Achievement Tracker Comparer
// @namespace   https://github.com/RudeySH/achievement-tracker-comparer
// @version     0.2.0
// @author      Rudey
// @description Compare achievements between AStats, completionist.me, Steam Hunters and Steam Community profiles.
// @homepageURL https://github.com/RudeySH/achievement-tracker-comparer
// @supportURL  https://github.com/RudeySH/achievement-tracker-comparer/issues
// @match       https://steamcommunity.com/id/*
// @match       https://steamcommunity.com/profiles/*
// @grant       GM_xmlhttpRequest
// @connect     astats.nl
// @connect     steamhunters.com
// ==/UserScript==

'use strict';

const domParser = new DOMParser();

function getDocument(url) {
	return new Promise((resolve, reject) => {
		GM_xmlhttpRequest({
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
		GM_xmlhttpRequest({
			url,
			responseType: 'json',
			onabort: reject,
			onerror: reject,
			ontimeout: reject,
			onload: data => {
				resolve(data.response);
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
	name = 'AStats';

	async getStartedGames() {
		const document = await getDocument(`https://astats.astats.nl/astats/User_Games.php?SteamID64=${g_rgProfileData.steamid}&AchievementsOnly=1&Limit=0`);
		const table = document.querySelector('table:not(.Pager)');
		const startedGames = [];

		for (const row of table.tBodies[0].rows) {
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
	name = 'completionist.me';

	async getStartedGames() {
		return []; // TODO: scrape completionist.me
	}
}

class SteamHunters extends Tracker {
	name = 'Steam Hunters';

	async getStartedGames() {
		const licenses = await getJSON(`https://steamhunters.com/api/steam-users/${g_rgProfileData.steamid}/licenses?state=started`);

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
	name = 'Steam';

	async getStartedGames(appids) {
		appids = [...new Set([
			...appids,
			...g_rgAchievementShowcaseGamesWithAchievements.map(game => game.appid),
			...g_rgAchievementsCompletionshipShowcasePerfectGames.map(game => game.appid),
		])];

		const startedGames = [];

		for (const appid of appids) {
			if (appid === 247750) {
				const name = 'The Stanley Parable Demo';
				const unlocked = await this.getAchievementShowcaseCount(appid);
				const isPerfect = unlocked === 1;
				startedGames.push({ appid, name, unlocked, total: 1, isPerfect, isCompleted: isPerfect, isCounted: isPerfect, isTrusted: true });
				continue;
			}

			const completionistShowcaseGame = g_rgAchievementsCompletionshipShowcasePerfectGames.find(game => game.appid === appid);
			let { unlocked, total } = await this.getFavoriteGameShowcaseCounts(appid);
			total ??= completionistShowcaseGame?.num_achievements;

			if (unlocked === undefined) {
				unlocked = await this.getAchievementShowcaseCount(appid);

				if (unlocked === 9999 && completionistShowcaseGame !== undefined) {
					unlocked = completionistShowcaseGame.num_achievements;
				}
			}

			const achievementShowcaseGame = g_rgAchievementShowcaseGamesWithAchievements.find(game => game.appid === appid);
			const name = achievementShowcaseGame?.name ?? completionistShowcaseGame?.name;
			const isPerfect = total !== undefined ? unlocked >= total : undefined;
			const isCompleted = isPerfect ? isCompleted : undefined;
			const isCounted = completionistShowcaseGame !== undefined;
			const isTrusted = achievementShowcaseGame !== undefined;

			startedGames.push({ appid, name, unlocked, total, isPerfect, isCompleted, isCounted, isTrusted });
		}

		return startedGames;
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
const isEditProfile = unsafeWindow.g_rgAchievementsCompletionshipShowcasePerfectGames !== undefined;

async function findDifferences() {
	const results = await Promise.all(trackers.map(async tracker => ({ tracker, games: await tracker.getStartedGames() })));

	if (isOwnProfile && isEditProfile) {
		const appids = new Set();
		results.forEach(result => result.games.forEach(game => appids.add(game.appid)));

		const tracker = new Steam();
		results.push({ tracker, games: await tracker.getStartedGames([...appids]) });
	}

	for (let sourceIndex = 0; sourceIndex < results.length; sourceIndex++) {
		const source = results[sourceIndex];

		if (source.games.length === 0) {
			continue; // no games to compare
		}

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

			if (target.games.length === 0) {
				continue; // no games to compare
			}

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
					differences.push({ name: game.name, messages: messages.join(', ') });
				}
			}

			// TODO: display differences on screen instead of logging to console
			if (differences.length !== 0) {
				console.log(`Differences between ${source.tracker.name} and ${target.tracker.name}:`);
				console.table(differences);
			} else {
				console.log(`No differences between ${source.tracker.name} and ${target.tracker.name}.`)
			}
		}
	}
}

window.addEventListener('load', () => {
	const container = document.querySelector('.profile_rightcol, .profileeditshell_Navigation_33Kl1');

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
		}`;

	document.head.appendChild(style);

	const template = document.createElement('template');
	template.innerHTML = `
		<div class="atc">
			<div class="profile_item_links">
				<div class="profile_count_link ellipsis">
					<a>
						<span class="count_link_label">Achievements</span>
						&nbsp;
						<span class="profile_count_link_total">
							${document.querySelector('.achievement_showcase .value')?.textContent ?? ''}
						</span>
					</a>
				</div>
				<div>
					<label>
						<input name="profile" value="astats" type="checkbox" disabled checked /> AStats
					</label>
				</div>
				<div>
					<label>
						<input name="profile" value="completionist" type="checkbox" disabled /> completionist.me
					</label>
				</div>
				<div>
					<label>
						<input name="profile" value="steam-hunters" type="checkbox" disabled checked /> Steam Hunters
					</label>
				</div>
				<div>
					<label>
						<input name="profile" value="steam" type="checkbox" disabled checked /> Steam
					</label>
				</div>
				<br />
				<button type="button" class="btn_profile_action btn_medium" id="atc_btn">
					<span>Find Differences</span>
				</button>
			</div>
		</div>`;

	const node = document.importNode(template.content, true);

	const button = node.querySelector('#atc_btn');
	const span = button.querySelector('span');

	button.addEventListener('click', async () => {
		button.disabled = true;
		span.textContent = 'Loading...';

		try {
			await findDifferences();
		} catch (reason) {
			console.error(reason);
		}

		span.textContent = 'Find Differences';
		button.disabled = false;
	});

	if (!isOwnProfile || !isEditProfile) {
		const checkbox = node.querySelector('input[name="profile"][value="steam"]');
		checkbox.checked = false;
	}

	container.appendChild(node);
});
