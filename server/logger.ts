export class Logger {
	static log: typeof console.log = (...args) => {
		console.log(...args)
	}
	static error: typeof console.log = (...args) => {
		console.error(...args)
	}
}