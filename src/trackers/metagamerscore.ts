import { Game } from '../interfaces/game';
import { getDocument, getRedirectURL } from '../utils/utils';
import { Tracker } from './tracker';

export class MetaGamerScore extends Tracker {
	name = 'MetaGamerScore';
	signInRequired = false;
	userID?: string;

	override getProfileURL() {
		return `https://metagamerscore.com/steam/id/${this.profileData.steamid}?utm_campaign=userscript`;
	}

	override getGameURL(_appid: number, name: string | undefined) {
		if (this.userID === undefined || name === undefined) {
			return undefined;
		}

		return `https://metagamerscore.com/my_games?user=${this.userID}&filter=${encodeURIComponent(name)}&utm_campaign=userscript`;
	}

	override async getStartedGames() {
		const games: Game[] = [];

		const profileURL = this.getProfileURL();
		const redirectURL = await getRedirectURL(profileURL);
		this.userID = new URL(redirectURL).pathname.split('/')[2];

		const gamesURL = `https://metagamerscore.com/my_games?user=${this.userID}&utm_campaign=userscript`;

		let details = { headers: { 'Cookie': `game_view=thumb; hide_pfs=[1,3,4,5,6,7,8,9,10,11,12,13,14]` } } as Partial<GM.Request>;
		let doc = await this.addStartedGames(games, gamesURL, details);

		if (games.length === 0) {
			details = { withCredentials: false } as Partial<GM.Request>;
			doc = await this.addStartedGames(games, gamesURL, details);
		}

		const lastPageAnchor = doc.querySelector<HTMLAnchorElement>('.last a');

		if (lastPageAnchor !== null) {
			const pageCount = parseInt(new URL(lastPageAnchor.href).searchParams.get('page')!);
			const iterator = this.getStartedGamesIterator(games, gamesURL, details, pageCount);
			const pool = new PromisePool(iterator, 6);
			await pool.start();
		}

		return { games };
	}

	* getStartedGamesIterator(games: Game[], url: string, details: Partial<GM.Request>, pageCount: number) {
		for (let page = 2; page <= pageCount; page++) {
			yield this.addStartedGames(games, `${url}&page=${page}`, details);
		}
	}

	async addStartedGames(games: Game[], url: string, details: Partial<GM.Request>) {
		const doc = await getDocument(url, details);
		const thumbs = doc.querySelectorAll('#masonry-container > div');

		for (const thumb of thumbs) {
			const tag = thumb.querySelector<HTMLElement>('.pfSm')!;
			if (!tag.classList.contains('pfTSteam')) {
				console.warn(tag.title);
				continue;
			}

			const [unlocked, total] = [...thumb.querySelectorAll('.completiondata')]
				.map(completiondata => parseInt(completiondata.textContent!.replace('\u202F', '')));

			if (!(unlocked > 0)) {
				continue;
			}

			const isPerfect = unlocked >= total;
			const image = thumb.querySelector<HTMLImageElement>('.gt_image');

			if (image === null) {
				continue;
			}

			const prefix = '/apps/';
			const imagePath = image.src.substring(image.src.indexOf(prefix) + prefix.length);

			const appid = parseInt(imagePath.split('/')[0]);
			const name = thumb.querySelector('.sort_gt_tt a')!.textContent!.trim();

			games.push({
				appid,
				name,
				unlocked,
				total,
				isPerfect,
				isCompleted: isPerfect ? true : undefined,
				isCounted: isPerfect,
				isTrusted: undefined,
			});
		}

		return doc;
	}

	override getRecoverLinkHTML() {
		return `
			<a class="whiteLink" href="https://metagamerscore.com/steam/index_reconcile" target="_blank">
				Recover
				<img src="https://community.cloudflare.steamstatic.com/public/images/skin_1/iconExternalLink.gif" />
			</a>`;
	}
}
