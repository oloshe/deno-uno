

import { MyEvent, EventData, ResponseData, ReqData, ResponseEventDataDefine, BufReader, Buffer, readFrame } from "../../deps.ts"

let _websocket: WebSocket

type dataCallbackFn<T> = (data: ResponseData<T>) => void

type dataCallbackData<T> = {
	cb: dataCallbackFn<T>
	once?: boolean
}

const dataCallback: Map<MyEvent, dataCallbackData<unknown>[]> = new Map();

function addCallback<T extends MyEvent>(event: T, fn: dataCallbackFn<T>) {
	const data = dataCallback.get(event) || []
	const _cb = {
		cb: <dataCallbackFn<unknown>>fn,
		once: true
	}
	data.push(_cb)
	dataCallback.set(event, data)
}

export function createWebsocket() {
	_websocket = new WebSocket('ws://127.0.0.1:3333')
	console.log('connecting server...')
	_websocket.onmessage = function (ev: MessageEvent) {
		const _rawdata = JSON.parse(ev.data)
		if (_rawdata === '1') {
			ppChecker.reset().start()
		}
		// console.log('[ws.onmessage]', _rawdata)
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
	return new Promise((resolve, reject) => {
		_websocket.onopen = () => {
			resolve(void 0)
			console.clear()
			_websocket.onopen = () => {

			}
		}
		_websocket.onerror = function (ev) {
			console.error('connect error')
			reject()
			_websocket.onerror = function (ev) {
				console.log(ev)
			}
		}
		_websocket.onclose = () => {
			console.clear()
			console.error('lost connection!')
		}
	})
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

	static sendFuture<T extends keyof ResponseEventDataDefine>(event: T, data: EventData<T>): Promise<ResponseData<T>> {
		return new Promise((resolve) => {
			ws.send(event, data, (resp) => {
				resolve(resp)
			})
		})
	}
}

class ppChecker {
	static _timeout = 10000
	static _timeoutId = 0
	static reset() {
		clearTimeout(this._timeoutId)
		return this
	}
	static start() {
		_websocket.send('0')
		this._timeoutId = setTimeout(() => {
			_websocket.close()
		}, this._timeout)
		
	}
}