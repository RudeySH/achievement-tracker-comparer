import { Game } from '../interfaces/game';
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

		const games: Game[] = [];
		const iterator = this.getStartedGamesIterator(appids, achievementShowcaseGames, completionistShowcaseGames, games);
		const pool = new PromisePool(iterator, 6);

		await pool.start();

		return { games };
	}

	* getStartedGamesIterator(appids: number[], achievementShowcaseGames: AchievementShowcaseGame[], completionistShowcaseGames: CompletionistShowcaseGame[], games: Game[]) {
		for (const appid of appids) {
			yield this.getStartedGame(appid, achievementShowcaseGames, completionistShowcaseGames).then(game => games.push(game));
		}
	}

	async getStartedGame(appid: number, achievementShowcaseGames: AchievementShowcaseGame[], completionistShowcaseGames: CompletionistShowcaseGame[]): Promise<Game> {
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

	async getFavoriteGameShowcaseCounts(appid: number) {
		const url = `${this.getProfileURL()}/ajaxpreviewshowcase`;

		const body = new FormData();
		body.append('customization_type', '6');
		body.append('sessionid', unsafeWindow.g_sessionID);
		body.append('slot_data', `{"0":{"appid":${appid}}}`);

		const response = await retry(() => {
			console.debug(`POST ${url}`);
			return fetch(url, { method: 'POST', body, credentials: 'same-origin' });
		});

		const text = await response.text();

		const template = document.createElement('template');
		template.innerHTML = text.replace(/src="[^"]+"/g, '');

		const ellipsis = template.content.querySelector('.ellipsis');

		let unlocked = undefined;
		let total = undefined;

		if (ellipsis !== null) {
			const split = ellipsis.textContent!.split(/\D+/).filter(s => s !== '');
			unlocked = parseInt(split[0]);
			total = parseInt(split[1]);
		}

		return { unlocked, total };
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
}

interface AchievementShowcaseGame {
	appid: number;
	name: string;
}

interface CompletionistShowcaseGame {
	appid: number;
	name: string;
	num_achievements: number;
}
