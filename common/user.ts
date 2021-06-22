import { UserState } from "./state.ts";

export class User {
	private _name: string
	constructor(name: string) {
		this._name = name
	}
	setName(name: string) {
		this._name = name
	}
	get name() {
		return this._name
	}
}

export const playerUser = new User('nick')

export interface PlayerData {
	_sockid: string,
	status: UserState,
	nick: string
	roomid?: string | null
}