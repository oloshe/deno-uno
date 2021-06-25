import { ws, MyEvent, Dialoguer, Cache, IRoomRes, PlayerData, Deferred, deferred, GameState, Card, CardFactory, CardColor, UserState, Keypress, visualColor } from "../deps.ts"

export async function joinRoom(id: string) {
	console.clear()
	const ret = await ws.sendFuture(MyEvent.JoinRoom, { id })
	if (ret.succ) {
		await gamePage()
	} else {
		console.log('join room fail!');
	}
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
			players[data.playerData._sockid].status = UserState.Leave;
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
				loop.players[id].status = state
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
				playersCardsNum,
			} = data
			clockwise !== void 0 && (loop.clockwise = clockwise)
			turn !== void 0 && (loop.turn = turn)
			color !== void 0 && (loop.currentColor = color)
			plus !== void 0 && (loop.currentPlus = plus)
			cardNum !== void 0 && (loop.cardNum = cardNum)
			gameStatus !== void 0 && (loop.gameState = gameStatus)
			playersCardsNum !== void 0 && Object.assign(loop.playersCardsNum, playersCardsNum)
			lastCard !== void 0 && (loop.lastCard = lastCard ? CardFactory.concretization(lastCard) : lastCard)
			cards !== void 0 && (loop.cards = cards.map(x => CardFactory.concretization(x)))
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
	players: Record<string, PlayerData>
	// 我自己的卡
	cards: Card[] = []
	playersCardsNum: Record<string, number> = {}
	// 卡牌堆里面的卡牌数量
	cardNum = 107
	lastCard: Card | null = null

	gameState = GameState.Ready
	currentColor: CardColor = CardColor.all
	currentPlus = 0
	turn = ''
	clockwise = true
	myId: string = Cache.get(MyEvent.Login)!.userId

	signal: Deferred<boolean>
	_inputting = false

	static red = Dialoguer.colors.red

	constructor(roomData: IRoomRes, players: Record<string, PlayerData>) {
		this.roomData = roomData
		this.players = players
		this.signal = deferred()
	}

	render() {
		// console.log('game status', this.gameState)
		switch (this.gameState) {
			case GameState.Ready: this.renderReadyState(); break;
			case GameState.Start: this.renderGame(); break;
		}
	}

	exploreMyCard(filter?: (index: number, card: Card) => boolean) {
		this.cards.forEach((card, index) => {
			if (!filter || filter(index, card)) {
				console.log('  ' + card.toColorString());
			}
		})
	}

	async renderGame() {
		console.clear()
		Dialoguer.Table
			.header(['cardNum', 'plus', 'closewise', 'last card', 'color'])
			.body([[
				this.cardNum,
				this.currentPlus || 0,
				this.clockwise ? 'yes' : 'no',
				!this.lastCard ? 'empty' : this.lastCard.toColorString(this.currentColor),
				visualColor(this.currentColor),
			]])
			.padding(2)
			.border(true)
			.render()
		
		Dialoguer.tty.cursorNextLine(1);
		
		let turnPeople = 'another'
		Dialoguer.Table
			.header(['nick', 'turn', 'cardNum', 'status'])
			.body(Object.keys(this.players).map(key => {
				const p = this.players[key]
				const turn = this.turn === key ? 'yes' : ''
				if (turn) {
					turnPeople = p.nick
				}
				return [
					p.nick,
					turn,
					this.playersCardsNum[key] || '',
					userStateMap[p.status] || '',
				]
			}))
			.padding(2)
			.border(true)
			.render()
		
		Dialoguer.tty.cursorNextLine(1);
		
		if (this.turn !== this.myId) {
			this.exploreMyCard()
			Dialoguer.tty.cursorNextLine(1).text(`wait for ${Dialoguer.colors.blue.underline(turnPeople)} to play card`).cursorNextLine(1);
		} else {
			const select = await Dialoguer.Select({
				title: 'please choose a card',
				items: [...this.cards.map((x, index) => {
					return {
						name: x.toColorString() + ' ' + visualColor(x.color),
						value: index.toString(),
						disabled: !x.judge(this.lastCard, this.currentColor),
					}
				}), ...[
					'draw a card',
				]]
			})
			switch (select) {
				case 'draw a card': ws.send(MyEvent.DrawCard, null); break;
				default: {
					const index = parseInt(select)
					let color: CardColor | undefined
					if (this.cards[index].color === CardColor.all) {
						this.exploreMyCard((idx) => idx !== index);
						const ret = await Dialoguer.Select({
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
					const ret = await ws.sendFuture(MyEvent.PlayCard, { index: parseInt(select), color });
					if (!ret) this.update()
					break;
				} 
			}
		}
	}

	async renderReadyState() {
		if (this._inputting) return
		console.clear()
		Dialoguer.tty.clearTerminal.text(`[${this.roomData.count}/${this.roomData.max}]`).cursorNextLine(2);
		// new Array(this.roomData.max).fill(0).forEach((_, index) => {
		// 	const p = this.players[Object.keys(this.players)[index]]
		// 	if (!p) {
		// 		Dialoguer.tty.text(Dialoguer.colors.gray('empty'))
		// 	} else {
		// 		const fn = p.status === UserState.Ready ? Dialoguer.colors.bgBrightBlue.white.underline : Dialoguer.colors.white
		// 		Dialoguer.tty.text(fn(p.nick || ''))
		// 	}
		// })

		Dialoguer.Table
			.header(['player', 'ready'])
			.body(new Array(this.roomData.max).fill(0).map((_, index) => {
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
		if (this.players[this.myId].status !== UserState.Ready) {
			this._inputting = true
			const ret = await Dialoguer.Select({
				title: 'please select',
				items: ['ready', 'leave']
			})
			this._inputting = false
			if (ret === 'ready') {
				const succ = await ws.sendFuture(MyEvent.Ready, null)
				if (!succ) {
					console.log('ready fail, press any key to continue.')
					await new Keypress()
					this.update()
				}
			} else {
				this.end()
			}
		}
	}

	update() {
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