import { Card, CardColor } from "./card.ts";
import { GameState, UserState } from "./state.ts"
import { PlayerData } from "./user.ts";
import { IRoomRes, IRoomReq } from "./room.ts"
export enum MyEvent {
	Login,
	ChangeNick,
	OnlineNum,
	CreateRoom,
	GetRoomList,
	JoinRoom,
	Ready,
	ExitRoom,
	/** 出牌 */
	PlayCard,
	/** 抽牌 */
	DrawCard,
	// PUSH
	PlayerJoinRoom,
	PlayerExitRoom,
	/** 游戏状态改变 */
	GameStateChange,
	/** 游戏一些基础数据 */
	GameMeta,
	RoomUserState,
}

// 事件参数定义
interface EventDataDefine {
	[MyEvent.Login]: {
		nick: string,
		cv: string | number
	}
	[MyEvent.ChangeNick]: string
	[MyEvent.CreateRoom]: IRoomReq,
	[MyEvent.GetRoomList]: {
		/** 页码 */
		no: number,
		/** 每页数量 */
		num: number
	}
	[MyEvent.JoinRoom]: {
		id: string
		pwd?: string
	}
	[MyEvent.PlayCard]: {
		index: number,
		color?: CardColor // 出万能牌的时候要指定颜色
	},
	[MyEvent.DrawCard]: null
}

/**
 * 请求响应
 * 字段不可与 [PushDataDefine] 重复，否则会有bug
 */
export interface ResponseEventDataDefine {
	[MyEvent.Login]: Result & { userId: string, reason?: string }
	[MyEvent.ChangeNick]: Result
	[MyEvent.OnlineNum]: number
	[MyEvent.CreateRoom]: Result & { roomid: string }
	[MyEvent.GetRoomList]: {
		list: IRoomRes[]
		no: number
		max: number
	},
	[MyEvent.JoinRoom]: ResultType<{
		players: Record<string, PlayerData | undefined> | undefined
		roomData: IRoomRes | undefined
	}>
	[MyEvent.PlayCard]: {
		succ: boolean
	}
	[MyEvent.DrawCard]: Result
	[MyEvent.Ready]: Result
}
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
	[MyEvent.GameMeta]: Partial<{
		turn: string
		clockwise: boolean
		color: number
		plus: number
		cardNum: number
		gameStatus: GameState
		lastCard: Card | null
		drawedIndex: number
		playersCardsNum: Record<string, number>
		playerState: [string, UserState]
		playerPoint: Record<string, number>
		cards: Card[]
		winner: string // id
	}>
	[MyEvent.RoomUserState]: [string, UserState]
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