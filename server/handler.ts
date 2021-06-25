import { MyEvent, ReqData, EventData, WebSocket, v4, UserState, ResponseEventDataDefine, ResponseData, GameState } from "../deps.ts"
import { addRoomList, getRoomList, setPlayer, userExitRoom, userJoinRoom, getRoomPlayers, getRoomById, roomStart, getPlayerBySockId, getRoomProcess, roomPlayerForEach, sendBySockId, getRoomPlayer, addPlayer } from "./cache.ts"
import { Logger } from "./logger.ts";

export function handleEvent<T extends MyEvent>(
	eventData: ReqData<T>,
	sock: WebSocket,
	sockid: string,
) {
	const { func } = eventData
	const data = eventData.data as unknown
	switch (func) {
		case MyEvent.CreateRoom: {
			const id = v4.generate()
			// 添加房间
			addRoomList({
				...data as EventData<MyEvent.CreateRoom>,
				id,
				createTime: Date.now(),
				count: 0,
				ownerId: sockid,
				status: GameState.Ready,
			});
			// 加入房间
			const succ = userJoinRoom(sockid, id)
			respond(MyEvent.CreateRoom, { succ, roomid: id })
			break;
		}
		case MyEvent.GetRoomList: {
			const _data = data as EventData<MyEvent.GetRoomList>
			respond(MyEvent.GetRoomList, getRoomList(_data.no, _data.num));
			break;
		}
		case MyEvent.Login: {
			const _data = data as EventData<MyEvent.Login>
			Logger.log(`[login]`, _data.nick)
			addPlayer(sockid, { nick: _data.nick, status: UserState.Online, _sockid: sockid })
			respond(MyEvent.Login, { succ: true, userId: sockid });
			break;
		}
		case MyEvent.ChangeNick: {
			const _data = type<MyEvent.ChangeNick>(data)
			const succ = setPlayer(sockid, {
				nick: _data
			})
			respond(MyEvent.ChangeNick, { succ })
			break;
		}
		case MyEvent.JoinRoom: {
			const _data = type<MyEvent.JoinRoom>(data)
			const succ = userJoinRoom(sockid, _data.id)
			const players = getRoomPlayers(_data.id)
			const roomData = getRoomById(_data.id)
			respond(MyEvent.JoinRoom, {
				succ,
				players,
				roomData,
			})
			break;
		}
		case MyEvent.Ready: {
			const roomid = getPlayerBySockId(sockid).roomid
			let succ = true
			if (roomid) {
				const player = getRoomPlayer(roomid, sockid)
				if (player) {
					player.status = UserState.Ready
					roomPlayerForEach(roomid, {
						callback(_, sid) {
							sendBySockId(MyEvent.RoomUserState, sid, [player._sockid, player.status])
						},
						after(datas) {
							const roomData = getRoomById(roomid)
							if (!roomData) return
							// 满人且所有玩家准备，则开始游戏
							if (roomData.count !== roomData.max) return
							const everybodyReady = Object.keys(datas).every(key => datas[key].status === UserState.Ready)
							everybodyReady && roomStart(roomid, datas)
						}
					})
				} else {
					succ = false
				}
			} else {
				succ = false
			}
			respond(MyEvent.Ready, { succ })
			break;
		}
		case MyEvent.ExitRoom: {
			// 用户离开房间
			userExitRoom(sockid)
			break;
		}
		case MyEvent.PlayCard: {
			const { index, color } = type<MyEvent.PlayCard>(data)
			const roomid = getPlayerBySockId(sockid, 'roomid')
			if (!roomid) { return }
			const pm = getRoomProcess(roomid)
			const succ = pm?.playCard(sockid, index, color) ?? false
			console.log('[play]', succ)
			respond(MyEvent.PlayCard, { succ })
			if (succ && pm) {
				roomPlayerForEach(roomid, {
					callback: (_, sid) => {
						sendBySockId(MyEvent.GameMeta, sid, {
							turn: pm.getTurnPlayerId(),
							clockwise: pm.clockwise,
							color: pm.currentColor,
							plus: pm.currentPlus,
							cardNum: pm.cardNum,
							lastCard: pm.lastCard!,
							cards: sid === sockid ? pm.players[sockid] : void 0,
							playersCardsNum: {
								[sockid]: pm.players[sockid].length
							}
						})
					}
				})
			}
			break;
		}
		case MyEvent.DrawCard: {
			const roomid = getPlayerBySockId(sockid, 'roomid')
			if (!roomid) return
			const pm = getRoomProcess(roomid)
			const succ = pm?.drawCard(sockid) ?? false
			respond(MyEvent.DrawCard, { succ })
			console.log('[draw]', succ)
			if (succ && pm) {
				roomPlayerForEach(roomid, {
					callback: (_, sid) => {
						sendBySockId(MyEvent.GameMeta, sid, {
							cards: sid === sockid ? pm.players[sockid] : void 0,
							cardNum: pm.cardNum,
							plus: pm.currentPlus,
							lastCard: pm.lastCard,
							color: pm.currentColor,
							playersCardsNum: {
								[sockid]: pm.players[sockid].length
							}
						})
					}
				})
			}
			break;
		}
		default: break;
	}
	
	function respond<T extends keyof ResponseEventDataDefine>(func: T, data: ResponseData<T>) {
		sock.send(JSON.stringify({ func, data }))
	}
	// function push<T extends keyof PushDataDefine>(func: T, data: PushData<T>) {
	// 	//@ts-ignore :)
	// 	respond(func, data)
	// }
}

function type<T extends MyEvent>(data: unknown) {
	return data as EventData<T>
}