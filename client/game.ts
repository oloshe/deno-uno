import { ws, MyEvent, Dialoguer, Cache, IRoomRes, PlayerData, Deferred, deferred, GameState, Card, readLines, CardFactory, CardColor, colorMap } from "../deps.ts"

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
			delete players[data.playerData._sockid];
			roomData.count = data.roomData.count
			loop.update()
		}),
		// 游戏状态改变
		ws.on(MyEvent.GameStateChange, (data) => {
			loop.gameState = data
			// if (data === GameState.Start) console.clear()
			// loop.update()
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
			} = data
			clockwise && (loop.clockwise = clockwise)
			turn && (loop.turn = turn)
			color && (loop.currentColor = color)
			plus && (loop.currentPlus = plus)
			cardNum && (loop.cardNum = cardNum)
			gameStatus && (loop.gameState = gameStatus)
			lastCard !== void 0 && (loop.lastCard = lastCard ? CardFactory.concretization(lastCard) : lastCard)
			cards && (loop.cards = cards.map(x => CardFactory.concretization(x)))
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

class GameLoop {
	roomData: IRoomRes;
	players: Record<string, PlayerData>
	// 我自己的卡
	cards: Card[] = []
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
		console.clear()
		// console.log('game status', this.gameState)
		switch (this.gameState) {
			case GameState.Ready: this.renderReadyState(); break;
			case GameState.Start: this.renderGame(); break;
		}
	}

	exploreMyCard(filter?: (index: number, card: Card) => boolean) {
		this.cards.forEach((card, index) => {
			if (!filter || filter(index, card)) {
				console.log(card.toStringUnicode());
			}
		})
	}

	async renderGame() {
		console.log(`[card num:${this.cardNum}] [plus:${this.currentPlus}] [${this.clockwise ? 'clockwise' : 'anticlockwise'}] 
		\r${this.lastCard ? this.lastCard.toStringUnicode() : ''} ${this.currentColor && this.currentColor !== CardColor.all ? colorMap[this.currentColor] : ''}`)
		console.log('-------------------------')
		if (this.turn === this.myId) {
			this.exploreMyCard()
		} else {
			const select = await Dialoguer.Select({
				title: 'please choose a card',
				items: [...this.cards.map((x, index) => {
					return {
						name: x.toStringUnicode(),
						value: index.toString(),
						disabled: !x.judge(this.lastCard),
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
						this.exploreMyCard((idx) => idx === index);
						const ret = await Dialoguer.Select({
							title: 'choose a color',
							items: Object.keys(colorMap).map(key => {
								return {
									// @ts-ignore 
									name: colorMap[key],
									value: key
								}
							})
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

	renderReadyState() {
		console.clear()
		Dialoguer.tty.text(`[${this.roomData.count}/${this.roomData.max}]`).cursorNextLine(2);
		
		new Array(this.roomData.max).fill(0).forEach((_, index) => {
			const p = this.players[Object.keys(this.players)[index]]
			console.log(`${p?.nick ? Dialoguer.colors.bgBlue(p.nick) : Dialoguer.colors.gray('empty')}`)
		})
		Dialoguer.tty
			.cursorDown(1)
			.text('game will start when room is full')
			.cursorNextLine(2)
			.text(`input ${GameLoop.red('quit(q)')} or ${GameLoop.red('exit(e)')} to leave this room`)
			.cursorNextLine();

		if (!this._inputting) {
			// this._inputting = true
			// const buf = new Uint8Array(1024)
			// const read = async () => {
			// 	const n = await Deno.stdin.read(buf)
			// 	// Deno.stdin.read(buf).then(n => {
			// 	// 	this._inputting = false
			// 		if (n !== null) {
			// 			const str = new TextDecoder().decode(buf.subarray(0, n)).trim()
			// 			switch (str) {
			// 				case 'quit': case 'q': case 'exit': case 'e': this.end(); break;
			// 				default: Dialoguer.tty.text(`Invalid command: ${str}\n`); read();
			// 			}
			// 		}
			// 	// })
			// }
			// read()
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