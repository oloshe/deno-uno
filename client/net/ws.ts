import { MyEvent, EventData, ResponseData, TransData } from "../../deps.ts"

let _websocket: WebSocket

type dataCallbackFn<T> = (data: ResponseData<T>) => void

const dataCallback: Map<MyEvent, dataCallbackFn<unknown>[]> = new Map();

function addCallback<T extends MyEvent>(event: T, fn: dataCallbackFn<T>) {
	const data = dataCallback.get(event) || []
	data.push(fn)
	dataCallback.set(event, data)
}

export function createWebsocket() {
	_websocket = new WebSocket('ws://127.0.0.1:3333')
	_websocket.onopen = () => {
		ws.send(MyEvent.Login, { nick: 'asd' })
	}
	_websocket.onerror = function (ev) {
		console.log(ev)
	}
	_websocket.onclose = () => {
	}
	_websocket.onmessage = function (ev: MessageEvent) {
		console.log(ev.data)
	}
}

export class ws {
	static send<T extends MyEvent>(event: T, data: EventData<T>, callback?: (data: ResponseData<T>) => void) {
		const _transData: TransData<T> = {
			func: event,
			data,
		}
		callback && addCallback(event, callback);
		_websocket.send(JSON.stringify(_transData))
	}
}
