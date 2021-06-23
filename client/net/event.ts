import { Card, CardColor, CardDirection, GameState, IRoomReq, IRoomRes, PlayerData } from "../../deps.ts"
export enum MyEvent {
	Login,
	CreateRoom,
	GetRoomList,
	JoinRoom,
	ExitRoom,
	// PUSH
	PlayerJoinRoom,
	PlayerExitRoom,
	/** 游戏状态改变 */
	GameStateChange,
	/** 游戏初始化数据 */
	GameInit,
	/** 牌变化 */
	MyCard,
	/** 轮到谁 */
	TurnTo,
	/** 牌方向 */
	CardDirection,
	/** 卡牌颜色变化 */
	CardColorChange,
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
	[MyEvent.Login]: Result & { userId: string }
	[MyEvent.CreateRoom]: Result & { roomid: string }
	[MyEvent.GetRoomList]: {
		list: IRoomRes[]
		no: number
		max: number
	},
	[MyEvent.JoinRoom]: ResultType<{
		players: Record<string, PlayerData>
		roomData: IRoomRes
	}>
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
		playerData: PlayerData
		roomData: Pick<IRoomRes, 'count'>
	}
	[MyEvent.PlayerExitRoom]: {
		playerData: Pick<PlayerData, '_sockid'>
		roomData: Pick<IRoomRes, 'count'>
	}
	[MyEvent.GameStateChange]: GameState
	[MyEvent.GameInit]: {
		turn: string
		color: CardColor
		direction: CardDirection
		cards: Card[]
		gameStatus: GameState
	}
	[MyEvent.MyCard]: Card[]
	[MyEvent.TurnTo]: string // 玩家id
	[MyEvent.CardColorChange]: CardColor
	[MyEvent.CardDirection]: CardDirection
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
type ResultType<T> = Result & Partial<T>