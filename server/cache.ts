import { GameState, IRoomRes, PlayerData } from "../common/mod.ts"
import { MyEvent, PushData } from "../common/event.ts";
import { WebSocket } from "../deps.ts"
import { Logger } from "./logger.ts";
import { PM } from "./processMgr.ts";

type sockid = string
type roomid = string

export class Connection {
	private static _data: Record<sockid, WebSocket | undefined> = {}
	private static _count = 0;

	static get(id: string): WebSocket | null {
		return this._data[id] || null
	}
	static add(id: string, sock: WebSocket) {
		if (this._data[id]) {
			return false
		} else {
			++this._count
			this._data[id] = sock
			return true
		}
	}
	static del(id: string) {
		PlayerCollection.exitRoom(id)
		PlayerCollection.del(id)
		--this._count;
		return delete this._data[id]
	}
	static sendTo<T extends MyEvent>(event: T, sockid: sockid, data: PushData<T>) {
		const sock = this.get(sockid)
		if (sock) {
			if (!sock.isClosed) {
				sock.send(JSON.stringify({ func: event, data }))
			}
		}
	}
}

export class PlayerCollection {
	private static _data: Record<sockid, PlayerData | undefined> = {};
	static get playerCount() {
		return Object.keys(this._data).length
	}
	static add(id: sockid, data: PlayerData) {
		this._data[id] = data;
		return true
	}
	static set(id: sockid, data: Partial<PlayerData>) {
		if (this._data[id]) {
			Object.assign(this._data[id], data)
			return true
		} else {
			return false
		}
	}
	static get(id: sockid): PlayerData | null;
	static get<T extends keyof PlayerData>(id: sockid, field: T): PlayerData[T] | null;
	static get(id: sockid, field?: keyof PlayerData) {
		const target = this._data[id]
		if (!target) return null
		else return field ? target[field] : this._data[id]
	}
	static del(id: sockid) {
		delete this._data[id]
	}
	static joinRoom(sockid: sockid, roomid: roomid, pwd?: string) {
		const oldRoomid = PlayerCollection.get(sockid, 'roomid')
		// 已经在房间内 && 房间内实际数据存在
		if (oldRoomid && oldRoomid != roomid && Rooms.playerInThisRoom(oldRoomid, sockid)) {
			return false
		}
		const room = Rooms.getRoom(roomid)
		// 房间不存在
		if (!room) { return false }
		// 游戏已经开始
		if (room.status === GameState.Start) { return false }
		// 密码不正确
		if (room.pwd && room._pwd !== pwd) { return false }
		// 超过人数范围
		if (room.count >= room.max) { return false }
		// 设置用户房间
		PlayerCollection.set(sockid, { roomid: room.id })
		Rooms.broadcastJoin(sockid, room)
		return true
	}
	static exitRoom(sockid: sockid) {
		const roomid = PlayerCollection.get(sockid, 'roomid')
		if (!roomid) { return }
		PlayerCollection.set(sockid, { roomid: null });
		// 广播房间内 移除玩家
		Rooms.broadcastExit(roomid, sockid)
		const room = Rooms.getRoom(roomid), players = Rooms.getRoomPlayers(roomid);
		if (room && players) {
			const len = Object.keys(players).length
			room.count = len
			if (len === 0) {
				// 全部玩家都走完，删除房间
				Rooms.del(roomid)
			}
		}
	}
}

