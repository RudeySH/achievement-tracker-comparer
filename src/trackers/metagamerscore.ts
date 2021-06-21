import { Game } from '../interfaces/game';
import { getDocument, getRedirectURL } from '../utils/utils';
import { Tracker } from './tracker';

export class MetaGamerScore extends Tracker {
	name = 'MetaGamerScore';
	signInRequired = false;

	override getProfileURL() {
		return `https://metagamerscore.com/steam/id/${this.profileData.steamid}?utm_campaign=userscript`;
	}

	override getGameURL() {
		return undefined;
	}

	override async getStartedGames() {
		const games: Game[] = [];

		const profileURL = this.getProfileURL();
		const redirectURL = await getRedirectURL(profileURL);
		const user = parseInt(new URL(redirectURL).pathname.split('/')[2]);
		const gamesURL = `https://metagamerscore.com/my_games?user=${user}&utm_campaign=userscript`;
		const document = await this.addStartedGames(games, gamesURL);
		const lastPageAnchor = document.querySelector<HTMLAnchorElement>('.last a');

		if (lastPageAnchor !== null) {
			const pageCount = parseInt(new URL(lastPageAnchor.href).searchParams.get('page')!);
			const iterator = this.getStartedGamesIterator(games, gamesURL, pageCount);
			const pool = new PromisePool(iterator, 6);
			await pool.start();
		}

		return { games };
	}

	* getStartedGamesIterator(games: Game[], url: string, pageCount: number) {
		for (let page = 2; page <= pageCount; page++) {
			yield this.addStartedGames(games, `${url}&page=${page}`);
		}
	}

	async addStartedGames(games: Game[], url: string) {
		const details = { headers: { 'Cookie': `game_view=thumb; hide_pfs=[1,3,4,5,6,7,8,9,10,11,12,13,14]` }, withCredentials: false };
		const document = await getDocument(url, details);
		const thumbs = document.querySelectorAll('#masonry-container > div');

		for (const thumb of thumbs) {
			const tag = thumb.querySelector<HTMLElement>('.pfSm')!;
			if (!tag.classList.contains('pfTSteam')) {
				console.warn(tag.title);
				continue;
			}

			const [unlocked, total] = [...thumb.querySelectorAll('.completiondata')]
				.map(completiondata => parseInt(completiondata.textContent!.replace(' ', '')));

			if (!(unlocked > 0)) {
				continue;
			}

			const isPerfect = unlocked >= total;
			const imagePath = thumb.querySelector<HTMLImageElement>('.gt_image')!.src
				.replace('https://steamcdn-a.akamaihd.net/steam/apps/', '')
				.replace('https://steamcdn-a.akamaihd.net/steamcommunity/public/images/apps/', '');

			games.push({
				appid: parseInt(imagePath.split('/')[0]),
				name: thumb.querySelector('.sort_gt_tt a')!.textContent!.trim(),
				unlocked,
				total,
				isPerfect,
				isCompleted: isPerfect ? true : undefined,
				isCounted: isPerfect,
				isTrusted: undefined,
			});
		}

		return document;
	}

	override getRecoverLinkHTML() {
		return `
			<a class="whiteLink" href="https://metagamerscore.com/steam/index_reconcile" target="_blank">
				Recover
				<img src="https://community.cloudflare.steamstatic.com/public/images/skin_1/iconExternalLink.gif" />
			</a>`;
	}
}
