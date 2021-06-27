import { GameState } from "./state.ts";

export interface IRoomReq {
	name: string
	max: number
	owner: string
	_pwd?: string
}

export interface IRoomRes extends IRoomReq {
	id: string
	count: number
	createTime: number
	ownerId: string
	status: GameState,
	pwd: boolean
}