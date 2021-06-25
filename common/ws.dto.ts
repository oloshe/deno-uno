import { MyEvent, EventData } from "../deps.ts"

export interface ReqData<T extends MyEvent> {
	func: T,
	data: EventData<T>,
}