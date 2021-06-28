import {
	Deferred, deferred, Keypress
} from "../deps.ts"
import { ws } from "./net/ws.ts"
import { MyEvent } from "../common/event.ts"
import { Cache } from "./cache.ts"
import { IRoomRes } from "../common/room.ts"
import { Dialoguer } from "./dialoguer.ts"
import { PlayerData } from "../common/user.ts"
import { GameState, UserState } from "../common/state.ts"
import { CardColor, CardFactory, visualColor, Card } from "../common/card.ts"

type SelectParam = Parameters<typeof Dialoguer.Select>[0];

export async function joinRoom(id: string, pwd?: string) {
	const ret = await ws.sendFuture(MyEvent.JoinRoom, { id, pwd })
	if (ret.succ) {
		await gamePage()
	} else {
		console.log('join room fail!\npress any key to continue');
		await new Keypress()
	}
	return !!ret.succ
}

export async function gamePage() {
	console.clear()
	console.log('Game')

	const _c = Cache.get(MyEvent.JoinRoom);
	if (!_c || !_c.roomData || !_c.players) {
		return
	}
	const { roomData, players } = _c

	const listenList = [
		// 用户加入房间
		ws.on(MyEvent.PlayerJoinRoom, (data) => {
			players[data.playerData._sockid] = data.playerData;
			roomData.count = data.roomData.count
			loop.update()
		}),
		// 用户离开房间
		ws.on(MyEvent.PlayerExitRoom, (data) => {
			const sid = data.playerData._sockid
			if (loop.gameState === GameState.Start) {
				// 游戏开始后不直接删除玩家，而是标记玩家已经离开
				players[sid] && (players[sid]!.status = UserState.Leave);
			} else {
				delete players[sid]
			}
			roomData.count = data.roomData.count
			loop.update()
		}),
		// 游戏状态改变
		ws.on(MyEvent.GameStateChange, (data) => {
			loop.gameState = data
			// if (data === GameState.Start) console.clear()
			// loop.update()
		}),
		ws.on(MyEvent.RoomUserState, (data) => {
			const [id, state] = data;
			if (loop.players[id]) {
				loop.players[id]!.status = state
				loop.update()
			}
		}),
		ws.on(MyEvent.GameMeta, (data) => {
			const {
				clockwise,
				turn,
				color,
				cards,
				plus,
				cardNum,
				gameStatus,
				lastCard,
				drawedIndex,
				playersCardsNum,
				playerState,
				winner,
				playerPoint,
			} = data
			clockwise !== void 0 && (loop.clockwise = clockwise)
			turn !== void 0 && (loop.turn = turn)
			color !== void 0 && (loop.currentColor = color)
			plus !== void 0 && (loop.currentPlus = plus)
			cardNum !== void 0 && (loop.cardNum = cardNum)
			gameStatus !== void 0 && (loop.gameState = gameStatus)
			winner !== void 0 && (loop.winner = winner)
			playerPoint !== void 0 && Object.assign(loop.playerPoint, playerPoint)
			playersCardsNum !== void 0 && Object.assign(loop.playersCardsNum, playersCardsNum)
			lastCard !== void 0 && (loop.lastCard = lastCard ? CardFactory.concretization(lastCard) : lastCard)
			cards !== void 0 && (loop.cards = cards.map(x => CardFactory.concretization(x)))
			
			if (playerState !== void 0) {
				const [pid, state] = playerState
				loop.players[pid] && (loop.players[pid]!.status = state)
			}
			loop.update()
		})
	]

	const loop = new GameLoop(roomData, players)

	for await (const _ of loop) {
		await loop.render()
	}

	ws.send(MyEvent.ExitRoom, null)
	listenList.forEach(subcriber => subcriber.off())
}

const userStateMap: Record<UserState, string> = {
	[UserState.Online]: Dialoguer.colors.bgBrightBlue('online'),
	[UserState.Ready]: 'ready',
	[UserState.Leave]: Dialoguer.colors.gray('leave'),
	[UserState.Offline]: 'offline',
}

class GameLoop {
	roomData: IRoomRes;
	players: Record<string, PlayerData | undefined>
	// 我自己的卡
	cards: Card[] = []
	playersCardsNum: Record<string, number> = {}
	// 卡牌堆里面的卡牌数量
	cardNum = 0
	lastCard: Card | null = null

