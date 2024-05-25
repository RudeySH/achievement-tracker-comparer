import { Game } from '../interfaces/game';
import { getHTML, getJSON } from '../utils/utils';
import { Tracker } from './tracker';

export class TrueSteamAchievements extends Tracker {
	name = 'TrueSteamAchievements';

	profileUrl?: string;
	gamerID?: string;

	override getProfileURL() {
		return this.profileUrl;
	}

	override getGameURL(game: Game) {
		if (!game.tsaUrlName) {
			return `https://truesteamachievements.com/steamgame/${game.appid}?utm_campaign=userscript`;
		}

		return `https://truesteamachievements.com/game/${game.tsaUrlName}/achievements?gamerid=${this.gamerID}&utm_campaign=userscript`;
	}

	override async getStartedGames(formData: FormData) {
		const games: Game[] = [];

		const prefix = 'https://truesteamachievements.com/gamer/';
		let profileUrl = `${formData.get('tsaProfileUrl')}/games?utm_campaign=userscript`;

		if (!profileUrl.startsWith(prefix)) {
			profileUrl = prefix + profileUrl;
		}

		this.profileUrl = profileUrl;

		const html = await getHTML(profileUrl);
		this.gamerID = /gamerid=(\d+)/.exec(html)![1];

		const gamesList = document.createElement('div');
		const params = `oGamerGamesList|oGamerGamesList_ItemsPerPage=99999999&txtGamerID=${this.gamerID}`;
		const gamesListURL = `${profileUrl}&executeformfunction&function=AjaxList&params=${encodeURIComponent(params)}`;
		gamesList.innerHTML = await getHTML(gamesListURL);

		const rows = gamesList.querySelectorAll<HTMLTableRowElement>('tr');

		for (let i = 1; i < rows.length - 1; i++) {
			const row = rows[i];
			const anchor = row.querySelector<HTMLAnchorElement>('a[href*="gameid="]')!;
			const counts = row.cells[2].textContent!.split(' of ').map(s => parseInt(s.replace(/,/g, '')));
			const unlocked = counts[0];
			const total = counts[1];
			const isPerfect = unlocked >= total;

			games.push({
				appid: 0,
				tsaGameId: parseInt(new URL(anchor.href).searchParams.get('gameid')!),
				tsaUrlName: /game\/([^/]+)/.exec(row.querySelector('a')!.href)![1],
				name: row.cells[1].textContent!,
				unlocked,
				total,
				isPerfect,
				isCompleted: isPerfect ? true : undefined,
				isCounted: isPerfect,
				isTrusted: undefined,
			});
		}

		const iterator = this.setAppIdsIterator(games);
		const pool = new PromisePool(iterator, 6);
		await pool.start();

		const unsetGames = games.filter(game => game.appid === 0);

		if (unsetGames.length !== 0) {
			const iterator = this.setAppIdsSlowIterator(unsetGames);
			const pool = new PromisePool(iterator, 6);
			await pool.start();
		}

		return { games: games.filter(game => game.appid !== 0) };
	}

	* setAppIdsIterator(games: Game[]) {
		for (let i = 0; i < games.length; i += 100) {
			const batch = games.slice(i, i + 100);
			const url = `https://steamhunters.com/api/apps/app-ids?${batch.map(game => `tsaGameIds=${game.tsaGameId}`).join('&')}&utm_campaign=userscript`;

			yield getJSON<{ [tsaGameId: string]: number }>(url)
				.then(response => {
					for (const game of batch) {
						game.appid = response[game.tsaGameId!] ?? 0;
					}
				});
		}
	}

	* setAppIdsSlowIterator(games: Game[]) {
		for (const game of games) {
			const url = this.getGameURL(game);

			yield getHTML(url)
				.then(response => {
					const match = /steampowered.com\/app\/(\d+)/.exec(response);
					if (match !== null) {
						game.appid = parseInt(match[1]);
					}
				});
		}
	}

	override getRecoverLinkHTML() {
		return undefined;
	}
}
