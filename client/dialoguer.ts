import { Select, Input } from "../deps.ts"
import { checkConnection, preventReconnect } from "./net/ws.ts";

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

export class Dialoguer {
	public static selectDivider = Select.separator('----------')
	public static async Select(option: SelectOption) {
		preventReconnect()
		const ret = await Select.prompt({
			message: option.title,
			options: option.items,
			keys: {
				previous: ['w', 'up'],
				next: ['s', 'down'],
			}
		});
		checkConnection()
		return ret
	}
	public static async Input(option: InputOption) {
		preventReconnect()
		const ret = await Input.prompt({
			message: option.title,
		})
		checkConnection()
		return ret
	} 
}