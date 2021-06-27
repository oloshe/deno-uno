import { MyEvent, EventData } from "./event.ts"
export interface ReqData<T extends MyEvent> {
	func: T,
	data: EventData<T>,
}