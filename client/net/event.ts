import { IRoomReq, IRoomRes, UserState } from "../../deps.ts"
export enum MyEvent {
	Login,
	CreateRoom,
	GetRoomList,
	JoinRoom,
}

interface EventDataDefine {
	[MyEvent.Login]: {
		nick: string
	}
	[MyEvent.CreateRoom]: IRoomReq,
	[MyEvent.GetRoomList]: null
	[MyEvent.JoinRoom]: {
		id: string
	}
}

export interface ResponseEventDataDefine {
	[MyEvent.Login]: {
		succ: boolean
	}
	[MyEvent.GetRoomList]: IRoomRes[]
	[MyEvent.JoinRoom]: {
		succ: false
	} | {
		succ: true,
		players?: Record<string, UserState>
	}
}

export type EventData<T> = T extends MyEvent & keyof EventDataDefine
	? EventDataDefine[T]
	: unknown

export type ResponseData<T> = T extends MyEvent & keyof ResponseEventDataDefine
	? ResponseEventDataDefine[T]
	: unknown