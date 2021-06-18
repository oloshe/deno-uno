import { Event, EventData } from "../deps.ts"

export interface TransData<T extends Event> {
	func: T,
	data: EventData<T>,
}