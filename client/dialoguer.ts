import { Select, Input, /*Number, */ tty, colors } from "../deps.ts"
// import { checkConnection, preventReconnect } from "./net/ws.ts";

interface SelectItem {
	value: string;
	name?: string;
	disabled?: boolean;
}

export interface SelectOption {
	title: string
	items: Array<SelectItem | string>,
}

interface InputOption {
	title: string
}

// interface NumberOption {
// 	title: string,
// 	min?: number
// 	max?: number
// 	float?: boolean
// 	round?: number
// }

export class Dialoguer {
	public static colors = colors
	public static selectDivider = Select.separator('----------')
	public static async Select(option: SelectOption) {
		const ret = await this.SelectAsync(option)
		return ret
	}
	public static SelectAsync(option: SelectOption) {
		return Select.prompt({
			message: option.title,
			options: option.items,
			keys: {
				previous: ['w', 'up'],
				next: ['s', 'down'],
			}
		})
	}
	public static async Input(option: InputOption) {
		const ret = await this.InputAsync(option)
		return ret
	}
	public static InputAsync(option: InputOption) {
		return Input.prompt({
			message: option.title
		})
	}
	// public static async Number(option: NumberOption) {
	// 	const ret = await Number.prompt({
	// 		message: option.title,
	// 		min: option.min,
	// 		max: option.max,
	// 		float: option.float,
	// 		round: option.round,
	// 	})
	// 	return ret
	// }
	public static tty = tty({
		stdout: Deno.stdout,
		stdin: Deno.stdin,
	})

}