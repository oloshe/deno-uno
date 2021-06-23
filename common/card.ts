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

export enum CardDirection{
  /** 顺时针 */
  Clockwise,
  /** 逆时针 */
  AntiClockwise,
}

const colorMap: Record<CardColor, string> = {
  [CardColor.blue]: '🔵 ' ,
  [CardColor.green]: '🟢 ',
  [CardColor.red]: '🔴 ',
  [CardColor.yellow]: '🟡 ',
  [CardColor.all]: '',
}
const valueMap: Record<Exclude<CardType, CardType.number>, string> = {
  [CardType.plus2]: '➕ 2️⃣',
  [CardType.reverse]: '🔄',
  [CardType.skip]: '⤴️',
  [CardType.plus4]: '➕ 4️⃣',
  [CardType.colorSwitch]: '🎲',
}
const numberMap: string[] = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣']
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
    const colorFlag = colorMap[this.color]
    const valueFlag = this instanceof NumberCard
      ? numberMap[this.value]
      // @ts-ignore 
      : valueMap[this.type]
    return `${colorFlag}${valueFlag}`
  }
}

export class CardFactory {
  /** 具像化， 把基类转为具体类 */
  static concretization(card: { type: number, color: number, value?: number }) {
    const {
      type, color, value
    } = card;
    switch (type) {
      case CardType.number: return new NumberCard(value!, color)
      case CardType.plus2: return new Plus2Card(color)
      case CardType.reverse: return new ReverseCard(color)
      case CardType.skip: return new SkipCard(color)
      case CardType.colorSwitch: return new ColorSwitchCard()
      case CardType.plus4: return new Plus4Card()
      default: throw new Error('data parse error')
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
    return `${this.value}`
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
    return '+2️'
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
    return '倒转'
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
    return `跳过`
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
    return `变色`
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
    return '+4'
  }
}

/**
 * 牌堆
 */
export class cardStack {
  cards: Card[]
  constructor(arr: Card[]) {
    this.cards = arr;
  }
  /** 抽牌 */
  draw() {
    return this.cards.pop()
  }
}