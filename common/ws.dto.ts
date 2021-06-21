import { MyEvent, EventData, ResponseData, ResponseEventDataDefine } from "../deps.ts"

export interface ReqData<T extends MyEvent> {
	func: T,
	data: EventData<T>,
}

export interface RespData<T extends keyof ResponseEventDataDefine> {
	func: T,
	data: ResponseData<T>
}