	gameState = GameState.Ready
	currentColor: CardColor = CardColor.all
	currentPlus = 0
	turn = '' // id
	turnName = 'other' // name
	clockwise = true
	myId: string = Cache.get(MyEvent.Login)!.userId
	winner = ''
	playerPoint: Record<string, number> = {}

	signal: Deferred<boolean>
	_inputting = false

	constructor(roomData: IRoomRes, players: Record<string, PlayerData | undefined>) {
		this.roomData = roomData
		this.players = players
		this.signal = deferred()
	}

	async render() {
		try {
			switch (this.gameState) {
				case GameState.Ready: await this.renderReadyState(); break;
				case GameState.Start: await this.renderGame(); break;
				case GameState.End: await this.renderGameEnd(); break;
			}
		} catch (e) {
			if (e.message === 'skip') return
			console.error(e)
		}
	}

	exploreMyCard(filter?: (index: number, card: Card) => boolean) {
		this.cards.forEach((card, index) => {
			if (!filter || filter(index, card)) {
				console.log('  ' + card.toColorString() + ' ' + visualColor(card.color),);
			}
		})
	}

	async renderGameEnd() {
		console.clear()
		this._renderGamingPlayer();
		if (this.winner === this.myId) {
			console.log('You Win!');
			console.log('press any key to continue');
		} else {
			console.log('Game Over')
			console.log(`The winner is ${this.players[this.winner]?.nick}`);
			console.log('press any key to continue');
		}
		await new Keypress()
		this.resetData()
		this.update()
	}

	resetData() {
		// 重制游戏状态
		this.gameState = GameState.Ready
		this.playerPoint = {}
		this.lastCard = null
		this.currentPlus = 0
		this.playersCardsNum = {}
		this.playerPoint = {}
		this.clockwise = true
		this.turnName = 'other'
		this.winner = ''
		// 删除离开的玩家
		for (const id in this.players) {
			const status = this.players[id]!.status
			if (status === UserState.Leave || status === UserState.Offline) {
				delete this.players[id]
			} else {
				this.players[id]!.status = UserState.Online
			}
		}
	}

	_renderGamingPlayer() {
		this.turnName = 'other'
		const header = ['nick', 'cardNum']
		if (this.gameState === GameState.End) {
			header.push('point')
		}
		Dialoguer.Table
			.header(header)
			.body(Object.keys(this.players).map(key => {
				const p = this.players[key]
				let nick = p?.nick || ''
				if (p!.status == UserState.Leave) {
					nick = Dialoguer.colors.gray(`${nick} (${userStateMap[UserState.Leave]})`)
				}
				// isMe
				key === this.myId && (nick = Dialoguer.colors.bgBlue.white(nick))
				
				const num = this.playersCardsNum[key]?.toString() || ''
				const ret = [
					nick,
					num,
				]
				if (this.gameState === GameState.End) {
					ret.push(this.playerPoint[key]?.toString() || '0')
				}
				if (num === '1') {
					ret.push('UNO!');
				} else if (num === '0' && this.winner === key) {
					ret.push('Winner!')
				}
				const turnToHe = this.turn === key
				if (turnToHe && !this.winner) {
					this.turnName = nick
					ret.forEach((str, idx) => ret && (ret[idx] = Dialoguer.colors.underline(str)))
				}
				return ret
			}))
			.padding(1)
			.border(true)
			.render()
		
		Dialoguer.tty.cursorNextLine(1);
	}

	renderCard(card: Card) {
		return card.toColorString() + ' ' + visualColor(card.color)
	}

