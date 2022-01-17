import he from 'he';
import { Game } from './interfaces/game';
import { ProfileData } from './interfaces/profile-data';
import { RecoverGame } from './interfaces/recover-game';
import { AStats } from './trackers/astats';
import { Completionist } from './trackers/completionist';
import { Exophase } from './trackers/exophase';
import { MetaGamerScore } from './trackers/metagamerscore';
import { Steam } from './trackers/steam';
import { SteamHunters } from './trackers/steam-hunters';
import { Tracker } from './trackers/tracker';
import { getDocument, groupBy } from './utils/utils';

declare global {
	interface Window {
		g_rgProfileData: ProfileData;
		g_sessionID: string;
		g_steamID: string;
	}
}

const profileData = unsafeWindow.g_rgProfileData ?? {};
const isOwnProfile = unsafeWindow.g_steamID === profileData.steamid;

const trackers: Tracker[] = [
	new Completionist(profileData),
	new SteamHunters(profileData),
	new AStats(profileData),
	new Exophase(profileData),
	new MetaGamerScore(profileData),
];

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

		.atc button.whiteLink {
			background-color: transparent;
			font-size: inherit;
			padding: 0;
		}

		.atc form {
			display: inline;
		}

		.atc input[type="checkbox"] {
			vertical-align: top;
		}

		.atc .atc_help {
			cursor: help;
		}

		.atc .commentthread_entry_quotebox {
			font-size: 11px;
			height: 48px;
			min-height: 48px;
			overflow-y: scroll;
			resize: vertical;
		}

		.atc .profile_comment_area {
			margin-top: 0;
		}`;

	document.head.appendChild(style);

	const template = document.createElement('template');
	template.innerHTML = `
		<div class="atc">
			<div class="profile_item_links">
				<form>
					<div class="profile_count_link ellipsis">
						<a>
							<span class="count_link_label">Achievement Trackers</span>&nbsp;
							<span class="profile_count_link_total">${trackers.length}</span>
						</a>
					</div>
					${trackers.sort((a, b) => a.name.toUpperCase() < b.name.toUpperCase() ? -1 : 1).map(tracker =>
						`<div>
							<label>
								<input type="checkbox" name="trackerName" value="${tracker.name}" ${tracker.signInRequired && !isOwnProfile ? 'disabled' : ''} />
								${tracker.name}
							</label>
							<a class="whiteLink" href="${tracker.getProfileURL()}" target="_blank">
								<img src="https://community.cloudflare.steamstatic.com/public/images/skin_1/iconExternalLink.gif" />
							</a>
							${tracker.signInRequired ? '<span class="atc_help" title="Sign-in required" aria-describedby="atc_sign_in_required">*</span>' : ''}
						</div>`).join('')}
					<p ${isOwnProfile ? '' : 'hidden'}>
						<label>
							<input type="checkbox" name="trackerName" value="Steam" />
							Steam profile showcases (slow)
						</label>
					</p>
					<p id="atc_sign_in_required">
						* Sign-in required
					</p>
					<p>
						<button type="button" class="btn_profile_action btn_medium" id="atc_btn" disabled>
							<span>Find Differences</span>
						</button>
						<span id="atc_counter">0</span>
						selected
					</p>
				</form>
				<div id="atc_output"></div>
			</div>
		</div>`;

	const node = document.importNode(template.content, true);
	const form = node.querySelector('form')!;

	const checkboxes = form.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
	const button = form.querySelector<HTMLButtonElement>('button#atc_btn')!;
	const buttonSpan = button.querySelector('span')!;
	const counter = form.querySelector('#atc_counter')!;

	const output = node.querySelector('#atc_output')!;

	form.addEventListener('change', () => {
		const formData = new FormData(form);
		const trackerNames = formData.getAll('trackerName');
		button.disabled = trackerNames.length < 2;
		counter.textContent = trackerNames.length.toString();
	});

	button.addEventListener('click', async () => {
		const formData = new FormData(form);
		const trackerNames = formData.getAll('trackerName');

		button.disabled = true;
		buttonSpan.textContent = 'Loading...';

		for (const checkbox of checkboxes) {
			checkbox.dataset['disabled'] = checkbox.disabled.toString();
			checkbox.disabled = true;
		}

		try {
			await findDifferences(trackerNames, output);
		} catch (reason) {
			console.error(reason);
		}

		buttonSpan.textContent = 'Find Differences';
		button.disabled = false;

		for (const checkbox of checkboxes) {
			checkbox.disabled = checkbox.dataset['disabled'] === 'true';
		}
	});

	container.appendChild(node);
});

async function findDifferences(trackerNames: FormDataEntryValue[], output: Element) {
	output.innerHTML = '';

	const results = await Promise.all(trackers
		.filter(tracker => trackerNames.includes(tracker.name))
		.map(async tracker => ({ tracker, ...await tracker.getStartedGames() })));

	if (trackerNames.includes('Steam')) {
		const appids = new Set<number>();
		results.forEach(result => result.games.forEach(game => appids.add(game.appid)));

		const tracker = new Steam(profileData);
		results.push({ tracker, ...await tracker.getStartedGames([...appids]) });
	}

	const numberOfTrackersWithGames = results.filter(result => result.games.length !== 0).length;

	const missingAppids = groupBy(results.flatMap(r => r.games), g => g.appid)
		.filter(group => {
			if (group.length !== numberOfTrackersWithGames) {
				return true;
			}

			const [game, ...games] = group;
			return games.some(g => g.unlocked !== game.unlocked);
		})
		.map(group => group.key);

	const sourceGames: Game[] = [];
	const steamResult = results.find(result => result.tracker instanceof Steam);

	function* getMissingGamesIterator() {
		for (const appid of missingAppids) {
			yield addMissingGame(appid);
		}
	}

	async function addMissingGame(appid: number) {
		let game = steamResult?.games.find(game => game.appid === appid);

		if (game === undefined) {
			const doc = await getDocument(`${unsafeWindow.g_rgProfileData.url}stats/${appid}/achievements?l=english`, { headers: { 'X-ValveUserAgent': 'panorama' } });
			const match = doc.body.innerHTML.match(/g_rgAchievements = ({.*});/);

			if (match !== null) {
				const g_rgAchievements: { total: number; totalClosed: number; } = JSON.parse(match[1]);
				const isPerfect = g_rgAchievements.totalClosed === g_rgAchievements.total;

				game = {
					appid,
					unlocked: g_rgAchievements.totalClosed,
					total: g_rgAchievements.total,
					name: doc.body.innerHTML.match(/'SetContentTitle', '(.*) Achievements'/)?.[1],
					isPerfect,
					isCompleted: isPerfect ? true : undefined,
					isCounted: isPerfect,
					isTrusted: undefined,
				}
			} else {
				game = results.flatMap(r => r.games).find(game => game.appid === appid)!;
			}
		}

		sourceGames.push(game);
	}

	const iterator = getMissingGamesIterator();
	const pool = new PromisePool(iterator, 6);
	await pool.start();

	output.innerHTML = `
		<div class="profile_comment_area">
			${results.sort((a, b) => a.tracker.name.toUpperCase() < b.tracker.name.toUpperCase() ? -1 : 1).filter(result => result.tracker.name !== 'Steam').map(result => {
				let html = `
					<div style="margin-top: 1em;">
						<a class="whiteLink" href="${result.tracker.getProfileURL()}" target="_blank">
							${result.tracker.name}
							<img src="https://community.cloudflare.steamstatic.com/public/images/skin_1/iconExternalLink.gif" />
						</a>
					</div>`;

				if (result.message !== undefined || result.games.length === 0) {
					html += `
						<span style="color: #b33b32;">
							✖ ${result.message ?? 'No achievements found'}
						</span>`;
				} else {
					const mismatchGames = sourceGames
						.map(sourceGame => {
							return { sourceGame, targetGame: result.games.find(game => game.appid === sourceGame.appid) };
						})
						.filter(x => x.sourceGame.unlocked !== x.targetGame?.unlocked);

					const gamesWithMissingAchievements = mismatchGames.filter(x => x.sourceGame.unlocked > (x.targetGame?.unlocked ?? 0));
					const gamesWithRemovedAchievements = mismatchGames.filter(x => x.sourceGame.unlocked < (x.targetGame?.unlocked ?? 0));

					if (gamesWithMissingAchievements.length === 0 && gamesWithRemovedAchievements.length === 0) {
						html += `
							<span style="color: #90ba3c;">
								✔ Up to date
							</span>`;
					} else {
						if (gamesWithMissingAchievements.length !== 0) {
							const missingAchievementsSum = gamesWithMissingAchievements
								.map(x => x.sourceGame.unlocked - (x.targetGame?.unlocked ?? 0))
								.reduce((a, b) => a + b);

							const namesHTML = gamesWithMissingAchievements
								.map(x => ({ name: he.escape(x.sourceGame.name ?? `Unknown App ${x.sourceGame.appid}`), url: result.tracker.getGameURL(x.sourceGame.appid, x.sourceGame.name) }))
								.sort((a, b) => a.name.toUpperCase() < b.name.toUpperCase() ? -1 : 1)
								.map(x => x.url !== undefined ? `<a class="whiteLink" href="${x.url}" target="_blank">${x.name}</a>` : x.name)
								.join(' &bull; ');

							const jsonGames = gamesWithMissingAchievements.map<RecoverGame>(x => ({ appid: x.sourceGame.appid, unlocked: x.sourceGame.unlocked, total: x.sourceGame.total }));
							const recoverLinkHTML = isOwnProfile ? result.tracker.getRecoverLinkHTML(jsonGames) : undefined;

							html += `
								<span style="color: #b33b32;">
									✖ ${missingAchievementsSum.toLocaleString()} missing achievement${missingAchievementsSum !== 1 ? 's' : ''}
									in ${gamesWithMissingAchievements.length.toLocaleString()} game${gamesWithMissingAchievements.length !== 1 ? 's' : ''}
								</span>
								<div class="commentthread_entry_quotebox">
									${namesHTML}
								</div>
								<div style="font-size: 11px; margin-bottom: 1em;">
									<a class="whiteLink" data-copy="${gamesWithMissingAchievements.map(g => g.sourceGame.appid)}">
										Copy App IDs
									</a>
									&bull;
									<a class="whiteLink" data-copy="${he.escape(JSON.stringify({ version: '2.0', apps: jsonGames }))}">
										Copy JSON
									</a>
									${recoverLinkHTML === undefined ? '' : `
										&bull;
										${recoverLinkHTML}
									`}
								</div>`;
						}
						if (gamesWithRemovedAchievements.length !== 0) {
							const removedAchievementsSum = gamesWithRemovedAchievements
								.map(x => (x.targetGame?.unlocked ?? 0) - x.sourceGame.unlocked)
								.reduce((a, b) => a + b);

							const namesHTML = gamesWithRemovedAchievements
								.map(x => ({ name: he.escape(x.sourceGame.name ?? `Unknown App ${x.sourceGame.appid}`), url: result.tracker.getGameURL(x.sourceGame.appid, x.sourceGame.name) }))
								.sort((a, b) => a.name.toUpperCase() < b.name.toUpperCase() ? -1 : 1)
								.map(x => x.url !== undefined ? `<a class="whiteLink" href="${x.url}" target="_blank">${x.name}</a>` : x.name)
								.join(' &bull; ');

							const jsonGames = gamesWithMissingAchievements.map<RecoverGame>(x => ({ appid: x.sourceGame.appid, unlocked: x.sourceGame.unlocked, total: x.sourceGame.total }));

							html += `
								<span style="color: #b33b32;">
									✖ ${removedAchievementsSum.toLocaleString()} removed achievement${removedAchievementsSum !== 1 ? 's' : ''}
									in ${gamesWithRemovedAchievements.length.toLocaleString()} game${gamesWithRemovedAchievements.length !== 1 ? 's' : ''}
								</span>
								<div class="commentthread_entry_quotebox">
									${namesHTML}
								</div>
								<div style="font-size: 11px;">
									<a class="whiteLink" data-copy="${gamesWithRemovedAchievements.map(g => g.sourceGame.appid)}">
										Copy App IDs
									</a>
									&bull;
									<a class="whiteLink" data-copy="${he.escape(JSON.stringify({ version: '2.0', apps: jsonGames }))}">
										Copy JSON
									</a>
								</div>`;
						}
					}
				}

				return html;
			}).join('')}
		</div>`;

	for (const anchor of output.querySelectorAll<HTMLAnchorElement>('a[data-copy]')) {
		anchor.addEventListener('click', async function () {
			await navigator.clipboard.writeText(this.dataset['copy']!);
			alert('Copied to clipboard.');
		});
	}

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
			console.info(`Validation errors on ${source.tracker.name}:`);
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
						sourceURL: source.tracker.getGameURL(game.appid, game.name),
						targetURL: target.tracker.getGameURL(game.appid, game.name),
					});
				}
			}

			// TODO: display differences on screen instead of logging to console

			if (differences.length === 0) {
				console.info(`No differences between ${source.tracker.name} and ${target.tracker.name}.`);
				continue;
			}

			differences.sort((a, b) => a.appid - b.appid);

			console.info(`Differences between ${source.tracker.name} and ${target.tracker.name}:`);

			if (differences.length <= 100) {
				console.table(differences);
			}

			const csv = `App ID,Name,Differences,${source.tracker.name} URL,${target.tracker.name} URL\n`
				+ differences.map(d => `${d.appid},${escapeCSV(d.name)},${d.messages},${d.sourceURL},${d.targetURL}`).join('\n');

			console.debug(csv);
		}
	}
}

function escapeCSV(string: string) {
	if (string.indexOf('"') !== -1) {
		return `"${string.replace(/"/g, '""')}"`;
	} else if (string.indexOf(',') !== -1) {
		return `"${string}"`;
	}

	return string;
}
