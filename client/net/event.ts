import { IRoomReq, IRoomRes, PlayerData } from "../../deps.ts"
export enum MyEvent {
	Login,
	CreateRoom,
	GetRoomList,
	JoinRoom,
	ExitRoom,
	PlayerJoinRoom,
}

// 事件参数定义
interface EventDataDefine {
	[MyEvent.Login]: {
		nick: string
	}
	[MyEvent.CreateRoom]: IRoomReq,
	[MyEvent.GetRoomList]: {
		/** 页码 */
		no: number,
		/** 每页数量 */
		num: number
	}
	[MyEvent.JoinRoom]: {
		id: string
	}

}

/**
 * 请求响应
 * 字段不可与 [PushDataDefine] 重复，否则会有bug
 */
export interface ResponseEventDataDefine {
	[MyEvent.Login]: Result
	[MyEvent.CreateRoom]: ResultFail | { players?: Record<string, PlayerData> } & ResultSucc
	[MyEvent.GetRoomList]: {
		list: IRoomRes[]
		no: number
		max: number
	},
	[MyEvent.JoinRoom]: ResultFail | { players?: Record<string, PlayerData> } & ResultSucc
}
type test = ResponseData<MyEvent.JoinRoom>
/**
 * 主动推送数据
 * 字段不可与 [ResponseEventDataDefine] 重复，否则会有bug
 */
export interface PushDataDefine{
	[MyEvent.ExitRoom]: {
		sockid: string
	}
	[MyEvent.PlayerJoinRoom]: {
		playerData: PlayerData,
	}
}

export type EventData<T> = T extends MyEvent & keyof EventDataDefine
	? EventDataDefine[T]
	: unknown

export type ResponseData<T> = T extends MyEvent & keyof ResponseEventDataDefine
	? ResponseEventDataDefine[T]
	: unknown

export type PushData<T> = T extends MyEvent & keyof PushDataDefine
	? PushDataDefine[T]
	: unknown

type Result = { succ: boolean }
type ResultSucc = { succ: true }
type ResultFail = { succ: false }