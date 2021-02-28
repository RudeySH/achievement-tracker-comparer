// ==UserScript==
// @name        Achievement Tracker Comparer
// @namespace   https://github.com/RudeySH/achievement-tracker-comparer
// @version     0.1.0
// @author      Rudey
// @description Compare achievements between AStats, completionist.me, Steam Hunters and Steam Community profiles.
// @homepageURL https://github.com/RudeySH/achievement-tracker-comparer
// @supportURL  https://github.com/RudeySH/achievement-tracker-comparer/issues
// @match       https://steamcommunity.com/id/*
// @match       https://steamcommunity.com/profiles/*
// @grant       GM_xmlhttpRequest
// @connect     steamhunters.com
// ==/UserScript==

'use strict';

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
		return []; // TODO: scrape AStats
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
			//total: license.app.achievementCount,
			isPerfect: license.achievementUnlockCount === license.app.achievementCount,
			isTrusted: !license.app.isRestricted,
			isCounted: true,
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
				startedGames.push({ appid, name, unlocked, total: 1, isPerfect: unlocked === 1, isCounted: true, isTrusted: true });
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
			const isPerfect = total !== undefined ? total === unlocked : undefined;
			const isTrusted = achievementShowcaseGame !== undefined;
			const isCounted = completionistShowcaseGame !== undefined;

			startedGames.push({ appid, name, unlocked, total, isPerfect, isTrusted, isCounted });
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
					}
					if (game.source.isTrusted && !game.target.isTrusted) {
						messages.push(`trusted on ${source.tracker.name} but not on ${target.tracker.name}`);
					} else if (game.target.isTrusted && !game.source.isTrusted) {
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
						<input name="profile" value="astats" type="checkbox" disabled /> AStats
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