export class Rooms {
	private static _roomList: IRoomRes[] = []
	private static _roomPlayer: Record<roomid, Record<sockid, PlayerData | undefined> | undefined> = {}
	private static _gameProcess: Record<roomid, PM> = {}
	static get roomCount() {
		return this._roomList.length
	}
	static add(roomData: IRoomRes) {
		const roomid = roomData.id
		this._roomList.push(roomData);
		this._roomPlayer[roomid] = {}
	}
	static getRoom(roomid: roomid) {
		return this._roomList.find(x => x.id === roomid)
	}
	static getList(no: number, num: number) {
		const start = (no - 1) * num
		return {
			list: this._roomList.slice(start, start + num).map(itm => ({
				...itm,
				_pwd: void 0,
			})),
			no, max: Math.ceil(this._roomList.length / no)
		}
	}
	static getRoomPlayers(roomid: roomid) {
		return this._roomPlayer[roomid]
	}
	static getRoomPlayer(roomid: roomid, sockid: sockid) {
		return this.getRoomPlayers(roomid)?.[sockid]
	}
	static getGameProcess(sockid: sockid): PM | null {
		return this._gameProcess[sockid] || null
	}
	static playerInThisRoom(sockid: sockid, roomid: roomid) {
		return !!(this.getRoomPlayers(roomid)?.[sockid])
	}
	static setRoom(roomid: IRoomRes | roomid, data: Partial<IRoomRes>): boolean {
		let room: IRoomRes | undefined
		if (typeof roomid === 'string') {
			room = this.getRoom(roomid)
		} else {
			room = roomid
		}
		if (!room) return false
		Object.assign(room, data);
		return true
	}
	static del(roomid: roomid) {
		const idx = this._roomList.findIndex(x => x.id === roomid)
		if (idx === -1) return false
		this._roomList.splice(idx, 1)
		delete this._roomPlayer[roomid]
		delete this._gameProcess[roomid]
	}
	static roomBroadcast(
		roomid: roomid,
		option: {
			before?: (datas: Record<sockid, PlayerData | undefined>) => void,
			callback: (sockid: sockid, data: PlayerData) => void,
			after?: (datas: Record<sockid, PlayerData | undefined>) => void
		}
	) {
		const rp = this._roomPlayer[roomid];
		if (!rp) return
		option.before?.(rp)
		Object.keys(rp).forEach(sid => {
			const data = rp[sid];
			data && option.callback(sid, data)
		})
		option.after?.(rp)
		return rp
	}
	static broadcastJoin(id: string, roomData: IRoomRes) {
		let len: number, playerData: PlayerData | null;
		const roomid = roomData.id
		this.roomBroadcast(roomid, {
			before: (data) => {
				len = Object.keys(data).length + 1;
				playerData = PlayerCollection.get(id);
			},
			callback: (sid) => {
				playerData && Connection.sendTo(MyEvent.PlayerJoinRoom, sid, {
					playerData: playerData,
					roomData: { count: len }
				})
			},
			after: data => {
				if (playerData) {
					// 添加用户进入房间数据内
					data[id] = playerData
					// 房间存在
					roomData && (roomData.count = Object.keys(data).length)
					Logger.log('[join room]', roomid)
				}
			}
		})
	}
	static broadcastExit(roomid: roomid, sockid: sockid) {
		let len: number
		return this.roomBroadcast(roomid, {
			before: (data) => {
				// 删除房间内该玩家数据
				delete data[sockid]
				len = Object.keys(data).length
			},
			callback: (sid) => {
				// 广播房间内玩家
				Connection.sendTo(MyEvent.PlayerExitRoom, sid, {
					playerData: { _sockid: sockid },
					roomData: { count: len }
				})
			},
			after: (datas) => {
				const pm = this.getGameProcess(roomid), keys = Object.keys(datas)
				// 剩下1个人就游戏结束
				if (keys.length === 1 && pm?.life) {
					const winner = keys[0]
					pm.onGameOver(winner)
					Connection.sendTo(MyEvent.GameMeta, winner, {
						winner,
						gameStatus: GameState.End,
					})
				}
				pm?.onUserLeave(sockid)
			}
		})
	}
	static roomStart(roomid: roomid, players: Record<string, unknown>) {
		Rooms.setRoom(roomid, { status: GameState.Start })
		const pm = new PM(roomid, players)
		this._gameProcess[roomid] = pm
		this.roomBroadcast(roomid, {
			callback: (sid) => {
				const data = {
					cards: pm.players[sid],
					color: pm.currentColor,
					turn: Object.keys(pm.players)[pm.turn],
					clockwise: pm.clockwise,
					cardNum: pm.cardNum,
					gameStatus: GameState.Start,
					playersCardsNum: Object.keys(pm.players).reduce<Record<string, number>>((p, cur) => {
						p[cur] = pm.players[cur].length
						return p
					}, {})
				}
				console.log(data)
				Connection.sendTo(MyEvent.GameMeta, sid, data)
			}
		})
	}
}