
import { CardType, Card, CardColor, SkipCard, Plus2Card, Plus4Card, NumberCard, ReverseCard, ColorSwitchCard } from "../deps.ts";

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

	get cardNum() {
		return this.cards.length
	}

	/** 轮到谁的回合 */
	turn: number
	/** 方向 */
	clockwise: boolean
	/** 当前出牌颜色 */
	currentColor: CardColor
	/** 当前是数字牌是的大小 */
	currentValue = -1
	/** 当前加了多少 */
	currentPlus = 0
	/** 当前牌的类型 */
	lastCard: Card | null = null

	/** 人数 */
	_length: number

	constructor(player: Record<string, unknown>) {
		this.players = {}
		const playerKeys = Object.keys(player)
		this._length = playerKeys.length
		playerKeys.forEach(key => this.players[key] = [])
		this.cards = this.getInitialCard()
		this.shuffle()
		this.dealCards()
		this.turn = 0
		this.clockwise = true
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
		let currIdx = 0;
		for (let i = 0; i < maxCount; i++) {
			const card = this.cards.pop()!
			playersCardsList[currIdx++].push(card);
			if (currIdx >= len) { currIdx = 0 }
		}
	}

	getTurnPlayerId() {
		return Object.keys(this.players)[this.turn]
	}

	playCard(uid: string, index: number, color?: CardColor) {
		const cards = this.players[uid]
		if (!cards) return false
		const card = cards[index]
		if (!card) return false

		const ret = card.judge(this.lastCard, this.currentColor)
		if (!ret) return false

		// 用户牌堆里去除该张牌
		cards.splice(index, 1)

		// const step = 1
		if (card instanceof NumberCard) {
			this.currentValue = card.value
		} else if (card instanceof ReverseCard) {
			this.clockwise = !this.clockwise
		} else if (card instanceof Plus2Card) {
			this.currentPlus += 2
		} else if (card instanceof Plus4Card) {
			this.currentPlus += 4
		} else if (card instanceof SkipCard) {
			// 双人 玩家打出跳过牌后，可以继续打出下一张牌
			// if (this._length === 2) step = 2
			// else step = 1
		}

		// 如果是万能牌会指定颜色
		this.currentColor = color === void 0 ? card.color : color
		
		this.nextTurn(1)
		this.lastCard = card

		return true
	}

	nextTurn(step: number) {
		if (!this.clockwise) step = -step;
		let nextTurn = this.turn + step
		// [0,1]  next: 2 >= 2  next = 2 % 2 = 0
		if (nextTurn >= this._length) nextTurn = nextTurn % this._length
		// [0,1]  next: -1 < 0  next = 2 + -1 = 1
		else if (nextTurn < 0) nextTurn = this._length + nextTurn
		// 下一个人
		console.log('[turn]', nextTurn)
		this.turn = nextTurn
	}

	drawCard(sid: string) {
		const player = this.players[sid]
		if (!player) return false
		const num = this.currentPlus === 0 ? 1 : this.currentPlus
		const newCards = this.cards.splice(this.cards.length - 1 - num, num);
		player.push(...newCards)
		this.currentPlus = 0
		this.lastCard = null
		this.currentValue = -1
		this.currentColor = CardColor.all
		return true
	}
}