
import { CardType, Card, CardColor, SkipCard, Plus2Card, Plus4Card, NumberCard, ReverseCard, ColorSwitchCard, CardDirection } from "../deps.ts";

export class PM {
	static TOTAL_CARD_NUM = 107

	/** 每个牌的分值（数字牌需要特殊处理） */
	cardRecord: Record<CardType, number> = {
		[CardType.number]: 0,
		[CardType.plus2]: 20,
		[CardType.reverse]: 20,
		[CardType.skip]: 20,
		[CardType.plus4]: 50,
		[CardType.colorSwitch]: 50,
	};


	private colors: CardColor[] = [
		CardColor.blue,
		CardColor.green,
		CardColor.red,
		CardColor.yellow,
	];

	/** 初始每人几张 */
	DEAL_COUNT = 7

	/** 玩家卡牌 */
	players: Record<string, Card[]>
	/** 所有卡牌 */
	cards: Card[]
	/** 轮到谁的回合 */
	turn: string
	/** 方向 */
	direction: CardDirection
	/** 当前出牌颜色 */
	currentColor: CardColor

	constructor(player: Record<string, unknown>) {
		this.players = {}
		const playerKey = Object.keys(player)
		playerKey.forEach(key => this.players[key] = [])
		this.cards = this.getInitialCard()
		this.shuffle()
		this.dealCards()
		this.turn = playerKey[0]
		this.direction = CardDirection.Clockwise
		this.currentColor = CardColor.all
	}

	calCardScore(cards: Array<Card>): number {
		let score = 0, num: number
		for (const card of cards) {
			if (card instanceof NumberCard) {
				num = card.value
			} else {
				num = this.cardRecord[card.type];
			}
			score += num;
		}
		return score;
	}

	// 初始化牌
	getInitialCard(): Array<Card> {
		const cards: Array<Card> = [];

		const colors = this.colors;
		function makeGroup<T extends Card>(
			callback: (color: CardColor) => T | T[],
		): T[] {
			const arr: T[] = [], len = colors.length
			let item: T | T[];
			for (let i = 0; i < len; i++) {
				item = callback(colors[i])
				if (Array.isArray(item)) {
					arr.push(...item)
				} else {
					arr.push(item)
				}
			}
			return arr;
		}

		// 数字牌0 每种颜色一张 （4张）
		const cardNum0 = makeGroup<NumberCard>(function (color) {
			return new NumberCard(0, color);
		})
		// 数字牌 1~9 每种颜色各两张 （72张）
		const cardNum1to9 = makeGroup<NumberCard>(function (color) {
			const arr: NumberCard[] = []
			for (let i = 1; i <= 9; ++i) {
				arr.push(new NumberCard(i, color))
				arr.push(new NumberCard(i, color))
			}
			return arr;
		})

		// 功能牌 24张
		const cardFn = makeGroup<Card>(function (color) {
			const arr: Card[] = []
			for (let i = 0; i < 2; ++i) {
				arr.push(...[
					new Plus2Card(color),
					new ReverseCard(color),
					new SkipCard(color),
				])
			}
			return arr;
		})

		const cardHigh = (function () {
			const arr: Card[] = []
			// 高级牌 8张
			for (let i = 0; i < 4; ++i) {
				arr.push(new ColorSwitchCard())
				arr.push(new Plus4Card())
			}
			return arr;
		})();

		// console.log('cardNum0: ', cardNum0.length)
		// console.log('cardNum1to9: ', cardNum1to9.length)
		// console.log('cardFn: ', cardFn.length)
		// console.log('cardHigh: ', cardHigh.length)

		cards.push(
			...cardNum0,
			...cardNum1to9,
			...cardFn,
			...cardHigh,
		)

		return cards;
	}

	/**
	 * 洗牌
	 * @param arr 
	 */
	shuffle() {
		const arr = this.cards
		let i = arr.length;
		while (i) {
			const j = Math.floor(Math.random() * i--);
			[arr[j], arr[i]] = [arr[i], arr[j]];
		}
		return arr;
	}

	/**
	 * 发牌
	 */
	dealCards(): void {
		const playersCardsList = Object.keys(this.players).map(k => this.players[k]);
		const len = playersCardsList.length, maxCount = this.DEAL_COUNT * len;
		let count = 0, currIdx = 0;
		this.cards.every((card) => {
			playersCardsList[currIdx].push(card);
			count++;
			if (count >= maxCount) {
				return false
			}
			currIdx++;
			if (currIdx >= len) { currIdx = 0 }
			return true
		})
	}
}