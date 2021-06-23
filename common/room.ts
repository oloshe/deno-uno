export interface IRoomReq {
	name: string
	max: number
	owner: string
}

export interface IRoomRes extends IRoomReq {
	id: string
	count: number
	createTime: number
	ownerId: string
}



// export class RoomData implements IRoomReq  {
// 	name: string;
// 	max: number;
// 	owner: string;
// 	constructor(option: IRoomReq) {
// 		this.name = option.name
// 		this.max = option.max
// 		this.owner = option.owner
// 	}
// }