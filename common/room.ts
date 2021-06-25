import { GameState } from "../deps.ts";

export interface IRoomReq {
	name: string
	max: number
	owner: string
}

export interface IRoomRes extends IRoomReq {
	id: string
	count: number
	createTime: number
	ownerId: string
	status: GameState,
}