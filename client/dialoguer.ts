import { Select, Input } from "../deps.ts"

interface SelectItem {
	value: string;
	name?: string;
	disabled?: boolean;
}

interface SelectOption {
	title: string
	items: Array<SelectItem | string>,
}

interface InputOption {
	title: string
}

export class Dialoguer {
	public static async Select(option: SelectOption) {
		const ret = await Select.prompt({
			message: option.title,
			options: option.items,
			keys: {
				previous: ['w'],
				next: ['s'],
			}
		});
		return ret
	}
	public static async Input(option: InputOption) {
		const ret = await Input.prompt({
			message: option.title,
		})
		return ret
	} 
}