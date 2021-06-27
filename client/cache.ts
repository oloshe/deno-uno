import { MyEvent, PushData, PushDataDefine, ResponseEventDataDefine, ResponseData } from "../common/event.ts"
export class Cache {
	private static _innerCache: Record<string, unknown> = {}
	static get<T extends keyof ResponseEventDataDefine | keyof PushDataDefine>(event: T):
		(T extends keyof ResponseEventDataDefine ? ResponseData<T> : PushData<T>)| null
	{
		// @ts-ignore 
		return this._innerCache[event] || null
	}
	static set<T extends MyEvent>(event: T, data: unknown) {
		this._innerCache[event] = data
	}
}