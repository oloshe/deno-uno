import { v4, WebSocket } from "../deps.ts";
import { Connection, PlayerCollection, Rooms } from "./cache.ts";
import { Logger } from "./logger.ts";
import { ServerConf } from "./server.config.ts";
import { ReqData, GameState, UserState, EventData, MyEvent, ResponseData, ResponseEventDataDefine } from "../common/mod.ts";
import { PM } from "./processMgr.ts";

const map: Record<string, (data: unknown) => void> = {};

function Event(event: MyEvent): MethodDecorator {
	return (target, propertyKey) => {
		const func = Reflect.get(target, propertyKey)
		map[event] = func
	}
}

export class EventRouter {
	/** sockid  */
	sid: string
	sock: WebSocket
	constructor(id: string, sock: WebSocket) {
		this.sid = id
		this.sock = sock
	}
	response<T extends keyof ResponseEventDataDefine>(func: T, data: ResponseData<T>) {
		this.sock.send(JSON.stringify({ func, data }))
	}
	handle(req: ReqData<never>) {
		const { func, data } = req
		const executor = map[func];
		executor.call(this, data)
	}

	@Event(MyEvent.OnlineNum) 
	online(){
		this.response(MyEvent.OnlineNum, Connection.count)
	}

	@Event(MyEvent.Login)
	login(data: EventData<MyEvent.Login>) {
		let succ = true, reason: string | undefined
		if (data.cv != ServerConf.sv) {
			// 客户端版本与服务器不一致
			succ = false
			reason = 'version'
		}
		if (PlayerCollection.playerCount >= ServerConf.maxPlayer) {
			// 在线人数超过设定上限
			succ = false
			reason = 'count_limit'
		}
		if (succ) {
			Logger.log(`[login]`, data.nick)
			succ = PlayerCollection.add(this.sid, { nick: data.nick, status: UserState.Online, _sockid: this.sid })
		}
		this.response(MyEvent.Login, {
			succ,
			userId: this.sid,
			reason,
		});
	}

	@Event(MyEvent.ChangeNick)
	changeNick(data: EventData<MyEvent.ChangeNick>) {
		const succ = PlayerCollection.set(this.sid, { nick: data })
		this.response(MyEvent.ChangeNick, { succ })
	}

	@Event(MyEvent.GetRoomList)
	getRoomList(data: EventData<MyEvent.GetRoomList>) {
		const list = Rooms.getList(data.no, data.num)
		this.response(MyEvent.GetRoomList, list);
	}

	@Event(MyEvent.CreateRoom)
	createRoom(data: EventData<MyEvent.CreateRoom>) {
		let succ = true
		const id = v4.generate()
		if (Rooms.roomCount > ServerConf.maxRoom) {
			succ = false
		} else {
			// 添加房间
			Rooms.add({
				...data as EventData<MyEvent.CreateRoom>,
				id,
				createTime: Date.now(),
				count: 0,
				ownerId: this.sid,
				status: GameState.Ready,
				pwd: !!data._pwd,
			});
		}
		// 加入房间
		this.response(MyEvent.CreateRoom, { succ, roomid: id })
	}

	@Event(MyEvent.JoinRoom)
	joinRoom(data: EventData<MyEvent.JoinRoom>) {
		const succ = PlayerCollection.joinRoom(this.sid, data.id, data.pwd)
		if (!succ) {
			this.response(MyEvent.JoinRoom, { succ })
		} else {
			this.response(MyEvent.JoinRoom, {
				succ,
				players: Rooms.getRoomPlayers(data.id),
				roomData: Rooms.getRoom(data.id),
			})
		}
	}

	@Event(MyEvent.ExitRoom)
	exitRoom() {
		PlayerCollection.exitRoom(this.sid)
	}

