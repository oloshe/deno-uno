import { IRoomRes, UserState, User } from "../deps.ts"
import { WebSocket } from "../deps.ts"

interface playerData {
	_sockid: string,
	status: UserState,
	nick: string
}

const roomList: IRoomRes[] = []

// key: sockid
const players: Record<sockid, playerData> = {}

// key: sockid
const connections: Record<sockid, WebSocket> = {}

type sockid = string

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

export function getPlayer(sockid: sockid): playerData | undefined {
	return players[sockid]
}

export function delPlayer(nick: string) {
	return delete players[nick]
}

export function addRoomList(data: IRoomRes) {
	roomList.push(data)
	console.log('[new room]', data)
}

export function getRoomList() {
	return roomList
}

export function getRoomById(id: string) {
	return roomList.find(x => x.id === id)
}

export function addConnection(uid: string, sock: WebSocket) {
	connections[uid] = sock
}

export function delConnection(uid: string) {
	delete connections[uid]
	delete players[uid]
}