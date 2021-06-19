import { RoomData } from "../../deps.ts"
export enum MyEvent {
	Login,
	CreateRoom,
	GetRoomList,
}

interface EventDataDefine {
	[MyEvent.Login]: {
		nick: string
	}
	[MyEvent.CreateRoom]: RoomData,
	[MyEvent.GetRoomList]: null
}

interface ResponseEventDataDefine {
	[MyEvent.GetRoomList]: RoomData[]
}

export type EventData<T> = T extends MyEvent
	? EventDataDefine[T]
	: unknown

export type ResponseData<T> = T extends MyEvent
	? T extends keyof ResponseEventDataDefine
		? ResponseEventDataDefine[T]
		: unknown
	: unknown