export class User {
	private name: string
	constructor(name: string) {
		this.name = name
	}
	setName(name: string) {
		this.name = name
	}
	getName() {
		return this.name
	}
}

export const playerUser = new User('')