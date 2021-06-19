import { MyEvent, EventData, ResponseData } from "../deps.ts"

export interface ReqData<T extends MyEvent> {
	func: T,
	data: EventData<T>,
}

export interface RespData<T extends MyEvent> {
	func: T,
	data: ResponseData<T>
}