import { Game } from '../interfaces/game';
import { RecoverGame } from '../interfaces/recover-game';
import { getDocument } from '../utils/utils';
import { Tracker } from './tracker';

export class Completionist extends Tracker {
	name = 'completionist.me';

	override getProfileURL() {
		return `https://completionist.me/steam/profile/${this.profileData.steamid}?utm_campaign=userscript`;
	}

	override getGameURL(appid: number) {
		return `https://completionist.me/steam/profile/${this.profileData.steamid}/app/${appid}?utm_campaign=userscript`;
	}

	override async getStartedGames() {
		const games: Game[] = [];

		const url = `https://completionist.me/steam/profile/${this.profileData.steamid}/apps?display=flat&sort=started&order=asc&completion=started&utm_campaign=userscript`;
		const doc = await this.addStartedGames(games, url);
		const lastPageAnchor = doc.querySelector<HTMLAnchorElement>('.pagination a:last-of-type');

		if (lastPageAnchor !== null) {
			const pageCount = parseInt(new URL(lastPageAnchor.href).searchParams.get('page')!);
			const iterator = this.getStartedGamesIterator(games, url, pageCount);
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
		const doc = await getDocument(url);
		const rows = doc.querySelectorAll<HTMLTableRowElement>('.games-list tbody tr');

		for (const row of rows) {
			const nameCell = row.cells[1];
			const anchor = nameCell.querySelector('a')!;
			const counts = row.cells[4].textContent!.split('/').map(s => parseInt(s.replace(',', '')));
			const unlocked = counts[0];
			const total = counts[1] ?? unlocked;
			const isPerfect = unlocked >= total;

			games.push({
				appid: parseInt(anchor.href.substring(anchor.href.lastIndexOf('/') + 1)),
				name: nameCell.textContent!.trim(),
				unlocked,
				total,
				isPerfect,
				isCompleted: isPerfect ? true : undefined,
				isCounted: isPerfect,
				isTrusted: nameCell.querySelector('.fa-spinner') === null,
			});
		}

		return doc;
	}

	override getRecoverLinkHTML(games: RecoverGame[]) {
		return `
			<form method="post" action="https://completionist.me/steam/recover/profile" target="_blank">
				<input type="hidden" name="app_ids" value="${games.map(game => game.appid)}">
				<input type="hidden" name="profile_id" value="${this.profileData.steamid}">
				<button type="submit" class="whiteLink">
					Recover
					<img src="https://community.cloudflare.steamstatic.com/public/images/skin_1/iconExternalLink.gif" />
				</button>
			</form>`;
	}
}
