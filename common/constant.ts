const devConf = {
	addr: 'localhost:20210'
}

const prodConf = {
	addr: 'localhost:20210',
}

const defaultConf = {
	isDev: false,
	serverPort: '20210',
}

export const Constant = Object.assign(defaultConf, defaultConf.isDev ? devConf : prodConf)
