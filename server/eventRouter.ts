// import { EventData, MyEvent } from "../deps.ts";

// // const Router = (): MethodDecorator => {
// // 	return (target: Object, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) => {
// // 		target[propertyKey] = value
// // 	}
// // }

// function Router(): ClassDecorator {
// 	return (target) => {
// 		target.prototype.$map = {}
// 	}
// }

// function Event(event: MyEvent): MethodDecorator {
// 	return (target, propertyKey, descriptor) => {
// 		// @ts-ignore 
// 		target.$map[event] = target[propertyKey]
// 		descriptor.writable = false
// 	}
// }

// @Router()
// class EventRouter {
// 	@Event(MyEvent.Login)
// 	login(sockid: string, data: EventData<MyEvent.Login>) {

// 	}
// }