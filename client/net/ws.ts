import { MyEvent, EventData, ResponseData, ReqData } from "../../deps.ts"

let _websocket: WebSocket

type dataCallbackFn<T> = (data: ResponseData<T>) => void

type dataCallbackData<T> = {
	cb: dataCallbackFn<T>
	once?: boolean
}

const dataCallback: Map<MyEvent, dataCallbackData<unknown>[]> = new Map();

function addCallback<T extends MyEvent>(event: T, fn: dataCallbackFn<T>) {
	const data = dataCallback.get(event) || []
	data.push({
		cb: fn,
		once: true
	})
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
		const _rawdata = JSON.parse(ev.data)
		const { func, data } = _rawdata;
		const cbData = dataCallback.get(func)
		if (cbData) {
			const filterCbData = cbData.filter(itm => {
				// 执行回调
				itm.cb(data)
				return !itm.once
			})
			// 去除单次回调
			filterCbData.length !== cbData.length && dataCallback.set(func, filterCbData)
		}
	}
}

export class ws {
	static send<T extends MyEvent>(event: T, data: EventData<T>, callback?: (data: ResponseData<T>) => void) {
		const _transData: ReqData<T> = {
			func: event,
			data,
		}
		// console.log(event, callback)
		callback && addCallback(event, callback);
		_websocket.send(JSON.stringify(_transData))
	}
}
