import PromisePool from 'es6-promise-pool';
import { Game } from '../interfaces/game';
import { ProfileData } from '../interfaces/profile-data';
import { domParser, retry } from '../utils/utils';
import { Tracker } from './tracker';

export class Steam extends Tracker {
	name = 'Steam';

	override getProfileURL() {
		return this.profileData.url.substring(0, this.profileData.url.length - 1);
	}

	override getGameURL(game: Game) {
		return `${this.getProfileURL()}/stats/${game.appid}?tab=achievements`;
	}

	override async getStartedGames(_formData: FormData, appids: number[]) {
		const response = await fetch(`${this.getProfileURL()}/edit/showcases`, { credentials: 'same-origin' });
		const doc = domParser.parseFromString(await response.text(), 'text/html');
		const achievementShowcaseGames: AchievementShowcaseGame[] = JSON.parse(doc.getElementById('showcase_preview_17')!.innerHTML.match(/g_rgAchievementShowcaseGamesWithAchievements = (.*);/)![1]);
		const completionistShowcaseGames: CompletionistShowcaseGame[] = JSON.parse(doc.getElementById('showcase_preview_23')!.innerHTML.match(/g_rgAchievementsCompletionshipShowcasePerfectGames = (.*);/)![1]);

		appids = [...new Set([
			...appids,
			...achievementShowcaseGames.map(game => game.appid),
			...completionistShowcaseGames.map(game => game.appid),
		])];

		const games: (Game | undefined)[] = [];

		const getStartedGame = (appid: number) => this.getStartedGame(appid, achievementShowcaseGames, completionistShowcaseGames);

		function* getStartedGamesIterator() {
			for (const appid of appids) {
				yield getStartedGame(appid).then(game => games.push(game));
			}
		}

		await new PromisePool(getStartedGamesIterator(), 6).start();

		return { games: games.filter((x): x is Game => x !== undefined) };
	}

	async getStartedGame(appid: number, achievementShowcaseGames: AchievementShowcaseGame[], completionistShowcaseGames: CompletionistShowcaseGame[]): Promise<Game | undefined> {
		const achievementShowcaseGame = achievementShowcaseGames.find(game => game.appid === appid);
		const completionistShowcaseGame = completionistShowcaseGames.find(game => game.appid === appid);
		const allGroupsCompleted = completionistShowcaseGame !== undefined
			&& completionistShowcaseGame.base_groups_completed === completionistShowcaseGame.base_groups
			&& completionistShowcaseGame.dlc_groups_completed === completionistShowcaseGame.dlc_groups;
		const completedAchievementCount = allGroupsCompleted
			? completionistShowcaseGame.achievements_base + completionistShowcaseGame.achievements_dlc
			: undefined;

		let { unlocked, total } = await this.getFavoriteGameShowcaseCounts(appid);
		total ??= completedAchievementCount;

		if (unlocked === undefined) {
			if (allGroupsCompleted) {
				unlocked = completedAchievementCount!;
			} else {
				unlocked = await this.getAchievementShowcaseCount(appid);

				// Games in the showcase lists nearly always have unlocked achievements, so a 0 for them is suspect.
				if (unlocked === 0 && (achievementShowcaseGame !== undefined || completionistShowcaseGame !== undefined)) {
					return undefined;
				}

				if (unlocked === 9999) {
					return undefined;
				}
			}
		}

		const name = achievementShowcaseGame?.name ?? completionistShowcaseGame?.name;
		const isPerfect = total !== undefined ? unlocked >= total : undefined;
		const isCompleted = isPerfect ? true : undefined;
		const isCounted = allGroupsCompleted;
		const isTrusted = achievementShowcaseGame !== undefined;

		return { appid, name, unlocked, total, isPerfect, isCompleted, isCounted, isTrusted };
	}