	async renderGame() {
		console.clear()
		Dialoguer.Table
			.header(['cardNum', 'plus', 'closewise', 'last card', 'color'])
			.body([[
				this.cardNum.toString(),
				this.currentPlus.toString(),
				this.clockwise ? Dialoguer.colors.bgWhite.black.underline('yes') : Dialoguer.colors.bgBlack.white.underline('no'),
				!this.lastCard ? Dialoguer.colors.gray('empty') : this.lastCard.toColorString(this.currentColor),
				visualColor(this.currentColor),
			]])
			.padding(2)
			.border(true)
			.render()
		
		Dialoguer.tty.cursorNextLine(1);
		
		this._renderGamingPlayer()
		
		if (this.turn !== this.myId) {
			this.exploreMyCard()
			Dialoguer.tty.cursorNextLine(1)
				.text(`wait for ${Dialoguer.colors.blue.underline(this.turnName)} to play card`)
				.cursorNextLine(1);
		} else {
			const cmd = {
				draw: 'draw a card',
				skip: 'skip'
			} 
			if (!this.cards.length) {
				console.log(`you've run out of cards`)
				return
			}
			let activeNum = 0
			const itemsArray: SelectParam['items'] = this.cards.map((card, index) => {
				const disabled = !card.judge(this.lastCard, this.currentColor)
				!disabled && activeNum++
				return {
					name: this.renderCard(card),
					value: index.toString(),
					disabled: disabled,
				}
			})
			if (this.cardNum !== 0) { itemsArray.push({ name: cmd.draw, value: cmd.draw }) }
			// console.log(itemsArray)
			const select = await this.select({
				title: 'please choose a card',
				items: itemsArray,
			})
			switch (select) {
				case cmd.draw: {
					const ret = await ws.sendFuture(MyEvent.DrawCard, null);
					if (!ret.succ) {
						console.log('draw card fail. press any key to continue.');
						await new Keypress()
						this.update()
					}
					break;
				}
				default: {
					const index = parseInt(select)
					await this.playCard(index)
					break;
				} 
			}
		}
	}

	async playCard(index: number) {
		let color: CardColor | undefined
		if (!this.cards[index]) {
			this.update()
			return 
		}
		if (this.cards[index].color === CardColor.all) {
			this.exploreMyCard((idx) => idx !== index);
			const ret = await this.select({
				title: 'choose a color',
				items: [
					{ name: visualColor(CardColor.blue), value: CardColor.blue.toString() },
					{ name: visualColor(CardColor.green), value: CardColor.green.toString() },
					{ name: visualColor(CardColor.red), value: CardColor.red.toString() },
					{ name: visualColor(CardColor.yellow), value: CardColor.yellow.toString() },
				],
			})
			color = parseInt(ret) as CardColor
		}
		const ret = await ws.sendFuture(MyEvent.PlayCard, { index: index, color });
		if (!ret.succ) {
			console.log(`this card can't play. press any key to continue`)
			await new Keypress()
			this.update()
		}
	}

	async renderReadyState() {
		if (this._inputting) return
		console.clear()

		const room = this.roomData

		Dialoguer.tty
			.clearScreen
			.cursorForward(1)
			.text(Dialoguer.colors.bgYellow.black(`[${room.name}] [${room.count}/${room.max}]`))
			.cursorForward(1)
			.text(!room.pwd ? '' : Dialoguer.colors.bgBlack.white(`[password:${room._pwd}]`))
			.cursorNextLine(2);

		Dialoguer.Table
			.header(['player', 'ready'])
			.body(new Array(room.max).fill(0).map((_, index) => {
				const p = this.players[Object.keys(this.players)[index]]
				return p
					? [p.nick, p.status === UserState.Ready ? 'yes': 'not yet']
					: [Dialoguer.colors.gray('empty'), '']
			}))
			.border(true)
			.render();

		Dialoguer.tty
			.cursorNextLine(1)
			.text('game will start when everybody are ready')
			.cursorNextLine();

		// 未准备
		if (this.players[this.myId] && this.players[this.myId]!.status !== UserState.Ready) {
			const ret = await this.select({
				title: 'please select',
				items: ['ready', 'leave']
			})
			if (ret === 'ready') {
				const succ = await ws.sendFuture(MyEvent.Ready, null)
				if (!succ) {
					console.log('ready fail, press any key to continue.')
					await new Keypress()
					this.update()
				}
			} else if (ret === 'leave') {
				this.end()
			}
		}
	}

	async select(option: SelectParam) {
		if (!this._inputting) {
			this._inputting = true
			const ret = await Dialoguer.Select(option)
			this._inputting = false
			return ret
		}
		throw new Error('skip')
	}

	update() {
		if (this._inputting) return
		this.signal.resolve(true)
	}

	end() {
		console.log('end')
		this.signal.resolve(false)
	}

	async *[Symbol.asyncIterator]() {
		let life = true
		while (life) {
			this.signal = deferred()
			yield
			life = await this.signal
		}
	}
}