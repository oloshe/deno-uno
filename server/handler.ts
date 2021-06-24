import { MyEvent, ReqData, EventData, WebSocket, v4, UserState, ResponseEventDataDefine, ResponseData } from "../deps.ts"
import { addRoomList, getRoomList, setPlayer, userExitRoom, userJoinRoom, getRoomPlayers, getRoomById, roomStart, getPlayerBySockId, getRoomProcess, sendBySock, roomPlayerForEach, sendBySockId } from "./cache.ts"
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
			const succ = setPlayer(_data.nick, UserState.Online, sockid)
			respond(MyEvent.Login, { succ, userId: sockid });
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
			if (roomData && roomData.count === roomData.max) {
				roomStart(roomData.id, players)
			}
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