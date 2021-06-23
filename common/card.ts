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
    return '+2'
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