import { Select, Input, Cell, Confirm, tty, colors, Table, ansi } from "../deps.ts"
// import { checkConnection, preventReconnect } from "./net/ws.ts";

interface SelectItem {
	value: string;
	name?: string;
	disabled?: boolean;
}

export interface SelectOption {
	title: string
	items: Array<SelectItem | string>,
	transform?: Parameters<typeof Select.prompt>[0]['transform']
}

interface InputOption {
	title: string
}

interface ConfirmOption {
	title: string
}

export class Dialoguer {
	public static colors = colors
	public static ansi = ansi
	public static cell = Cell.from
	public static selectDivider = Select.separator('----------')
	public static async Select(option: SelectOption) {
		const ret = await Select.prompt({
			message: option.title,
			options: option.items,
			listPointer: this.colors.blue(">"),
			keys: {
				previous: ['w', 'up'],
				next: ['s', 'down'],
			}
		})
		return ret
	}
	public static async confirm(option: ConfirmOption) {
		return await Confirm.prompt(option.title)
	}
	public static async Input(option: InputOption) {
		const ret = await Input.prompt({
			message: option.title
		})
		return ret
	}
	public static get Table() {
		return new Table()
	}
	public static get TableFrom() {
		return Table.from
	}
	public static tty = tty({
		stdout: Deno.stdout,
		stdin: Deno.stdin,
	})

}