	async getFavoriteGameShowcaseCounts(appid: number) {
		const url = `${this.getProfileURL()}/ajaxpreviewshowcase`;

		const body = new FormData();
		body.append('customization_type', '6'); // Favorite Game showcase
		body.append('sessionid', unsafeWindow.g_sessionID);
		body.append('slot_data', `{"0":{"appid":${appid}}}`);

		const response = await retry(() => {
			console.debug(`POST ${url}`);
			return fetch(url, { method: 'POST', body, credentials: 'same-origin' });
		});

		const template = document.createElement('template');
		template.innerHTML = await response.text();

		const summary = template.content.querySelector('.game_info_achievement_summary a');
		const match = summary?.textContent?.match(/([\d.,\s]+)\/([\d.,\s]+)/);

		if (match == null) {
			return { unlocked: undefined, total: undefined };
		}

		return {
			unlocked: parseInt(match[1].replace(/\D/g, '')),
			total: parseInt(match[2].replace(/\D/g, '')),
		};
	}

	async getAchievementShowcaseCount(appid: number) {
		const url = `${this.getProfileURL()}/ajaxgetachievementsforgame/${appid}`;

		const response = await retry(() => {
			console.debug(`GET ${url}`);
			return fetch(url);
		});

		const text = await response.text();

		const template = document.createElement('template');
		template.innerHTML = text;

		const list = template.content.querySelector('.achievement_list');

		if (list === null) {
			const h3 = template.content.querySelector('h3');
			throw new Error(h3?.textContent ?? `Response is invalid: ${url}`);
		}

		return list.querySelectorAll('.achievement_list_item').length;
	}

	override getRecoverLinkHTML() {
		return undefined;
	}

	override validate(game: Game) {
		const messages: string[] = [];

		if (game.isCounted === true) {
			if (game.isPerfect === false) {
				messages.push('counted but not perfect on Steam');
			}
			if (game.isTrusted === false) {
				messages.push('counted but not trusted on Steam');
			}
		} else {
			if (game.isPerfect === true && game.isTrusted === true) {
				messages.push('perfect & trusted but not counted on Steam');
			}
		}

		return messages;
	}

	static async getStatsPageCounts(profileData: ProfileData, appid: number) {
		const url = `${profileData.url}stats/${appid}/achievements?l=english`;

		try {
			const response = await retry(() => {
				console.debug(`GET ${url}`);
				return fetch(url, { credentials: 'same-origin' });
			});

			// Valid stats pages redirect too (to /achievements/{appid}), but removed apps redirect to the profile itself.
			if (!new RegExp(`/(achievements/${appid}|stats/${appid}/achievements)/?$`).test(new URL(response.url).pathname)) {
				return undefined;
			}

			const doc = domParser.parseFromString(await response.text(), 'text/html');
			const ssrData: { renderContext: { queryData: string } } = JSON.parse(doc.getElementById('valve-ssr-data')!.textContent!);
			const queries: { queryKey: unknown[], state: { data: unknown } }[] = JSON.parse(ssrData.renderContext.queryData).queries;
			const findData = <T>(type: string) => queries.find(q => q.queryKey[0] === 'achievements' && q.queryKey[1] === appid && q.queryKey[2] === type)?.state.data as T | undefined;

			const userAchievements = findData<{ achievements: { [key: string]: { unlocked: boolean } } }>('user_achievements');
			const schema = findData<{ groups: { achievements: unknown[] }[] }>('schema_v2');

			if (userAchievements === undefined || schema === undefined) {
				return undefined;
			}

			return {
				unlocked: Object.values(userAchievements.achievements).filter(a => a.unlocked).length,
				total: schema.groups.reduce((sum, group) => sum + group.achievements.length, 0),
			};
		} catch (e) {
			console.error(e);
			return undefined;
		}
	}
}

interface AchievementShowcaseGame {
	appid: number;
	name: string;
}

interface CompletionistShowcaseGame {
	appid: number;
	name: string;
	base_groups: number;
	base_groups_completed: number;
	dlc_groups: number;
	dlc_groups_completed: number;
	achievements_base: number;
	achievements_dlc: number;
}
