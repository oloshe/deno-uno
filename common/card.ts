import { Dialoguer } from "../deps.ts";

/**
 * 牌颜色
 */
export enum CardColor {
	/** 黄色 */
	yellow,
	/** 红色 */
	red,
	/** 蓝色 */
	blue,
	/** 绿色 */
	green,
	/** 全色 */
	all,
}

export enum CardType {
	/** 数字牌 */
	number,
	/** +2牌 */
	plus2,
	/** 倒转牌 */
	reverse,
	/** 跳过牌 */
	skip,
	/** +4牌 */
	plus4,
	/** 变色牌 */
	colorSwitch,
}

export const colorEmojiMap: Record<CardColor, string> = {
	[CardColor.yellow]: "🟡",
	[CardColor.red]: "🔴",
	[CardColor.blue]: "🔵",
	[CardColor.green]: "🟢",
	[CardColor.all]: ''
};
export const colorFn = (color: CardColor, str: string) => {
	switch(color){
		case CardColor.yellow: return Dialoguer.colors.brightYellow.underline(str)
		case CardColor.red: return Dialoguer.colors.brightRed.underline(str)
		case CardColor.blue: return Dialoguer.colors.brightBlue.underline(str)
		case CardColor.green: return Dialoguer.colors.brightGreen.underline(str)
		case CardColor.all: return Dialoguer.colors.white.underline(str)
		default: return '';
	}
}
const valueMap: Record<CardType, string> = {
	[CardType.number]: "",
	[CardType.plus2]: "➕2️⃣",
	[CardType.reverse]: "🔄",
	[CardType.skip]: "⤴️",
	[CardType.plus4]: "➕4️⃣",
	[CardType.colorSwitch]: "🎲",
};
export const colorNameMap: Record<CardColor, string> = {
	[CardColor.yellow]: "yellow",
	[CardColor.red]: "red",
	[CardColor.blue]: "blue",
	[CardColor.green]: "green",
	// necessary
	[CardColor.all]: 'all',
}
const numberMap: string[] = [
	"0️⃣",
	"1️⃣",
	"2️⃣",
	"3️⃣",
	"4️⃣",
	"5️⃣",
	"6️⃣",
	"7️⃣",
	"8️⃣",
	"9️⃣",
];
export function visualColor(color: CardColor | null) {
	let ret: string
	if (color) {
		const str = colorNameMap[color]
		ret = colorFn(color, str)
	} else {
		ret = 'empty'
	}
	return ret
}
/**
 * 卡牌
 */
export abstract class Card {
	color: CardColor;
	type: CardType;
	constructor(type: CardType, color: CardColor) {
		this.type = type;
		this.color = color;
	}
	abstract toString(): string;
	toStringUnicode() {
		const colorFlag = colorEmojiMap[this.color] ? colorEmojiMap[this.color] + ' ' : '';
		const valueFlag = this instanceof NumberCard ? numberMap[this.value] : valueMap[this.type];
		return `${colorFlag}${valueFlag} `;
	}
	toColorString(color?: CardColor) {
		const _color = color ?? this.color
		return colorFn(_color, this.toString())
	}
	abstract judge(card: Card | null, color?: CardColor): boolean;
}

export class CardFactory {
	/** 具像化， 把基类转为具体类 */
	static concretization(card: { type: number; color: number; value?: number }) {
		const {
			type,
			color,
			value,
		} = card;
		switch (type) {
			case CardType.number:
				return new NumberCard(value!, color);
			case CardType.plus2:
				return new Plus2Card(color);
			case CardType.reverse:
				return new ReverseCard(color);
			case CardType.skip:
				return new SkipCard(color);
			case CardType.colorSwitch:
				return new ColorSwitchCard();
			case CardType.plus4:
				return new Plus4Card();
			default:
				throw new Error("data parse error");
		}
	}
}

/**
 * 数字牌
 */
export class NumberCard extends Card {
	value: number;
	constructor(value: number, color: CardColor) {
		super(CardType.number, color);
		this.value = value;
	}
	toString() {
		return `Number[${this.value}]`;
	}
	judge(card: Card | null, color?: CardColor) {
		if (!card) return true
		if (this.color === card.color) {
			return true
		}
		if (card instanceof NumberCard && this.value === card.value) {
			return true
		}
		if (card.color === CardColor.all && color === this.color) {
			return true
		}
		return false
	}
}

/**
 * +2牌
 */
export class Plus2Card extends Card {
	constructor(color: CardColor) {
		super(CardType.plus2, color);
	}
	toString() {
		return "Draw Two (+2)";
	}
	judge(card: Card | null, color?: CardColor) {
		if (!card) return true
		// 都是 +2 牌
		if (card instanceof Plus2Card) return true
		if (card.color === CardColor.all && color === this.color) {
			return true
		}
		return this.color === card.color
	}
}

/**
 * 倒转牌
 */
export class ReverseCard extends Card {
	constructor(color: CardColor) {
		super(CardType.reverse, color);
	}
	toString() {
		return "Reverse";
	}
	judge(card: Card | null, color?: CardColor) {
		if (!card) return true
		if (card instanceof ReverseCard) return true
		if (card.color === CardColor.all && color === this.color) {
			return true
		}
		return this.color === card.color
	}
}

/**
 * 跳过牌
 */
export class SkipCard extends Card {
	constructor(color: CardColor) {
		super(CardType.skip, color);
	}
	toString() {
		return `Skip`;
	}
	judge(card: Card | null, color?: CardColor) {
		if (!card) return true
		if (card instanceof SkipCard) return true
		if (card.color === CardColor.all && color === this.color) {
			return true
		}
		return this.color === card.color
	}
}

/**
 * 变色牌
 */
export class ColorSwitchCard extends Card {
	constructor() {
		super(CardType.colorSwitch, CardColor.all);
	}
	toString() {
		return `Wild`;
	}
	judge() {
		return true
	}
}

/**
 * +4牌
 */
export class Plus4Card extends Card {
	constructor() {
		super(CardType.plus4, CardColor.all);
	}
	toString() {
		return "Wild Draw Four (+4)";
	}
	judge() {
		return true
	}
}

/**
 * 牌堆
 */
export class cardStack {
	cards: Card[];
	constructor(arr: Card[]) {
		this.cards = arr;
	}
	/** 抽牌 */
	draw() {
		return this.cards.pop();
	}
}
