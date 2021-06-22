import { IRoomRes, UserState, PlayerData, MyEvent, ResponseData, PushData } from "../deps.ts"
import { WebSocket } from "../deps.ts"
import { Logger } from "./logger.ts";


// 房间列表
const roomList: IRoomRes[] = []

// key: sockid
const players: Record<sockid, PlayerData> = {}

// key: sockid
const connections: Record<sockid, WebSocket> = {}

const roomPlayers: Record<roomid, Record<sockid, PlayerData>> = {}

type sockid = string
type roomid = string



export function setPlayer(nick: string, status: UserState, sockId: sockid) {
	if (players[sockId]) {
		return false
	} else {
		players[sockId] = {
			_sockid: sockId,
			status,
			nick: nick,
		}
		return true
	}
}
export function getPlayer(sockid: sockid): PlayerData {
	return players[sockid] || {}
}
export function delPlayer(nick: string) {
	return delete players[nick]
}

export function getPlayerBySockId(sid: sockid): PlayerData;
export function getPlayerBySockId<T extends keyof PlayerData>(sid: sockid, field: T): PlayerData[T];
export function getPlayerBySockId<T extends keyof PlayerData>(sid: sockid, field?: T): PlayerData | PlayerData[T] {
	const data = players[sid] || {}
	return field ? data[field] : data
}
export function setPlayerDataBySockId<T extends keyof PlayerData>(sid: sockid, field: T, data: PlayerData[T]) {
	try {
		players[sid][field] = data
	} catch (e) {
		console.error(e)
	}
}



export function addRoomList(data: IRoomRes) {
	roomList.push(data)
	roomPlayers[data.id] = {}
	console.log('[new room]', data)
}
export function getRoomList(no: number, num: number) {
	const start = (no - 1) * num
	return {
		list: roomList.slice(start, start + num),
		no, max: Math.ceil(roomList.length / no)
	}
}
export function getRoomById(id: string) {
	return roomList.find(x => x.id === id)
}
export function roomPlayerForEach(
	roomid: roomid,
	option: {
		before?: (datas: Record<sockid, PlayerData>) => void,
		callback: (data: PlayerData, sockid: sockid) => void,
		after?: (datas: Record<sockid, PlayerData>) => void
	}
) {
	const rp = roomPlayers[roomid];
	if (!rp) return
	option.before?.(rp)
	Object.keys(rp).forEach(sid => {
		option.callback(rp[sid], sid)
	})
	option.after?.(rp)
	return rp
}
export function setRoomPlayers(roomid: roomid, sockid: sockid) {
	return roomPlayerForEach(roomid,{
		callback: (_, sid) => {
			// 广播玩家进入
			sendBySockId(MyEvent.PlayerJoinRoom, sid, {
				playerData: getPlayer(sockid)
			})
		},
		after: data => {
			// 设置值
			data[sockid] = getPlayer(sockid)
		}
	})
}
export function removeRoomPlayer(roomid: roomid, sockid: sockid) {
	return roomPlayerForEach(roomid, {
		before: (data) => {
			// 删除该玩家
			delete data[sockid]
		},
		callback: (_, sid) => {
			// 广播房间内玩家
			sendBySockId(MyEvent.ExitRoom, sid, { sockid: sid })
		}
	})
}
export function getRoomPlayers(roomid: roomid) {
	return roomPlayers[roomid] || {}
}


export function userJoinRoom(sockid: sockid, roomid: string) {
	const oldRoomid = getPlayerBySockId(sockid, 'roomid')
	// 已经在房间内
	if (oldRoomid && oldRoomid != roomid) {
		// 房间内实际数据存在
		if (getRoomPlayers(oldRoomid)[sockid]) {
			return false
		}
	}
	const room = getRoomById(roomid)
	if (!room) {
		return false
	} else {
		// 设置用户房间
		setPlayerDataBySockId(sockid, 'roomid', room.id)
		// 设置房间玩家数据
		setRoomPlayers(room.id, sockid)
		// 房间存在
		room.count = Object.keys(getRoomPlayers(roomid)).length
		Logger.log('[join room]', roomid)
		return true
	}
}
export function userExitRoom(sid: sockid) {
	const { roomid } = getPlayerBySockId(sid)
	setPlayerDataBySockId(sid, 'roomid', null);
	if (roomid) {
		// 移除玩家
		removeRoomPlayer(roomid, sid)
		const room = getRoomById(roomid)
		if (room) {
			room.count = Object.keys(getRoomPlayers(roomid)).length
		}
	}
}

export function addConnection(uid: string, sock: WebSocket) {
	connections[uid] = sock
}
export function getSockById(sockid: sockid) {
	return connections[sockid]
}
export function sendBySockId<T extends MyEvent>(event: T, sockid: sockid, data: PushData<T>) {
	const sock = getSockById(sockid)
	if (!sock) return
	sock.send(JSON.stringify({
		func: event,
		data,
	}))
}
export function delConnection(uid: string) {
	userExitRoom(uid)
	delete connections[uid]
	delete players[uid]
}