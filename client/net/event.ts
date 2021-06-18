export enum Event {
	Login
}

interface EventDataDefine {
	[Event.Login]: {
		nick: string
	}
}

export type EventData<T> = T extends Event ? EventDataDefine[T] : never