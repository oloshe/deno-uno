import { MyEvent, EventData } from "../deps.ts"

export interface TransData<T extends MyEvent> {
	func: T,
	data: EventData<T>,
}