	@Event(MyEvent.Ready)
	ready() {
		const roomid = PlayerCollection.get(this.sid, 'roomid')
		let succ = true
		if (roomid) {
			const player = Rooms.getRoomPlayer(roomid, this.sid)
			if (player) {
				player.status = UserState.Ready
				Rooms.roomBroadcast(roomid, {
					callback(sid) {
						Connection.sendTo(MyEvent.RoomUserState, sid, [player._sockid, player.status])
					},
					after(datas) {
						const roomData = Rooms.getRoom(roomid)
						if (!roomData) return
						// 满人且所有玩家准备，则开始游戏
						if (roomData.count !== roomData.max) return
						const everybodyReady = Object.keys(datas).every(key => datas[key]!.status === UserState.Ready)
						everybodyReady && Rooms.roomStart(roomid, datas)
					}
				})
			} else {
				succ = false
			}
		} else {
			succ = false
		}
		this.response(MyEvent.Ready, { succ })
	}

	@Event(MyEvent.PlayCard)
	playcard(data: EventData<MyEvent.PlayCard>) {
		const { index, color } = data
		const roomid = PlayerCollection.get(this.sid, 'roomid')
		if (!roomid) { return }
		const pm = Rooms.getGameProcess(roomid)
		const succ = pm?.playCard(this.sid, index, color) ?? false
		this.response(MyEvent.PlayCard, { succ })
		if (succ && pm) {
			this._afterPlaySucc(roomid, pm)
		}
	}

	_afterPlaySucc(roomid: string, pm: PM) {
		const cardNum = pm.players[this.sid].length
		const winner = cardNum === 0 ? this.sid : void 0
		Rooms.roomBroadcast(roomid, {
			before: () => {
				winner && pm.onGameOver(winner)
			},
			callback: (sid) => {
				Connection.sendTo(MyEvent.GameMeta, sid, {
					turn: pm.turnPlayerId,
					clockwise: pm.clockwise,
					color: pm.currentColor,
					plus: pm.currentPlus,
					cardNum: pm.cardNum,
					lastCard: pm.lastCard!,
					cards: sid === this.sid ? pm.players[this.sid] : void 0,
					playersCardsNum: {
						[this.sid]: cardNum
					},
					gameStatus: winner ? GameState.End : void 0,
					winner,
				})
				winner
					&& PlayerCollection.set(sid, { status: UserState.Online })
					&& Connection.sendTo(MyEvent.RoomUserState, sid, [sid, UserState.Online])
			},
		})
	}

	@Event(MyEvent.DrawCard)
	drawcard() {
		const roomid = PlayerCollection.get(this.sid, 'roomid')
		if (!roomid) return
		const pm = Rooms.getGameProcess(roomid)
		if (!pm) return
		const succ = pm.drawCard(this.sid) ?? [false]
		this.response(MyEvent.DrawCard, { succ })
		if (succ && pm) {
			const isEnd = pm.cardNum === 0
			let winner: string | undefined;
			if (isEnd) {
				winner = pm.onGameOver(void 0)
			}
			Rooms.roomBroadcast(roomid, {
				callback: (otherId) => {
					Connection.sendTo(MyEvent.GameMeta, otherId, {
						cards: otherId === this.sid ? pm.players[this.sid] : void 0,
						cardNum: pm.cardNum,
						plus: pm.currentPlus,
						lastCard: pm.lastCard,
						color: pm.currentColor,
						turn: pm.turnPlayerId,
						playersCardsNum: {
							[this.sid]: pm.players[this.sid].length
						},
						winner,
						gameStatus: isEnd ? GameState.End : void 0,
					})
				}
			})
		}
	}

	// @Event(MyEvent.SkipCard)
	// skip() {
	// 	const roomid = PlayerCollection.get(this.sid, 'roomid');
	// 	if (!roomid) return
	// 	const pm = Rooms.getGameProcess(roomid)
	// 	if (!pm) return
	// 	pm.nextTurn(1)
	// 	this.response(MyEvent.SkipCard, { succ: true })
	// 	Rooms.roomBroadcast(roomid, {
	// 		callback(sid) {
	// 			Connection.sendTo(MyEvent.GameMeta, sid, {
	// 				turn: pm.turnPlayerId
	// 			})
	// 		}
	// 	})
	// }
}