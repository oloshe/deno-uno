import { MyEvent, ReqData, EventData, WebSocket, v4, UserState, ResponseEventDataDefine, ResponseData } from "../deps.ts"
import { addRoomList, getRoomList, setPlayer, getRoomById } from "./cache.ts"
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
			addRoomList({
				...data as EventData<MyEvent.CreateRoom>,
				id: v4.generate(),
				createTime: Date.now(),
				count: 0,
			});
			break;
		}
		case MyEvent.GetRoomList: {
			respond(MyEvent.GetRoomList, getRoomList());
			break;
		}
		case MyEvent.Login: {
			const _data = data as EventData<MyEvent.Login>
			Logger.log(`[login]`, _data.nick)
			const succ = setPlayer(_data.nick, UserState.Online, sockid)
			respond(MyEvent.Login, { succ });
			break;
		}
		case MyEvent.JoinRoom: {
			// const _data = data as EventData<MyEvent.JoinRoom>
			const _data = type<MyEvent.JoinRoom>(data)
			const room = getRoomById(_data.id)
			if (!room) {
				respond(MyEvent.JoinRoom, { succ: false })
			} else {
				respond(MyEvent.JoinRoom, {
					succ: true,
					players: {}
				})
			}
			break;
		}
		default: break;
	}
	
	function respond<T extends keyof ResponseEventDataDefine>(func: T, data: ResponseData<T>) {
		sock.send(JSON.stringify({ func, data }))
	}
}

function type<T extends MyEvent>(data: unknown) {
	return data as EventData<T>
}