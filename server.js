class DenoStdInternalError extends Error {
    constructor(message2){
        super(message2);
        this.name = "DenoStdInternalError";
    }
}
function assert(expr, msg = "") {
    if (!expr) {
        throw new DenoStdInternalError(msg);
    }
}
function concat(...buf) {
    let length = 0;
    for (const b of buf){
        length += b.length;
    }
    const output = new Uint8Array(length);
    let index = 0;
    for (const b1 of buf){
        output.set(b1, index);
        index += b1.length;
    }
    return output;
}
function copy(src, dst, off = 0) {
    off = Math.max(0, Math.min(off, dst.byteLength));
    const dstBytesAvailable = dst.byteLength - off;
    if (src.byteLength > dstBytesAvailable) {
        src = src.subarray(0, dstBytesAvailable);
    }
    dst.set(src, off);
    return src.byteLength;
}
const MIN_READ = 32 * 1024;
const MAX_SIZE = 2 ** 32 - 2;
class Buffer {
    #buf;
    #off = 0;
    constructor(ab){
        this.#buf = ab === undefined ? new Uint8Array(0) : new Uint8Array(ab);
    }
    bytes(options = {
        copy: true
    }) {
        if (options.copy === false) return this.#buf.subarray(this.#off);
        return this.#buf.slice(this.#off);
    }
    empty() {
        return this.#buf.byteLength <= this.#off;
    }
    get length() {
        return this.#buf.byteLength - this.#off;
    }
    get capacity() {
        return this.#buf.buffer.byteLength;
    }
    truncate(n) {
        if (n === 0) {
            this.reset();
            return;
        }
        if (n < 0 || n > this.length) {
            throw Error("bytes.Buffer: truncation out of range");
        }
        this.#reslice(this.#off + n);
    }
    reset() {
        this.#reslice(0);
        this.#off = 0;
    }
     #tryGrowByReslice(n) {
        const l = this.#buf.byteLength;
        if (n <= this.capacity - l) {
            this.#reslice(l + n);
            return l;
        }
        return -1;
    }
     #reslice(len) {
        assert(len <= this.#buf.buffer.byteLength);
        this.#buf = new Uint8Array(this.#buf.buffer, 0, len);
    }
    readSync(p) {
        if (this.empty()) {
            this.reset();
            if (p.byteLength === 0) {
                return 0;
            }
            return null;
        }
        const nread = copy(this.#buf.subarray(this.#off), p);
        this.#off += nread;
        return nread;
    }
    read(p) {
        const rr = this.readSync(p);
        return Promise.resolve(rr);
    }
    writeSync(p) {
        const m = this.#grow(p.byteLength);
        return copy(p, this.#buf, m);
    }
    write(p) {
        const n = this.writeSync(p);
        return Promise.resolve(n);
    }
     #grow(n) {
        const m = this.length;
        if (m === 0 && this.#off !== 0) {
            this.reset();
        }
        const i = this.#tryGrowByReslice(n);
        if (i >= 0) {
            return i;
        }
        const c = this.capacity;
        if (n <= Math.floor(c / 2) - m) {
            copy(this.#buf.subarray(this.#off), this.#buf);
        } else if (c + n > MAX_SIZE) {
            throw new Error("The buffer cannot be grown beyond the maximum size.");
        } else {
            const buf = new Uint8Array(Math.min(2 * c + n, MAX_SIZE));
            copy(this.#buf.subarray(this.#off), buf);
            this.#buf = buf;
        }
        this.#off = 0;
        this.#reslice(Math.min(m + n, MAX_SIZE));
        return m;
    }
    grow(n) {
        if (n < 0) {
            throw Error("Buffer.grow: negative count");
        }
        const m = this.#grow(n);
        this.#reslice(m);
    }
    async readFrom(r) {
        let n = 0;
        const tmp = new Uint8Array(MIN_READ);
        while(true){
            const shouldGrow = this.capacity - this.length < MIN_READ;
            const buf = shouldGrow ? tmp : new Uint8Array(this.#buf.buffer, this.length);
            const nread = await r.read(buf);
            if (nread === null) {
                return n;
            }
            if (shouldGrow) this.writeSync(buf.subarray(0, nread));
            else this.#reslice(this.length + nread);
            n += nread;
        }
    }
    readFromSync(r) {
        let n = 0;
        const tmp = new Uint8Array(MIN_READ);
        while(true){
            const shouldGrow = this.capacity - this.length < MIN_READ;
            const buf = shouldGrow ? tmp : new Uint8Array(this.#buf.buffer, this.length);
            const nread = r.readSync(buf);
            if (nread === null) {
                return n;
            }
            if (shouldGrow) this.writeSync(buf.subarray(0, nread));
            else this.#reslice(this.length + nread);
            n += nread;
        }
    }
}
const noColor = globalThis.Deno?.noColor ?? true;
let enabled = !noColor;
function setColorEnabled(value) {
    if (noColor) {
        return;
    }
    enabled = value;
}
function getColorEnabled() {
    return enabled;
}
function code1(open, close) {
    return {
        open: `\x1b[${open.join(";")}m`,
        close: `\x1b[${close}m`,
        regexp: new RegExp(`\\x1b\\[${close}m`, "g")
    };
}
function run1(str, code1) {
    return enabled ? `${code1.open}${str.replace(code1.regexp, code1.open)}${code1.close}` : str;
}
function reset(str) {
    return run1(str, code1([
        0
    ], 0));
}
function bold(str) {
    return run1(str, code1([
        1
    ], 22));
}
function dim(str) {
    return run1(str, code1([
        2
    ], 22));
}
function italic(str) {
    return run1(str, code1([
        3
    ], 23));
}
function underline(str) {
    return run1(str, code1([
        4
    ], 24));
}
function inverse(str) {
    return run1(str, code1([
        7
    ], 27));
}
function hidden1(str) {
    return run1(str, code1([
        8
    ], 28));
}
function strikethrough(str) {
    return run1(str, code1([
        9
    ], 29));
}
function black(str) {
    return run1(str, code1([
        30
    ], 39));
}
function red(str) {
    return run1(str, code1([
        31
    ], 39));
}
function green(str) {
    return run1(str, code1([
        32
    ], 39));
}
function yellow(str) {
    return run1(str, code1([
        33
    ], 39));
}
function blue(str) {
    return run1(str, code1([
        34
    ], 39));
}
function magenta(str) {
    return run1(str, code1([
        35
    ], 39));
}
function cyan(str) {
    return run1(str, code1([
        36
    ], 39));
}
function white(str) {
    return run1(str, code1([
        37
    ], 39));
}
function gray(str) {
    return brightBlack(str);
}
function brightBlack(str) {
    return run1(str, code1([
        90
    ], 39));
}
function brightRed(str) {
    return run1(str, code1([
        91
    ], 39));
}
function brightGreen(str) {
    return run1(str, code1([
        92
    ], 39));
}
function brightYellow(str) {
    return run1(str, code1([
        93
    ], 39));
}
function brightBlue(str) {
    return run1(str, code1([
        94
    ], 39));
}
function brightMagenta(str) {
    return run1(str, code1([
        95
    ], 39));
}
function brightCyan(str) {
    return run1(str, code1([
        96
    ], 39));
}
function brightWhite(str) {
    return run1(str, code1([
        97
    ], 39));
}
function bgBlack(str) {
    return run1(str, code1([
        40
    ], 49));
}
function bgRed(str) {
    return run1(str, code1([
        41
    ], 49));
}
function bgGreen(str) {
    return run1(str, code1([
        42
    ], 49));
}
function bgYellow(str) {
    return run1(str, code1([
        43
    ], 49));
}
function bgBlue(str) {
    return run1(str, code1([
        44
    ], 49));
}
function bgMagenta(str) {
    return run1(str, code1([
        45
    ], 49));
}
function bgCyan(str) {
    return run1(str, code1([
        46
    ], 49));
}
function bgWhite(str) {
    return run1(str, code1([
        47
    ], 49));
}
function bgBrightBlack(str) {
    return run1(str, code1([
        100
    ], 49));
}
function bgBrightRed(str) {
    return run1(str, code1([
        101
    ], 49));
}
function bgBrightGreen(str) {
    return run1(str, code1([
        102
    ], 49));
}
function bgBrightYellow(str) {
    return run1(str, code1([
        103
    ], 49));
}
function bgBrightBlue(str) {
    return run1(str, code1([
        104
    ], 49));
}
function bgBrightMagenta(str) {
    return run1(str, code1([
        105
    ], 49));
}
function bgBrightCyan(str) {
    return run1(str, code1([
        106
    ], 49));
}
function bgBrightWhite(str) {
    return run1(str, code1([
        107
    ], 49));
}
function clampAndTruncate(n, max = 255, min = 0) {
    return Math.trunc(Math.max(Math.min(n, max), min));
}
function rgb8(str, color) {
    return run1(str, code1([
        38,
        5,
        clampAndTruncate(color)
    ], 39));
}
function bgRgb8(str, color) {
    return run1(str, code1([
        48,
        5,
        clampAndTruncate(color)
    ], 49));
}
function rgb24(str, color) {
    if (typeof color === "number") {
        return run1(str, code1([
            38,
            2,
            color >> 16 & 255,
            color >> 8 & 255,
            color & 255
        ], 39));
    }
    return run1(str, code1([
        38,
        2,
        clampAndTruncate(color.r),
        clampAndTruncate(color.g),
        clampAndTruncate(color.b), 
    ], 39));
}
function bgRgb24(str, color) {
    if (typeof color === "number") {
        return run1(str, code1([
            48,
            2,
            color >> 16 & 255,
            color >> 8 & 255,
            color & 255
        ], 49));
    }
    return run1(str, code1([
        48,
        2,
        clampAndTruncate(color.r),
        clampAndTruncate(color.g),
        clampAndTruncate(color.b), 
    ], 49));
}
const ANSI_PATTERN = new RegExp([
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~]))", 
].join("|"), "g");
function stripColor(string) {
    return string.replace(ANSI_PATTERN, "");
}
const mod = function() {
    return {
        setColorEnabled: setColorEnabled,
        getColorEnabled: getColorEnabled,
        reset: reset,
        bold: bold,
        dim: dim,
        italic: italic,
        underline: underline,
        inverse: inverse,
        hidden: hidden1,
        strikethrough: strikethrough,
        black: black,
        red: red,
        green: green,
        yellow: yellow,
        blue: blue,
        magenta: magenta,
        cyan: cyan,
        white: white,
        gray: gray,
        brightBlack: brightBlack,
        brightRed: brightRed,
        brightGreen: brightGreen,
        brightYellow: brightYellow,
        brightBlue: brightBlue,
        brightMagenta: brightMagenta,
        brightCyan: brightCyan,
        brightWhite: brightWhite,
        bgBlack: bgBlack,
        bgRed: bgRed,
        bgGreen: bgGreen,
        bgYellow: bgYellow,
        bgBlue: bgBlue,
        bgMagenta: bgMagenta,
        bgCyan: bgCyan,
        bgWhite: bgWhite,
        bgBrightBlack: bgBrightBlack,
        bgBrightRed: bgBrightRed,
        bgBrightGreen: bgBrightGreen,
        bgBrightYellow: bgBrightYellow,
        bgBrightBlue: bgBrightBlue,
        bgBrightMagenta: bgBrightMagenta,
        bgBrightCyan: bgBrightCyan,
        bgBrightWhite: bgBrightWhite,
        rgb8: rgb8,
        bgRgb8: bgRgb8,
        rgb24: rgb24,
        bgRgb24: bgRgb24,
        stripColor: stripColor
    };
}();
var DiffType;
(function(DiffType1) {
    DiffType1["removed"] = "removed";
    DiffType1["common"] = "common";
    DiffType1["added"] = "added";
})(DiffType || (DiffType = {
}));
class AssertionError extends Error {
    constructor(message1){
        super(message1);
        this.name = "AssertionError";
    }
}
function deferred() {
    let methods;
    const promise = new Promise((resolve, reject)=>{
        methods = {
            resolve,
            reject
        };
    });
    return Object.assign(promise, methods);
}
class MuxAsyncIterator {
    iteratorCount = 0;
    yields = [];
    throws = [];
    signal = deferred();
    add(iterable) {
        ++this.iteratorCount;
        this.callIteratorNext(iterable[Symbol.asyncIterator]());
    }
    async callIteratorNext(iterator) {
        try {
            const { value , done  } = await iterator.next();
            if (done) {
                --this.iteratorCount;
            } else {
                this.yields.push({
                    iterator,
                    value
                });
            }
        } catch (e) {
            this.throws.push(e);
        }
        this.signal.resolve();
    }
    async *iterate() {
        while(this.iteratorCount > 0){
            await this.signal;
            for(let i = 0; i < this.yields.length; i++){
                const { iterator , value  } = this.yields[i];
                yield value;
                this.callIteratorNext(iterator);
            }
            if (this.throws.length) {
                for (const e of this.throws){
                    throw e;
                }
                this.throws.length = 0;
            }
            this.yields.length = 0;
            this.signal = deferred();
        }
    }
    [Symbol.asyncIterator]() {
        return this.iterate();
    }
}
const noop = ()=>{
};
class AsyncIterableClone {
    currentPromise;
    resolveCurrent = noop;
    consumed;
    consume = noop;
    constructor(){
        this.currentPromise = new Promise((resolve)=>{
            this.resolveCurrent = resolve;
        });
        this.consumed = new Promise((resolve)=>{
            this.consume = resolve;
        });
    }
    reset() {
        this.currentPromise = new Promise((resolve)=>{
            this.resolveCurrent = resolve;
        });
        this.consumed = new Promise((resolve)=>{
            this.consume = resolve;
        });
    }
    async next() {
        const res = await this.currentPromise;
        this.consume();
        this.reset();
        return res;
    }
    async push(res) {
        this.resolveCurrent(res);
        await this.consumed;
    }
    [Symbol.asyncIterator]() {
        return this;
    }
}
const encoder = new TextEncoder();
function emptyReader() {
    return {
        read (_) {
            return Promise.resolve(null);
        }
    };
}
function bodyReader(contentLength, r) {
    let totalRead = 0;
    let finished = false;
    async function read(buf) {
        if (finished) return null;
        let result;
        const remaining = contentLength - totalRead;
        if (remaining >= buf.byteLength) {
            result = await r.read(buf);
        } else {
            const readBuf = buf.subarray(0, remaining);
            result = await r.read(readBuf);
        }
        if (result !== null) {
            totalRead += result;
        }
        finished = totalRead === contentLength;
        return result;
    }
    return {
        read
    };
}
const CHAR_SPACE = " ".charCodeAt(0);
const CHAR_TAB = "\t".charCodeAt(0);
const CHAR_COLON = ":".charCodeAt(0);
const WHITESPACES = [
    CHAR_SPACE,
    CHAR_TAB
];
const decoder = new TextDecoder();
const invalidHeaderCharRegex = /[^\t\x20-\x7e\x80-\xff]/g;
function str(buf) {
    return !buf ? "" : decoder.decode(buf);
}
class TextProtoReader {
    r;
    constructor(r1){
        this.r = r1;
    }
    async readLine() {
        const s = await this.readLineSlice();
        return s === null ? null : str(s);
    }
    async readMIMEHeader() {
        const m = new Headers();
        let line;
        let buf = await this.r.peek(1);
        if (buf === null) {
            return null;
        } else if (WHITESPACES.includes(buf[0])) {
            line = await this.readLineSlice();
        }
        buf = await this.r.peek(1);
        if (buf === null) {
            throw new Deno.errors.UnexpectedEof();
        } else if (WHITESPACES.includes(buf[0])) {
            throw new Deno.errors.InvalidData(`malformed MIME header initial line: ${str(line)}`);
        }
        while(true){
            const kv = await this.readLineSlice();
            if (kv === null) throw new Deno.errors.UnexpectedEof();
            if (kv.byteLength === 0) return m;
            let i = kv.indexOf(CHAR_COLON);
            if (i < 0) {
                throw new Deno.errors.InvalidData(`malformed MIME header line: ${str(kv)}`);
            }
            const key = str(kv.subarray(0, i));
            if (key == "") {
                continue;
            }
            i++;
            while(i < kv.byteLength && WHITESPACES.includes(kv[i])){
                i++;
            }
            const value = str(kv.subarray(i)).replace(invalidHeaderCharRegex, encodeURI);
            try {
                m.append(key, value);
            } catch  {
            }
        }
    }
    async readLineSlice() {
        let line = new Uint8Array(0);
        let r1 = null;
        do {
            r1 = await this.r.readLine();
            if (r1 !== null && this.skipSpace(r1.line) !== 0) {
                line = concat(line, r1.line);
            }
        }while (r1 !== null && r1.more)
        return r1 === null ? null : line;
    }
    skipSpace(l) {
        let n = 0;
        for (const val of l){
            if (!WHITESPACES.includes(val)) {
                n++;
            }
        }
        return n;
    }
}
function chunkedBodyReader(h, r1) {
    const tp = new TextProtoReader(r1);
    let finished = false;
    const chunks = [];
    async function read(buf) {
        if (finished) return null;
        const [chunk] = chunks;
        if (chunk) {
            const chunkRemaining = chunk.data.byteLength - chunk.offset;
            const readLength = Math.min(chunkRemaining, buf.byteLength);
            for(let i = 0; i < readLength; i++){
                buf[i] = chunk.data[chunk.offset + i];
            }
            chunk.offset += readLength;
            if (chunk.offset === chunk.data.byteLength) {
                chunks.shift();
                if (await tp.readLine() === null) {
                    throw new Deno.errors.UnexpectedEof();
                }
            }
            return readLength;
        }
        const line = await tp.readLine();
        if (line === null) throw new Deno.errors.UnexpectedEof();
        const [chunkSizeString] = line.split(";");
        const chunkSize = parseInt(chunkSizeString, 16);
        if (Number.isNaN(chunkSize) || chunkSize < 0) {
            throw new Deno.errors.InvalidData("Invalid chunk size");
        }
        if (chunkSize > 0) {
            if (chunkSize > buf.byteLength) {
                let eof = await r1.readFull(buf);
                if (eof === null) {
                    throw new Deno.errors.UnexpectedEof();
                }
                const restChunk = new Uint8Array(chunkSize - buf.byteLength);
                eof = await r1.readFull(restChunk);
                if (eof === null) {
                    throw new Deno.errors.UnexpectedEof();
                } else {
                    chunks.push({
                        offset: 0,
                        data: restChunk
                    });
                }
                return buf.byteLength;
            } else {
                const bufToFill = buf.subarray(0, chunkSize);
                const eof = await r1.readFull(bufToFill);
                if (eof === null) {
                    throw new Deno.errors.UnexpectedEof();
                }
                if (await tp.readLine() === null) {
                    throw new Deno.errors.UnexpectedEof();
                }
                return chunkSize;
            }
        } else {
            assert(chunkSize === 0);
            if (await r1.readLine() === null) {
                throw new Deno.errors.UnexpectedEof();
            }
            await readTrailers(h, r1);
            finished = true;
            return null;
        }
    }
    return {
        read
    };
}
var Status;
(function(Status1) {
    Status1[Status1["Continue"] = 100] = "Continue";
    Status1[Status1["SwitchingProtocols"] = 101] = "SwitchingProtocols";
    Status1[Status1["Processing"] = 102] = "Processing";
    Status1[Status1["EarlyHints"] = 103] = "EarlyHints";
    Status1[Status1["OK"] = 200] = "OK";
    Status1[Status1["Created"] = 201] = "Created";
    Status1[Status1["Accepted"] = 202] = "Accepted";
    Status1[Status1["NonAuthoritativeInfo"] = 203] = "NonAuthoritativeInfo";
    Status1[Status1["NoContent"] = 204] = "NoContent";
    Status1[Status1["ResetContent"] = 205] = "ResetContent";
    Status1[Status1["PartialContent"] = 206] = "PartialContent";
    Status1[Status1["MultiStatus"] = 207] = "MultiStatus";
    Status1[Status1["AlreadyReported"] = 208] = "AlreadyReported";
    Status1[Status1["IMUsed"] = 226] = "IMUsed";
    Status1[Status1["MultipleChoices"] = 300] = "MultipleChoices";
    Status1[Status1["MovedPermanently"] = 301] = "MovedPermanently";
    Status1[Status1["Found"] = 302] = "Found";
    Status1[Status1["SeeOther"] = 303] = "SeeOther";
    Status1[Status1["NotModified"] = 304] = "NotModified";
    Status1[Status1["UseProxy"] = 305] = "UseProxy";
    Status1[Status1["TemporaryRedirect"] = 307] = "TemporaryRedirect";
    Status1[Status1["PermanentRedirect"] = 308] = "PermanentRedirect";
    Status1[Status1["BadRequest"] = 400] = "BadRequest";
    Status1[Status1["Unauthorized"] = 401] = "Unauthorized";
    Status1[Status1["PaymentRequired"] = 402] = "PaymentRequired";
    Status1[Status1["Forbidden"] = 403] = "Forbidden";
    Status1[Status1["NotFound"] = 404] = "NotFound";
    Status1[Status1["MethodNotAllowed"] = 405] = "MethodNotAllowed";
    Status1[Status1["NotAcceptable"] = 406] = "NotAcceptable";
    Status1[Status1["ProxyAuthRequired"] = 407] = "ProxyAuthRequired";
    Status1[Status1["RequestTimeout"] = 408] = "RequestTimeout";
    Status1[Status1["Conflict"] = 409] = "Conflict";
    Status1[Status1["Gone"] = 410] = "Gone";
    Status1[Status1["LengthRequired"] = 411] = "LengthRequired";
    Status1[Status1["PreconditionFailed"] = 412] = "PreconditionFailed";
    Status1[Status1["RequestEntityTooLarge"] = 413] = "RequestEntityTooLarge";
    Status1[Status1["RequestURITooLong"] = 414] = "RequestURITooLong";
    Status1[Status1["UnsupportedMediaType"] = 415] = "UnsupportedMediaType";
    Status1[Status1["RequestedRangeNotSatisfiable"] = 416] = "RequestedRangeNotSatisfiable";
    Status1[Status1["ExpectationFailed"] = 417] = "ExpectationFailed";
    Status1[Status1["Teapot"] = 418] = "Teapot";
    Status1[Status1["MisdirectedRequest"] = 421] = "MisdirectedRequest";
    Status1[Status1["UnprocessableEntity"] = 422] = "UnprocessableEntity";
    Status1[Status1["Locked"] = 423] = "Locked";
    Status1[Status1["FailedDependency"] = 424] = "FailedDependency";
    Status1[Status1["TooEarly"] = 425] = "TooEarly";
    Status1[Status1["UpgradeRequired"] = 426] = "UpgradeRequired";
    Status1[Status1["PreconditionRequired"] = 428] = "PreconditionRequired";
    Status1[Status1["TooManyRequests"] = 429] = "TooManyRequests";
    Status1[Status1["RequestHeaderFieldsTooLarge"] = 431] = "RequestHeaderFieldsTooLarge";
    Status1[Status1["UnavailableForLegalReasons"] = 451] = "UnavailableForLegalReasons";
    Status1[Status1["InternalServerError"] = 500] = "InternalServerError";
    Status1[Status1["NotImplemented"] = 501] = "NotImplemented";
    Status1[Status1["BadGateway"] = 502] = "BadGateway";
    Status1[Status1["ServiceUnavailable"] = 503] = "ServiceUnavailable";
    Status1[Status1["GatewayTimeout"] = 504] = "GatewayTimeout";
    Status1[Status1["HTTPVersionNotSupported"] = 505] = "HTTPVersionNotSupported";
    Status1[Status1["VariantAlsoNegotiates"] = 506] = "VariantAlsoNegotiates";
    Status1[Status1["InsufficientStorage"] = 507] = "InsufficientStorage";
    Status1[Status1["LoopDetected"] = 508] = "LoopDetected";
    Status1[Status1["NotExtended"] = 510] = "NotExtended";
    Status1[Status1["NetworkAuthenticationRequired"] = 511] = "NetworkAuthenticationRequired";
})(Status || (Status = {
}));
const STATUS_TEXT = new Map([
    [
        Status.Continue,
        "Continue"
    ],
    [
        Status.SwitchingProtocols,
        "Switching Protocols"
    ],
    [
        Status.Processing,
        "Processing"
    ],
    [
        Status.EarlyHints,
        "Early Hints"
    ],
    [
        Status.OK,
        "OK"
    ],
    [
        Status.Created,
        "Created"
    ],
    [
        Status.Accepted,
        "Accepted"
    ],
    [
        Status.NonAuthoritativeInfo,
        "Non-Authoritative Information"
    ],
    [
        Status.NoContent,
        "No Content"
    ],
    [
        Status.ResetContent,
        "Reset Content"
    ],
    [
        Status.PartialContent,
        "Partial Content"
    ],
    [
        Status.MultiStatus,
        "Multi-Status"
    ],
    [
        Status.AlreadyReported,
        "Already Reported"
    ],
    [
        Status.IMUsed,
        "IM Used"
    ],
    [
        Status.MultipleChoices,
        "Multiple Choices"
    ],
    [
        Status.MovedPermanently,
        "Moved Permanently"
    ],
    [
        Status.Found,
        "Found"
    ],
    [
        Status.SeeOther,
        "See Other"
    ],
    [
        Status.NotModified,
        "Not Modified"
    ],
    [
        Status.UseProxy,
        "Use Proxy"
    ],
    [
        Status.TemporaryRedirect,
        "Temporary Redirect"
    ],
    [
        Status.PermanentRedirect,
        "Permanent Redirect"
    ],
    [
        Status.BadRequest,
        "Bad Request"
    ],
    [
        Status.Unauthorized,
        "Unauthorized"
    ],
    [
        Status.PaymentRequired,
        "Payment Required"
    ],
    [
        Status.Forbidden,
        "Forbidden"
    ],
    [
        Status.NotFound,
        "Not Found"
    ],
    [
        Status.MethodNotAllowed,
        "Method Not Allowed"
    ],
    [
        Status.NotAcceptable,
        "Not Acceptable"
    ],
    [
        Status.ProxyAuthRequired,
        "Proxy Authentication Required"
    ],
    [
        Status.RequestTimeout,
        "Request Timeout"
    ],
    [
        Status.Conflict,
        "Conflict"
    ],
    [
        Status.Gone,
        "Gone"
    ],
    [
        Status.LengthRequired,
        "Length Required"
    ],
    [
        Status.PreconditionFailed,
        "Precondition Failed"
    ],
    [
        Status.RequestEntityTooLarge,
        "Request Entity Too Large"
    ],
    [
        Status.RequestURITooLong,
        "Request URI Too Long"
    ],
    [
        Status.UnsupportedMediaType,
        "Unsupported Media Type"
    ],
    [
        Status.RequestedRangeNotSatisfiable,
        "Requested Range Not Satisfiable"
    ],
    [
        Status.ExpectationFailed,
        "Expectation Failed"
    ],
    [
        Status.Teapot,
        "I'm a teapot"
    ],
    [
        Status.MisdirectedRequest,
        "Misdirected Request"
    ],
    [
        Status.UnprocessableEntity,
        "Unprocessable Entity"
    ],
    [
        Status.Locked,
        "Locked"
    ],
    [
        Status.FailedDependency,
        "Failed Dependency"
    ],
    [
        Status.TooEarly,
        "Too Early"
    ],
    [
        Status.UpgradeRequired,
        "Upgrade Required"
    ],
    [
        Status.PreconditionRequired,
        "Precondition Required"
    ],
    [
        Status.TooManyRequests,
        "Too Many Requests"
    ],
    [
        Status.RequestHeaderFieldsTooLarge,
        "Request Header Fields Too Large"
    ],
    [
        Status.UnavailableForLegalReasons,
        "Unavailable For Legal Reasons"
    ],
    [
        Status.InternalServerError,
        "Internal Server Error"
    ],
    [
        Status.NotImplemented,
        "Not Implemented"
    ],
    [
        Status.BadGateway,
        "Bad Gateway"
    ],
    [
        Status.ServiceUnavailable,
        "Service Unavailable"
    ],
    [
        Status.GatewayTimeout,
        "Gateway Timeout"
    ],
    [
        Status.HTTPVersionNotSupported,
        "HTTP Version Not Supported"
    ],
    [
        Status.VariantAlsoNegotiates,
        "Variant Also Negotiates"
    ],
    [
        Status.InsufficientStorage,
        "Insufficient Storage"
    ],
    [
        Status.LoopDetected,
        "Loop Detected"
    ],
    [
        Status.NotExtended,
        "Not Extended"
    ],
    [
        Status.NetworkAuthenticationRequired,
        "Network Authentication Required"
    ], 
]);
const DEFAULT_BUFFER_SIZE = 32 * 1024;
async function writeAll(w, arr) {
    let nwritten = 0;
    while(nwritten < arr.length){
        nwritten += await w.write(arr.subarray(nwritten));
    }
}
const DEFAULT_BUF_SIZE = 4096;
const MIN_BUF_SIZE = 16;
const CR = "\r".charCodeAt(0);
const LF = "\n".charCodeAt(0);
class BufferFullError extends Error {
    partial;
    name = "BufferFullError";
    constructor(partial1){
        super("Buffer full");
        this.partial = partial1;
    }
}
class PartialReadError extends Error {
    name = "PartialReadError";
    partial;
    constructor(){
        super("Encountered UnexpectedEof, data only partially read");
    }
}
class BufReader {
    buf;
    rd;
    r = 0;
    w = 0;
    eof = false;
    static create(r, size = 4096) {
        return r instanceof BufReader ? r : new BufReader(r, size);
    }
    constructor(rd1, size1 = 4096){
        if (size1 < 16) {
            size1 = MIN_BUF_SIZE;
        }
        this._reset(new Uint8Array(size1), rd1);
    }
    size() {
        return this.buf.byteLength;
    }
    buffered() {
        return this.w - this.r;
    }
    async _fill() {
        if (this.r > 0) {
            this.buf.copyWithin(0, this.r, this.w);
            this.w -= this.r;
            this.r = 0;
        }
        if (this.w >= this.buf.byteLength) {
            throw Error("bufio: tried to fill full buffer");
        }
        for(let i = 100; i > 0; i--){
            const rr = await this.rd.read(this.buf.subarray(this.w));
            if (rr === null) {
                this.eof = true;
                return;
            }
            assert(rr >= 0, "negative read");
            this.w += rr;
            if (rr > 0) {
                return;
            }
        }
        throw new Error(`No progress after ${100} read() calls`);
    }
    reset(r) {
        this._reset(this.buf, r);
    }
    _reset(buf, rd) {
        this.buf = buf;
        this.rd = rd;
        this.eof = false;
    }
    async read(p) {
        let rr = p.byteLength;
        if (p.byteLength === 0) return rr;
        if (this.r === this.w) {
            if (p.byteLength >= this.buf.byteLength) {
                const rr1 = await this.rd.read(p);
                const nread = rr1 ?? 0;
                assert(nread >= 0, "negative read");
                return rr1;
            }
            this.r = 0;
            this.w = 0;
            rr = await this.rd.read(this.buf);
            if (rr === 0 || rr === null) return rr;
            assert(rr >= 0, "negative read");
            this.w += rr;
        }
        const copied = copy(this.buf.subarray(this.r, this.w), p, 0);
        this.r += copied;
        return copied;
    }
    async readFull(p) {
        let bytesRead = 0;
        while(bytesRead < p.length){
            try {
                const rr = await this.read(p.subarray(bytesRead));
                if (rr === null) {
                    if (bytesRead === 0) {
                        return null;
                    } else {
                        throw new PartialReadError();
                    }
                }
                bytesRead += rr;
            } catch (err) {
                err.partial = p.subarray(0, bytesRead);
                throw err;
            }
        }
        return p;
    }
    async readByte() {
        while(this.r === this.w){
            if (this.eof) return null;
            await this._fill();
        }
        const c = this.buf[this.r];
        this.r++;
        return c;
    }
    async readString(delim) {
        if (delim.length !== 1) {
            throw new Error("Delimiter should be a single character");
        }
        const buffer = await this.readSlice(delim.charCodeAt(0));
        if (buffer === null) return null;
        return new TextDecoder().decode(buffer);
    }
    async readLine() {
        let line;
        try {
            line = await this.readSlice(LF);
        } catch (err) {
            let { partial: partial2  } = err;
            assert(partial2 instanceof Uint8Array, "bufio: caught error from `readSlice()` without `partial` property");
            if (!(err instanceof BufferFullError)) {
                throw err;
            }
            if (!this.eof && partial2.byteLength > 0 && partial2[partial2.byteLength - 1] === CR) {
                assert(this.r > 0, "bufio: tried to rewind past start of buffer");
                this.r--;
                partial2 = partial2.subarray(0, partial2.byteLength - 1);
            }
            return {
                line: partial2,
                more: !this.eof
            };
        }
        if (line === null) {
            return null;
        }
        if (line.byteLength === 0) {
            return {
                line,
                more: false
            };
        }
        if (line[line.byteLength - 1] == LF) {
            let drop = 1;
            if (line.byteLength > 1 && line[line.byteLength - 2] === CR) {
                drop = 2;
            }
            line = line.subarray(0, line.byteLength - drop);
        }
        return {
            line,
            more: false
        };
    }
    async readSlice(delim) {
        let s = 0;
        let slice;
        while(true){
            let i = this.buf.subarray(this.r + s, this.w).indexOf(delim);
            if (i >= 0) {
                i += s;
                slice = this.buf.subarray(this.r, this.r + i + 1);
                this.r += i + 1;
                break;
            }
            if (this.eof) {
                if (this.r === this.w) {
                    return null;
                }
                slice = this.buf.subarray(this.r, this.w);
                this.r = this.w;
                break;
            }
            if (this.buffered() >= this.buf.byteLength) {
                this.r = this.w;
                const oldbuf = this.buf;
                const newbuf = this.buf.slice(0);
                this.buf = newbuf;
                throw new BufferFullError(oldbuf);
            }
            s = this.w - this.r;
            try {
                await this._fill();
            } catch (err) {
                err.partial = slice;
                throw err;
            }
        }
        return slice;
    }
    async peek(n) {
        if (n < 0) {
            throw Error("negative count");
        }
        let avail = this.w - this.r;
        while(avail < n && avail < this.buf.byteLength && !this.eof){
            try {
                await this._fill();
            } catch (err) {
                err.partial = this.buf.subarray(this.r, this.w);
                throw err;
            }
            avail = this.w - this.r;
        }
        if (avail === 0 && this.eof) {
            return null;
        } else if (avail < n && this.eof) {
            return this.buf.subarray(this.r, this.r + avail);
        } else if (avail < n) {
            throw new BufferFullError(this.buf.subarray(this.r, this.w));
        }
        return this.buf.subarray(this.r, this.r + n);
    }
}
class AbstractBufBase {
    buf;
    usedBufferBytes = 0;
    err = null;
    size() {
        return this.buf.byteLength;
    }
    available() {
        return this.buf.byteLength - this.usedBufferBytes;
    }
    buffered() {
        return this.usedBufferBytes;
    }
}
class BufWriter extends AbstractBufBase {
    writer;
    static create(writer, size = 4096) {
        return writer instanceof BufWriter ? writer : new BufWriter(writer, size);
    }
    constructor(writer1, size2 = 4096){
        super();
        this.writer = writer1;
        if (size2 <= 0) {
            size2 = DEFAULT_BUF_SIZE;
        }
        this.buf = new Uint8Array(size2);
    }
    reset(w) {
        this.err = null;
        this.usedBufferBytes = 0;
        this.writer = w;
    }
    async flush() {
        if (this.err !== null) throw this.err;
        if (this.usedBufferBytes === 0) return;
        try {
            await writeAll(this.writer, this.buf.subarray(0, this.usedBufferBytes));
        } catch (e) {
            this.err = e;
            throw e;
        }
        this.buf = new Uint8Array(this.buf.length);
        this.usedBufferBytes = 0;
    }
    async write(data) {
        if (this.err !== null) throw this.err;
        if (data.length === 0) return 0;
        let totalBytesWritten = 0;
        let numBytesWritten = 0;
        while(data.byteLength > this.available()){
            if (this.buffered() === 0) {
                try {
                    numBytesWritten = await this.writer.write(data);
                } catch (e) {
                    this.err = e;
                    throw e;
                }
            } else {
                numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
                this.usedBufferBytes += numBytesWritten;
                await this.flush();
            }
            totalBytesWritten += numBytesWritten;
            data = data.subarray(numBytesWritten);
        }
        numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
        this.usedBufferBytes += numBytesWritten;
        totalBytesWritten += numBytesWritten;
        return totalBytesWritten;
    }
}
function isProhibidedForTrailer(key) {
    const s = new Set([
        "transfer-encoding",
        "content-length",
        "trailer"
    ]);
    return s.has(key.toLowerCase());
}
async function readTrailers(headers, r2) {
    const trailers = parseTrailer(headers.get("trailer"));
    if (trailers == null) return;
    const trailerNames = [
        ...trailers.keys()
    ];
    const tp = new TextProtoReader(r2);
    const result = await tp.readMIMEHeader();
    if (result == null) {
        throw new Deno.errors.InvalidData("Missing trailer header.");
    }
    const undeclared = [
        ...result.keys()
    ].filter((k)=>!trailerNames.includes(k)
    );
    if (undeclared.length > 0) {
        throw new Deno.errors.InvalidData(`Undeclared trailers: ${Deno.inspect(undeclared)}.`);
    }
    for (const [k, v] of result){
        headers.append(k, v);
    }
    const missingTrailers = trailerNames.filter((k1)=>!result.has(k1)
    );
    if (missingTrailers.length > 0) {
        throw new Deno.errors.InvalidData(`Missing trailers: ${Deno.inspect(missingTrailers)}.`);
    }
    headers.delete("trailer");
}
function parseTrailer(field) {
    if (field == null) {
        return undefined;
    }
    const trailerNames = field.split(",").map((v)=>v.trim().toLowerCase()
    );
    if (trailerNames.length === 0) {
        throw new Deno.errors.InvalidData("Empty trailer header.");
    }
    const prohibited = trailerNames.filter((k)=>isProhibidedForTrailer(k)
    );
    if (prohibited.length > 0) {
        throw new Deno.errors.InvalidData(`Prohibited trailer names: ${Deno.inspect(prohibited)}.`);
    }
    return new Headers(trailerNames.map((key)=>[
            key,
            ""
        ]
    ));
}
function writeAllSync(w, arr) {
    let nwritten = 0;
    while(nwritten < arr.length){
        nwritten += w.writeSync(arr.subarray(nwritten));
    }
}
async function* iter(r2, options) {
    const bufSize = options?.bufSize ?? DEFAULT_BUFFER_SIZE;
    const b = new Uint8Array(bufSize);
    while(true){
        const result = await r2.read(b);
        if (result === null) {
            break;
        }
        yield b.subarray(0, result);
    }
}
async function writeChunkedBody(w, r2) {
    for await (const chunk of iter(r2)){
        if (chunk.byteLength <= 0) continue;
        const start = encoder.encode(`${chunk.byteLength.toString(16)}\r\n`);
        const end = encoder.encode("\r\n");
        await w.write(start);
        await w.write(chunk);
        await w.write(end);
        await w.flush();
    }
    const endChunk = encoder.encode("0\r\n\r\n");
    await w.write(endChunk);
}
async function writeTrailers(w, headers, trailers) {
    const trailer = headers.get("trailer");
    if (trailer === null) {
        throw new TypeError("Missing trailer header.");
    }
    const transferEncoding = headers.get("transfer-encoding");
    if (transferEncoding === null || !transferEncoding.match(/^chunked/)) {
        throw new TypeError(`Trailers are only allowed for "transfer-encoding: chunked", got "transfer-encoding: ${transferEncoding}".`);
    }
    const writer1 = BufWriter.create(w);
    const trailerNames = trailer.split(",").map((s)=>s.trim().toLowerCase()
    );
    const prohibitedTrailers = trailerNames.filter((k)=>isProhibidedForTrailer(k)
    );
    if (prohibitedTrailers.length > 0) {
        throw new TypeError(`Prohibited trailer names: ${Deno.inspect(prohibitedTrailers)}.`);
    }
    const undeclared = [
        ...trailers.keys()
    ].filter((k)=>!trailerNames.includes(k)
    );
    if (undeclared.length > 0) {
        throw new TypeError(`Undeclared trailers: ${Deno.inspect(undeclared)}.`);
    }
    for (const [key, value] of trailers){
        await writer1.write(encoder.encode(`${key}: ${value}\r\n`));
    }
    await writer1.write(encoder.encode("\r\n"));
    await writer1.flush();
}
async function writeResponse(w, r2) {
    const protoMajor = 1;
    const protoMinor = 1;
    const statusCode = r2.status || 200;
    const statusText = (r2.statusText ?? STATUS_TEXT.get(statusCode)) ?? null;
    const writer1 = BufWriter.create(w);
    if (statusText === null) {
        throw new Deno.errors.InvalidData("Empty statusText (explicitely pass an empty string if this was intentional)");
    }
    if (!r2.body) {
        r2.body = new Uint8Array();
    }
    if (typeof r2.body === "string") {
        r2.body = encoder.encode(r2.body);
    }
    let out = `HTTP/${1}.${1} ${statusCode} ${statusText}\r\n`;
    const headers = r2.headers ?? new Headers();
    if (r2.body && !headers.get("content-length")) {
        if (r2.body instanceof Uint8Array) {
            out += `content-length: ${r2.body.byteLength}\r\n`;
        } else if (!headers.get("transfer-encoding")) {
            out += "transfer-encoding: chunked\r\n";
        }
    }
    for (const [key, value] of headers){
        out += `${key}: ${value}\r\n`;
    }
    out += `\r\n`;
    const header = encoder.encode(out);
    const n = await writer1.write(header);
    assert(n === header.byteLength);
    if (r2.body instanceof Uint8Array) {
        const n1 = await writer1.write(r2.body);
        assert(n1 === r2.body.byteLength);
    } else if (headers.has("content-length")) {
        const contentLength = headers.get("content-length");
        assert(contentLength != null);
        const bodyLength = parseInt(contentLength);
        const n1 = await Deno.copy(r2.body, writer1);
        assert(n1 === bodyLength);
    } else {
        await writeChunkedBody(writer1, r2.body);
    }
    if (r2.trailers) {
        const t = await r2.trailers();
        await writeTrailers(writer1, headers, t);
    }
    await writer1.flush();
}
class ServerRequest {
    url;
    method;
    proto;
    protoMinor;
    protoMajor;
    headers;
    conn;
    r;
    w;
    #done = deferred();
    #contentLength = undefined;
    #body = undefined;
    #finalized = false;
    get done() {
        return this.#done.then((e)=>e
        );
    }
    get contentLength() {
        if (this.#contentLength === undefined) {
            const cl = this.headers.get("content-length");
            if (cl) {
                this.#contentLength = parseInt(cl);
                if (Number.isNaN(this.#contentLength)) {
                    this.#contentLength = null;
                }
            } else {
                this.#contentLength = null;
            }
        }
        return this.#contentLength;
    }
    get body() {
        if (!this.#body) {
            if (this.contentLength != null) {
                this.#body = bodyReader(this.contentLength, this.r);
            } else {
                const transferEncoding = this.headers.get("transfer-encoding");
                if (transferEncoding != null) {
                    const parts = transferEncoding.split(",").map((e)=>e.trim().toLowerCase()
                    );
                    assert(parts.includes("chunked"), 'transfer-encoding must include "chunked" if content-length is not set');
                    this.#body = chunkedBodyReader(this.headers, this.r);
                } else {
                    this.#body = emptyReader();
                }
            }
        }
        return this.#body;
    }
    async respond(r) {
        let err;
        try {
            await writeResponse(this.w, r);
        } catch (e) {
            try {
                this.conn.close();
            } catch  {
            }
            err = e;
        }
        this.#done.resolve(err);
        if (err) {
            throw err;
        }
    }
    async finalize() {
        if (this.#finalized) return;
        const body = this.body;
        const buf = new Uint8Array(1024);
        while(await body.read(buf) !== null){
        }
        this.#finalized = true;
    }
}
function parseHTTPVersion(vers) {
    switch(vers){
        case "HTTP/1.1":
            return [
                1,
                1
            ];
        case "HTTP/1.0":
            return [
                1,
                0
            ];
        default:
            {
                const Big = 1000000;
                if (!vers.startsWith("HTTP/")) {
                    break;
                }
                const dot = vers.indexOf(".");
                if (dot < 0) {
                    break;
                }
                const majorStr = vers.substring(vers.indexOf("/") + 1, dot);
                const major = Number(majorStr);
                if (!Number.isInteger(major) || major < 0 || major > 1000000) {
                    break;
                }
                const minorStr = vers.substring(dot + 1);
                const minor = Number(minorStr);
                if (!Number.isInteger(minor) || minor < 0 || minor > 1000000) {
                    break;
                }
                return [
                    major,
                    minor
                ];
            }
    }
    throw new Error(`malformed HTTP version ${vers}`);
}
async function readRequest(conn, bufr) {
    const tp = new TextProtoReader(bufr);
    const firstLine = await tp.readLine();
    if (firstLine === null) return null;
    const headers = await tp.readMIMEHeader();
    if (headers === null) throw new Deno.errors.UnexpectedEof();
    const req = new ServerRequest();
    req.conn = conn;
    req.r = bufr;
    [req.method, req.url, req.proto] = firstLine.split(" ", 3);
    [req.protoMajor, req.protoMinor] = parseHTTPVersion(req.proto);
    req.headers = headers;
    fixLength(req);
    return req;
}
class Server {
    listener;
    #closing = false;
    #connections = [];
    constructor(listener1){
        this.listener = listener1;
    }
    close() {
        this.#closing = true;
        this.listener.close();
        for (const conn of this.#connections){
            try {
                conn.close();
            } catch (e) {
                if (!(e instanceof Deno.errors.BadResource)) {
                    throw e;
                }
            }
        }
    }
    async *iterateHttpRequests(conn) {
        const reader = new BufReader(conn);
        const writer1 = new BufWriter(conn);
        while(!this.#closing){
            let request;
            try {
                request = await readRequest(conn, reader);
            } catch (error) {
                if (error instanceof Deno.errors.InvalidData || error instanceof Deno.errors.UnexpectedEof) {
                    try {
                        await writeResponse(writer1, {
                            status: 400,
                            body: new TextEncoder().encode(`${error.message}\r\n\r\n`)
                        });
                    } catch  {
                    }
                }
                break;
            }
            if (request === null) {
                break;
            }
            request.w = writer1;
            yield request;
            const responseError = await request.done;
            if (responseError) {
                this.untrackConnection(request.conn);
                return;
            }
            try {
                await request.finalize();
            } catch  {
                break;
            }
        }
        this.untrackConnection(conn);
        try {
            conn.close();
        } catch  {
        }
    }
    trackConnection(conn) {
        this.#connections.push(conn);
    }
    untrackConnection(conn) {
        const index = this.#connections.indexOf(conn);
        if (index !== -1) {
            this.#connections.splice(index, 1);
        }
    }
    async *acceptConnAndIterateHttpRequests(mux) {
        if (this.#closing) return;
        let conn;
        try {
            conn = await this.listener.accept();
        } catch (error) {
            if (error instanceof Deno.errors.BadResource || error instanceof Deno.errors.InvalidData || error instanceof Deno.errors.UnexpectedEof || error instanceof Deno.errors.ConnectionReset) {
                return mux.add(this.acceptConnAndIterateHttpRequests(mux));
            }
            throw error;
        }
        this.trackConnection(conn);
        mux.add(this.acceptConnAndIterateHttpRequests(mux));
        yield* this.iterateHttpRequests(conn);
    }
    [Symbol.asyncIterator]() {
        const mux = new MuxAsyncIterator();
        mux.add(this.acceptConnAndIterateHttpRequests(mux));
        return mux.iterate();
    }
}
function _parseAddrFromStr(addr) {
    let url;
    try {
        const host = addr.startsWith(":") ? `0.0.0.0${addr}` : addr;
        url = new URL(`http://${host}`);
    } catch  {
        throw new TypeError("Invalid address.");
    }
    if (url.username || url.password || url.pathname != "/" || url.search || url.hash) {
        throw new TypeError("Invalid address.");
    }
    return {
        hostname: url.hostname,
        port: url.port === "" ? 80 : Number(url.port)
    };
}
function serve(addr) {
    if (typeof addr === "string") {
        addr = _parseAddrFromStr(addr);
    }
    const listener1 = Deno.listen(addr);
    return new Server(listener1);
}
function fixLength(req) {
    const contentLength = req.headers.get("Content-Length");
    if (contentLength) {
        const arrClen = contentLength.split(",");
        if (arrClen.length > 1) {
            const distinct = [
                ...new Set(arrClen.map((e)=>e.trim()
                ))
            ];
            if (distinct.length > 1) {
                throw Error("cannot contain multiple Content-Length headers");
            } else {
                req.headers.set("Content-Length", distinct[0]);
            }
        }
        const c = req.headers.get("Content-Length");
        if (req.method === "HEAD" && c && c !== "0") {
            throw Error("http: method cannot contain a Content-Length");
        }
        if (c && req.headers.has("transfer-encoding")) {
            throw new Error("http: Transfer-Encoding and Content-Length cannot be send together");
        }
    }
}
class BufWriterSync extends AbstractBufBase {
    writer;
    static create(writer, size = 4096) {
        return writer instanceof BufWriterSync ? writer : new BufWriterSync(writer, size);
    }
    constructor(writer2, size3 = 4096){
        super();
        this.writer = writer2;
        if (size3 <= 0) {
            size3 = DEFAULT_BUF_SIZE;
        }
        this.buf = new Uint8Array(size3);
    }
    reset(w) {
        this.err = null;
        this.usedBufferBytes = 0;
        this.writer = w;
    }
    flush() {
        if (this.err !== null) throw this.err;
        if (this.usedBufferBytes === 0) return;
        try {
            writeAllSync(this.writer, this.buf.subarray(0, this.usedBufferBytes));
        } catch (e) {
            this.err = e;
            throw e;
        }
        this.buf = new Uint8Array(this.buf.length);
        this.usedBufferBytes = 0;
    }
    writeSync(data) {
        if (this.err !== null) throw this.err;
        if (data.length === 0) return 0;
        let totalBytesWritten = 0;
        let numBytesWritten = 0;
        while(data.byteLength > this.available()){
            if (this.buffered() === 0) {
                try {
                    numBytesWritten = this.writer.writeSync(data);
                } catch (e) {
                    this.err = e;
                    throw e;
                }
            } else {
                numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
                this.usedBufferBytes += numBytesWritten;
                this.flush();
            }
            totalBytesWritten += numBytesWritten;
            data = data.subarray(numBytesWritten);
        }
        numBytesWritten = copy(data, this.buf, this.usedBufferBytes);
        this.usedBufferBytes += numBytesWritten;
        totalBytesWritten += numBytesWritten;
        return totalBytesWritten;
    }
}
function hasOwnProperty(obj, v) {
    if (obj == null) {
        return false;
    }
    return Object.prototype.hasOwnProperty.call(obj, v);
}
async function readShort(buf) {
    const high = await buf.readByte();
    if (high === null) return null;
    const low = await buf.readByte();
    if (low === null) throw new Deno.errors.UnexpectedEof();
    return high << 8 | low;
}
async function readInt(buf) {
    const high = await readShort(buf);
    if (high === null) return null;
    const low = await readShort(buf);
    if (low === null) throw new Deno.errors.UnexpectedEof();
    return high << 16 | low;
}
const MAX_SAFE_INTEGER = BigInt(Number.MAX_SAFE_INTEGER);
async function readLong(buf) {
    const high = await readInt(buf);
    if (high === null) return null;
    const low = await readInt(buf);
    if (low === null) throw new Deno.errors.UnexpectedEof();
    const big = BigInt(high) << 32n | BigInt(low);
    if (big > MAX_SAFE_INTEGER) {
        throw new RangeError("Long value too big to be represented as a JavaScript number.");
    }
    return Number(big);
}
function sliceLongToBytes(d, dest = new Array(8)) {
    let big = BigInt(d);
    for(let i = 0; i < 8; i++){
        dest[7 - i] = Number(big & 255n);
        big >>= 8n;
    }
    return dest;
}
const HEX_CHARS = "0123456789abcdef".split("");
const EXTRA = [
    -2147483648,
    8388608,
    32768,
    128
];
const SHIFT = [
    24,
    16,
    8,
    0
];
const blocks = [];
class Sha1 {
    #blocks;
    #block;
    #start;
    #bytes;
    #hBytes;
    #finalized;
    #hashed;
    #h0 = 1732584193;
    #h1 = 4023233417;
    #h2 = 2562383102;
    #h3 = 271733878;
    #h4 = 3285377520;
    #lastByteIndex = 0;
    constructor(sharedMemory1 = false){
        this.init(sharedMemory1);
    }
    init(sharedMemory) {
        if (sharedMemory) {
            blocks[0] = blocks[16] = blocks[1] = blocks[2] = blocks[3] = blocks[4] = blocks[5] = blocks[6] = blocks[7] = blocks[8] = blocks[9] = blocks[10] = blocks[11] = blocks[12] = blocks[13] = blocks[14] = blocks[15] = 0;
            this.#blocks = blocks;
        } else {
            this.#blocks = [
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0
            ];
        }
        this.#h0 = 1732584193;
        this.#h1 = 4023233417;
        this.#h2 = 2562383102;
        this.#h3 = 271733878;
        this.#h4 = 3285377520;
        this.#block = this.#start = this.#bytes = this.#hBytes = 0;
        this.#finalized = this.#hashed = false;
    }
    update(message) {
        if (this.#finalized) {
            return this;
        }
        let msg;
        if (message instanceof ArrayBuffer) {
            msg = new Uint8Array(message);
        } else {
            msg = message;
        }
        let index = 0;
        const length = msg.length;
        const blocks1 = this.#blocks;
        while(index < length){
            let i;
            if (this.#hashed) {
                this.#hashed = false;
                blocks1[0] = this.#block;
                blocks1[16] = blocks1[1] = blocks1[2] = blocks1[3] = blocks1[4] = blocks1[5] = blocks1[6] = blocks1[7] = blocks1[8] = blocks1[9] = blocks1[10] = blocks1[11] = blocks1[12] = blocks1[13] = blocks1[14] = blocks1[15] = 0;
            }
            if (typeof msg !== "string") {
                for(i = this.#start; index < length && i < 64; ++index){
                    blocks1[i >> 2] |= msg[index] << SHIFT[(i++) & 3];
                }
            } else {
                for(i = this.#start; index < length && i < 64; ++index){
                    let code1 = msg.charCodeAt(index);
                    if (code1 < 128) {
                        blocks1[i >> 2] |= code1 << SHIFT[(i++) & 3];
                    } else if (code1 < 2048) {
                        blocks1[i >> 2] |= (192 | code1 >> 6) << SHIFT[(i++) & 3];
                        blocks1[i >> 2] |= (128 | code1 & 63) << SHIFT[(i++) & 3];
                    } else if (code1 < 55296 || code1 >= 57344) {
                        blocks1[i >> 2] |= (224 | code1 >> 12) << SHIFT[(i++) & 3];
                        blocks1[i >> 2] |= (128 | code1 >> 6 & 63) << SHIFT[(i++) & 3];
                        blocks1[i >> 2] |= (128 | code1 & 63) << SHIFT[(i++) & 3];
                    } else {
                        code1 = 65536 + ((code1 & 1023) << 10 | msg.charCodeAt(++index) & 1023);
                        blocks1[i >> 2] |= (240 | code1 >> 18) << SHIFT[(i++) & 3];
                        blocks1[i >> 2] |= (128 | code1 >> 12 & 63) << SHIFT[(i++) & 3];
                        blocks1[i >> 2] |= (128 | code1 >> 6 & 63) << SHIFT[(i++) & 3];
                        blocks1[i >> 2] |= (128 | code1 & 63) << SHIFT[(i++) & 3];
                    }
                }
            }
            this.#lastByteIndex = i;
            this.#bytes += i - this.#start;
            if (i >= 64) {
                this.#block = blocks1[16];
                this.#start = i - 64;
                this.hash();
                this.#hashed = true;
            } else {
                this.#start = i;
            }
        }
        if (this.#bytes > 4294967295) {
            this.#hBytes += this.#bytes / 4294967296 >>> 0;
            this.#bytes = this.#bytes >>> 0;
        }
        return this;
    }
    finalize() {
        if (this.#finalized) {
            return;
        }
        this.#finalized = true;
        const blocks1 = this.#blocks;
        const i = this.#lastByteIndex;
        blocks1[16] = this.#block;
        blocks1[i >> 2] |= EXTRA[i & 3];
        this.#block = blocks1[16];
        if (i >= 56) {
            if (!this.#hashed) {
                this.hash();
            }
            blocks1[0] = this.#block;
            blocks1[16] = blocks1[1] = blocks1[2] = blocks1[3] = blocks1[4] = blocks1[5] = blocks1[6] = blocks1[7] = blocks1[8] = blocks1[9] = blocks1[10] = blocks1[11] = blocks1[12] = blocks1[13] = blocks1[14] = blocks1[15] = 0;
        }
        blocks1[14] = this.#hBytes << 3 | this.#bytes >>> 29;
        blocks1[15] = this.#bytes << 3;
        this.hash();
    }
    hash() {
        let a = this.#h0;
        let b = this.#h1;
        let c = this.#h2;
        let d = this.#h3;
        let e = this.#h4;
        let f;
        let j;
        let t;
        const blocks1 = this.#blocks;
        for(j = 16; j < 80; ++j){
            t = blocks1[j - 3] ^ blocks1[j - 8] ^ blocks1[j - 14] ^ blocks1[j - 16];
            blocks1[j] = t << 1 | t >>> 31;
        }
        for(j = 0; j < 20; j += 5){
            f = b & c | ~b & d;
            t = a << 5 | a >>> 27;
            e = t + f + e + 1518500249 + blocks1[j] >>> 0;
            b = b << 30 | b >>> 2;
            f = a & b | ~a & c;
            t = e << 5 | e >>> 27;
            d = t + f + d + 1518500249 + blocks1[j + 1] >>> 0;
            a = a << 30 | a >>> 2;
            f = e & a | ~e & b;
            t = d << 5 | d >>> 27;
            c = t + f + c + 1518500249 + blocks1[j + 2] >>> 0;
            e = e << 30 | e >>> 2;
            f = d & e | ~d & a;
            t = c << 5 | c >>> 27;
            b = t + f + b + 1518500249 + blocks1[j + 3] >>> 0;
            d = d << 30 | d >>> 2;
            f = c & d | ~c & e;
            t = b << 5 | b >>> 27;
            a = t + f + a + 1518500249 + blocks1[j + 4] >>> 0;
            c = c << 30 | c >>> 2;
        }
        for(; j < 40; j += 5){
            f = b ^ c ^ d;
            t = a << 5 | a >>> 27;
            e = t + f + e + 1859775393 + blocks1[j] >>> 0;
            b = b << 30 | b >>> 2;
            f = a ^ b ^ c;
            t = e << 5 | e >>> 27;
            d = t + f + d + 1859775393 + blocks1[j + 1] >>> 0;
            a = a << 30 | a >>> 2;
            f = e ^ a ^ b;
            t = d << 5 | d >>> 27;
            c = t + f + c + 1859775393 + blocks1[j + 2] >>> 0;
            e = e << 30 | e >>> 2;
            f = d ^ e ^ a;
            t = c << 5 | c >>> 27;
            b = t + f + b + 1859775393 + blocks1[j + 3] >>> 0;
            d = d << 30 | d >>> 2;
            f = c ^ d ^ e;
            t = b << 5 | b >>> 27;
            a = t + f + a + 1859775393 + blocks1[j + 4] >>> 0;
            c = c << 30 | c >>> 2;
        }
        for(; j < 60; j += 5){
            f = b & c | b & d | c & d;
            t = a << 5 | a >>> 27;
            e = t + f + e - 1894007588 + blocks1[j] >>> 0;
            b = b << 30 | b >>> 2;
            f = a & b | a & c | b & c;
            t = e << 5 | e >>> 27;
            d = t + f + d - 1894007588 + blocks1[j + 1] >>> 0;
            a = a << 30 | a >>> 2;
            f = e & a | e & b | a & b;
            t = d << 5 | d >>> 27;
            c = t + f + c - 1894007588 + blocks1[j + 2] >>> 0;
            e = e << 30 | e >>> 2;
            f = d & e | d & a | e & a;
            t = c << 5 | c >>> 27;
            b = t + f + b - 1894007588 + blocks1[j + 3] >>> 0;
            d = d << 30 | d >>> 2;
            f = c & d | c & e | d & e;
            t = b << 5 | b >>> 27;
            a = t + f + a - 1894007588 + blocks1[j + 4] >>> 0;
            c = c << 30 | c >>> 2;
        }
        for(; j < 80; j += 5){
            f = b ^ c ^ d;
            t = a << 5 | a >>> 27;
            e = t + f + e - 899497514 + blocks1[j] >>> 0;
            b = b << 30 | b >>> 2;
            f = a ^ b ^ c;
            t = e << 5 | e >>> 27;
            d = t + f + d - 899497514 + blocks1[j + 1] >>> 0;
            a = a << 30 | a >>> 2;
            f = e ^ a ^ b;
            t = d << 5 | d >>> 27;
            c = t + f + c - 899497514 + blocks1[j + 2] >>> 0;
            e = e << 30 | e >>> 2;
            f = d ^ e ^ a;
            t = c << 5 | c >>> 27;
            b = t + f + b - 899497514 + blocks1[j + 3] >>> 0;
            d = d << 30 | d >>> 2;
            f = c ^ d ^ e;
            t = b << 5 | b >>> 27;
            a = t + f + a - 899497514 + blocks1[j + 4] >>> 0;
            c = c << 30 | c >>> 2;
        }
        this.#h0 = this.#h0 + a >>> 0;
        this.#h1 = this.#h1 + b >>> 0;
        this.#h2 = this.#h2 + c >>> 0;
        this.#h3 = this.#h3 + d >>> 0;
        this.#h4 = this.#h4 + e >>> 0;
    }
    hex() {
        this.finalize();
        const h0 = this.#h0;
        const h1 = this.#h1;
        const h2 = this.#h2;
        const h3 = this.#h3;
        const h4 = this.#h4;
        return HEX_CHARS[h0 >> 28 & 15] + HEX_CHARS[h0 >> 24 & 15] + HEX_CHARS[h0 >> 20 & 15] + HEX_CHARS[h0 >> 16 & 15] + HEX_CHARS[h0 >> 12 & 15] + HEX_CHARS[h0 >> 8 & 15] + HEX_CHARS[h0 >> 4 & 15] + HEX_CHARS[h0 & 15] + HEX_CHARS[h1 >> 28 & 15] + HEX_CHARS[h1 >> 24 & 15] + HEX_CHARS[h1 >> 20 & 15] + HEX_CHARS[h1 >> 16 & 15] + HEX_CHARS[h1 >> 12 & 15] + HEX_CHARS[h1 >> 8 & 15] + HEX_CHARS[h1 >> 4 & 15] + HEX_CHARS[h1 & 15] + HEX_CHARS[h2 >> 28 & 15] + HEX_CHARS[h2 >> 24 & 15] + HEX_CHARS[h2 >> 20 & 15] + HEX_CHARS[h2 >> 16 & 15] + HEX_CHARS[h2 >> 12 & 15] + HEX_CHARS[h2 >> 8 & 15] + HEX_CHARS[h2 >> 4 & 15] + HEX_CHARS[h2 & 15] + HEX_CHARS[h3 >> 28 & 15] + HEX_CHARS[h3 >> 24 & 15] + HEX_CHARS[h3 >> 20 & 15] + HEX_CHARS[h3 >> 16 & 15] + HEX_CHARS[h3 >> 12 & 15] + HEX_CHARS[h3 >> 8 & 15] + HEX_CHARS[h3 >> 4 & 15] + HEX_CHARS[h3 & 15] + HEX_CHARS[h4 >> 28 & 15] + HEX_CHARS[h4 >> 24 & 15] + HEX_CHARS[h4 >> 20 & 15] + HEX_CHARS[h4 >> 16 & 15] + HEX_CHARS[h4 >> 12 & 15] + HEX_CHARS[h4 >> 8 & 15] + HEX_CHARS[h4 >> 4 & 15] + HEX_CHARS[h4 & 15];
    }
    toString() {
        return this.hex();
    }
    digest() {
        this.finalize();
        const h0 = this.#h0;
        const h1 = this.#h1;
        const h2 = this.#h2;
        const h3 = this.#h3;
        const h4 = this.#h4;
        return [
            h0 >> 24 & 255,
            h0 >> 16 & 255,
            h0 >> 8 & 255,
            h0 & 255,
            h1 >> 24 & 255,
            h1 >> 16 & 255,
            h1 >> 8 & 255,
            h1 & 255,
            h2 >> 24 & 255,
            h2 >> 16 & 255,
            h2 >> 8 & 255,
            h2 & 255,
            h3 >> 24 & 255,
            h3 >> 16 & 255,
            h3 >> 8 & 255,
            h3 & 255,
            h4 >> 24 & 255,
            h4 >> 16 & 255,
            h4 >> 8 & 255,
            h4 & 255, 
        ];
    }
    array() {
        return this.digest();
    }
    arrayBuffer() {
        this.finalize();
        const buffer = new ArrayBuffer(20);
        const dataView = new DataView(buffer);
        dataView.setUint32(0, this.#h0);
        dataView.setUint32(4, this.#h1);
        dataView.setUint32(8, this.#h2);
        dataView.setUint32(12, this.#h3);
        dataView.setUint32(16, this.#h4);
        return buffer;
    }
}
class HmacSha1 extends Sha1 {
    #sharedMemory;
    #inner;
    #oKeyPad;
    constructor(secretKey, sharedMemory2 = false){
        super(sharedMemory2);
        let key1;
        if (typeof secretKey === "string") {
            const bytes = [];
            const length = secretKey.length;
            let index = 0;
            for(let i = 0; i < length; i++){
                let code1 = secretKey.charCodeAt(i);
                if (code1 < 128) {
                    bytes[index++] = code1;
                } else if (code1 < 2048) {
                    bytes[index++] = 192 | code1 >> 6;
                    bytes[index++] = 128 | code1 & 63;
                } else if (code1 < 55296 || code1 >= 57344) {
                    bytes[index++] = 224 | code1 >> 12;
                    bytes[index++] = 128 | code1 >> 6 & 63;
                    bytes[index++] = 128 | code1 & 63;
                } else {
                    code1 = 65536 + ((code1 & 1023) << 10 | secretKey.charCodeAt(++i) & 1023);
                    bytes[index++] = 240 | code1 >> 18;
                    bytes[index++] = 128 | code1 >> 12 & 63;
                    bytes[index++] = 128 | code1 >> 6 & 63;
                    bytes[index++] = 128 | code1 & 63;
                }
            }
            key1 = bytes;
        } else {
            if (secretKey instanceof ArrayBuffer) {
                key1 = new Uint8Array(secretKey);
            } else {
                key1 = secretKey;
            }
        }
        if (key1.length > 64) {
            key1 = new Sha1(true).update(key1).array();
        }
        const oKeyPad = [];
        const iKeyPad = [];
        for(let i = 0; i < 64; i++){
            const b = key1[i] || 0;
            oKeyPad[i] = 92 ^ b;
            iKeyPad[i] = 54 ^ b;
        }
        this.update(iKeyPad);
        this.#oKeyPad = oKeyPad;
        this.#inner = true;
        this.#sharedMemory = sharedMemory2;
    }
    finalize() {
        super.finalize();
        if (this.#inner) {
            this.#inner = false;
            const innerHash = this.array();
            super.init(this.#sharedMemory);
            this.update(this.#oKeyPad);
            this.update(innerHash);
            super.finalize();
        }
    }
}
var OpCode;
(function(OpCode1) {
    OpCode1[OpCode1["Continue"] = 0] = "Continue";
    OpCode1[OpCode1["TextFrame"] = 1] = "TextFrame";
    OpCode1[OpCode1["BinaryFrame"] = 2] = "BinaryFrame";
    OpCode1[OpCode1["Close"] = 8] = "Close";
    OpCode1[OpCode1["Ping"] = 9] = "Ping";
    OpCode1[OpCode1["Pong"] = 10] = "Pong";
})(OpCode || (OpCode = {
}));
function isWebSocketCloseEvent(a) {
    return hasOwnProperty(a, "code");
}
function unmask(payload, mask) {
    if (mask) {
        for(let i1 = 0, len = payload.length; i1 < len; i1++){
            payload[i1] ^= mask[i1 & 3];
        }
    }
}
async function writeFrame(frame, writer3) {
    const payloadLength = frame.payload.byteLength;
    let header;
    const hasMask = frame.mask ? 128 : 0;
    if (frame.mask && frame.mask.byteLength !== 4) {
        throw new Error("invalid mask. mask must be 4 bytes: length=" + frame.mask.byteLength);
    }
    if (payloadLength < 126) {
        header = new Uint8Array([
            128 | frame.opcode,
            hasMask | payloadLength
        ]);
    } else if (payloadLength < 65535) {
        header = new Uint8Array([
            128 | frame.opcode,
            hasMask | 126,
            payloadLength >>> 8,
            payloadLength & 255, 
        ]);
    } else {
        header = new Uint8Array([
            128 | frame.opcode,
            hasMask | 127,
            ...sliceLongToBytes(payloadLength), 
        ]);
    }
    if (frame.mask) {
        header = concat(header, frame.mask);
    }
    unmask(frame.payload, frame.mask);
    header = concat(header, frame.payload);
    const w = BufWriter.create(writer3);
    await w.write(header);
    await w.flush();
}
async function readFrame(buf) {
    let b = await buf.readByte();
    assert(b !== null);
    let isLastFrame = false;
    switch(b >>> 4){
        case 8:
            isLastFrame = true;
            break;
        case 0:
            isLastFrame = false;
            break;
        default:
            throw new Error("invalid signature");
    }
    const opcode = b & 15;
    b = await buf.readByte();
    assert(b !== null);
    const hasMask = b >>> 7;
    let payloadLength = b & 127;
    if (payloadLength === 126) {
        const l = await readShort(buf);
        assert(l !== null);
        payloadLength = l;
    } else if (payloadLength === 127) {
        const l = await readLong(buf);
        assert(l !== null);
        payloadLength = Number(l);
    }
    let mask;
    if (hasMask) {
        mask = new Uint8Array(4);
        assert(await buf.readFull(mask) !== null);
    }
    const payload = new Uint8Array(payloadLength);
    assert(await buf.readFull(payload) !== null);
    return {
        isLastFrame,
        opcode,
        mask,
        payload
    };
}
class WebSocketImpl {
    conn;
    mask;
    bufReader;
    bufWriter;
    sendQueue = [];
    constructor({ conn , bufReader , bufWriter , mask  }){
        this.conn = conn;
        this.mask = mask;
        this.bufReader = bufReader || new BufReader(conn);
        this.bufWriter = bufWriter || new BufWriter(conn);
    }
    async *[Symbol.asyncIterator]() {
        const decoder1 = new TextDecoder();
        let frames = [];
        let payloadsLength = 0;
        while(!this._isClosed){
            let frame;
            try {
                frame = await readFrame(this.bufReader);
            } catch  {
                this.ensureSocketClosed();
                break;
            }
            unmask(frame.payload, frame.mask);
            switch(frame.opcode){
                case OpCode.TextFrame:
                case OpCode.BinaryFrame:
                case OpCode.Continue:
                    frames.push(frame);
                    payloadsLength += frame.payload.length;
                    if (frame.isLastFrame) {
                        const concat1 = new Uint8Array(payloadsLength);
                        let offs = 0;
                        for (const frame1 of frames){
                            concat1.set(frame1.payload, offs);
                            offs += frame1.payload.length;
                        }
                        if (frames[0].opcode === OpCode.TextFrame) {
                            yield decoder1.decode(concat1);
                        } else {
                            yield concat1;
                        }
                        frames = [];
                        payloadsLength = 0;
                    }
                    break;
                case OpCode.Close:
                    {
                        const code1 = frame.payload[0] << 8 | frame.payload[1];
                        const reason = decoder1.decode(frame.payload.subarray(2, frame.payload.length));
                        await this.close(code1, reason);
                        yield {
                            code: code1,
                            reason
                        };
                        return;
                    }
                case OpCode.Ping:
                    await this.enqueue({
                        opcode: OpCode.Pong,
                        payload: frame.payload,
                        isLastFrame: true
                    });
                    yield [
                        "ping",
                        frame.payload
                    ];
                    break;
                case OpCode.Pong:
                    yield [
                        "pong",
                        frame.payload
                    ];
                    break;
                default:
            }
        }
    }
    dequeue() {
        const [entry] = this.sendQueue;
        if (!entry) return;
        if (this._isClosed) return;
        const { d , frame  } = entry;
        writeFrame(frame, this.bufWriter).then(()=>d.resolve()
        ).catch((e)=>d.reject(e)
        ).finally(()=>{
            this.sendQueue.shift();
            this.dequeue();
        });
    }
    enqueue(frame) {
        if (this._isClosed) {
            throw new Deno.errors.ConnectionReset("Socket has already been closed");
        }
        const d = deferred();
        this.sendQueue.push({
            d,
            frame
        });
        if (this.sendQueue.length === 1) {
            this.dequeue();
        }
        return d;
    }
    send(data) {
        const opcode = typeof data === "string" ? OpCode.TextFrame : OpCode.BinaryFrame;
        const payload = typeof data === "string" ? new TextEncoder().encode(data) : data;
        const isLastFrame = true;
        const frame = {
            isLastFrame: true,
            opcode,
            payload,
            mask: this.mask
        };
        return this.enqueue(frame);
    }
    ping(data = "") {
        const payload = typeof data === "string" ? new TextEncoder().encode(data) : data;
        const frame = {
            isLastFrame: true,
            opcode: OpCode.Ping,
            mask: this.mask,
            payload
        };
        return this.enqueue(frame);
    }
    _isClosed = false;
    get isClosed() {
        return this._isClosed;
    }
    async close(code = 1000, reason) {
        try {
            const header = [
                code >>> 8,
                code & 255
            ];
            let payload;
            if (reason) {
                const reasonBytes = new TextEncoder().encode(reason);
                payload = new Uint8Array(2 + reasonBytes.byteLength);
                payload.set(header);
                payload.set(reasonBytes, 2);
            } else {
                payload = new Uint8Array(header);
            }
            await this.enqueue({
                isLastFrame: true,
                opcode: OpCode.Close,
                mask: this.mask,
                payload
            });
        } catch (e) {
            throw e;
        } finally{
            this.ensureSocketClosed();
        }
    }
    closeForce() {
        this.ensureSocketClosed();
    }
    ensureSocketClosed() {
        if (this.isClosed) return;
        try {
            this.conn.close();
        } catch (e) {
            console.error(e);
        } finally{
            this._isClosed = true;
            const rest = this.sendQueue;
            this.sendQueue = [];
            rest.forEach((e)=>e.d.reject(new Deno.errors.ConnectionReset("Socket has already been closed"))
            );
        }
    }
}
function acceptable(req) {
    const upgrade = req.headers.get("upgrade");
    if (!upgrade || upgrade.toLowerCase() !== "websocket") {
        return false;
    }
    const secKey = req.headers.get("sec-websocket-key");
    return req.headers.has("sec-websocket-key") && typeof secKey === "string" && secKey.length > 0;
}
const kGUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
function createSecAccept(nonce) {
    const sha1 = new Sha1();
    sha1.update(nonce + kGUID);
    const bytes = sha1.digest();
    return btoa(String.fromCharCode(...bytes));
}
async function acceptWebSocket(req) {
    const { conn: conn1 , headers , bufReader: bufReader1 , bufWriter: bufWriter1  } = req;
    if (acceptable(req)) {
        const sock = new WebSocketImpl({
            conn: conn1,
            bufReader: bufReader1,
            bufWriter: bufWriter1
        });
        const secKey = headers.get("sec-websocket-key");
        if (typeof secKey !== "string") {
            throw new Error("sec-websocket-key is not provided");
        }
        const secAccept = createSecAccept(secKey);
        const newHeaders = new Headers({
            Upgrade: "websocket",
            Connection: "Upgrade",
            "Sec-WebSocket-Accept": secAccept
        });
        const secProtocol = headers.get("sec-websocket-protocol");
        if (typeof secProtocol === "string") {
            newHeaders.set("Sec-WebSocket-Protocol", secProtocol);
        }
        const secVersion = headers.get("sec-websocket-version");
        if (typeof secVersion === "string") {
            newHeaders.set("Sec-WebSocket-Version", secVersion);
        }
        await writeResponse(bufWriter1, {
            status: 101,
            headers: newHeaders
        });
        return sock;
    }
    throw new Error("request is not acceptable");
}
function bytesToUuid(bytes) {
    const bits = [
        ...bytes
    ].map((bit)=>{
        const s = bit.toString(16);
        return bit < 16 ? "0" + s : s;
    });
    return [
        ...bits.slice(0, 4),
        "-",
        ...bits.slice(4, 6),
        "-",
        ...bits.slice(6, 8),
        "-",
        ...bits.slice(8, 10),
        "-",
        ...bits.slice(10, 16), 
    ].join("");
}
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validate(id) {
    return UUID_RE.test(id);
}
function generate() {
    const rnds = crypto.getRandomValues(new Uint8Array(16));
    rnds[6] = rnds[6] & 15 | 64;
    rnds[8] = rnds[8] & 63 | 128;
    return bytesToUuid(rnds);
}
const mod1 = function() {
    return {
        validate: validate,
        generate: generate
    };
}();
const base64abc = [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z",
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h",
    "i",
    "j",
    "k",
    "l",
    "m",
    "n",
    "o",
    "p",
    "q",
    "r",
    "s",
    "t",
    "u",
    "v",
    "w",
    "x",
    "y",
    "z",
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "+",
    "/"
];
function encode(data) {
    const uint8 = typeof data === "string" ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
    let result = "", i1;
    const l = uint8.length;
    for(i1 = 2; i1 < l; i1 += 3){
        result += base64abc[uint8[i1 - 2] >> 2];
        result += base64abc[(uint8[i1 - 2] & 3) << 4 | uint8[i1 - 1] >> 4];
        result += base64abc[(uint8[i1 - 1] & 15) << 2 | uint8[i1] >> 6];
        result += base64abc[uint8[i1] & 63];
    }
    if (i1 === l + 1) {
        result += base64abc[uint8[i1 - 2] >> 2];
        result += base64abc[(uint8[i1 - 2] & 3) << 4];
        result += "==";
    }
    if (i1 === l) {
        result += base64abc[uint8[i1 - 2] >> 2];
        result += base64abc[(uint8[i1 - 2] & 3) << 4 | uint8[i1 - 1] >> 4];
        result += base64abc[(uint8[i1 - 1] & 15) << 2];
        result += "=";
    }
    return result;
}
const ESC = "\x1B";
const CSI = `${ESC}[`;
const OSC = `${ESC}]`;
const SEP = ";";
const bel = "\u0007";
const cursorPosition = `${CSI}6n`;
function cursorTo(x, y) {
    if (typeof y !== "number") {
        return `${CSI}${x}G`;
    }
    return `${CSI}${y};${x}H`;
}
function cursorMove(x, y) {
    let ret = "";
    if (x < 0) {
        ret += `${CSI}${-x}D`;
    } else if (x > 0) {
        ret += `${CSI}${x}C`;
    }
    if (y < 0) {
        ret += `${CSI}${-y}A`;
    } else if (y > 0) {
        ret += `${CSI}${y}B`;
    }
    return ret;
}
function cursorUp(count = 1) {
    return `${CSI}${count}A`;
}
function cursorDown(count = 1) {
    return `${CSI}${count}B`;
}
function cursorForward(count = 1) {
    return `${CSI}${count}C`;
}
function cursorBackward(count = 1) {
    return `${CSI}${count}D`;
}
function cursorNextLine(count = 1) {
    return `${CSI}E`.repeat(count);
}
function cursorPrevLine(count = 1) {
    return `${CSI}F`.repeat(count);
}
const cursorLeft = `${CSI}G`;
const cursorHide = `${CSI}?25l`;
const cursorShow = `${CSI}?25h`;
const cursorSave = `${ESC}7`;
const cursorRestore = `${ESC}8`;
function scrollUp(count = 1) {
    return `${CSI}S`.repeat(count);
}
function scrollDown(count = 1) {
    return `${CSI}T`.repeat(count);
}
const eraseScreen = `${CSI}2J`;
function eraseUp(count = 1) {
    return `${CSI}1J`.repeat(count);
}
function eraseDown(count = 1) {
    return `${CSI}0J`.repeat(count);
}
const eraseLine = `${CSI}2K`;
const eraseLineEnd = `${CSI}0K`;
const eraseLineStart = `${CSI}1K`;
function eraseLines(count) {
    let clear = "";
    for(let i1 = 0; i1 < count; i1++){
        clear += eraseLine + (i1 < count - 1 ? cursorUp() : "");
    }
    clear += cursorLeft;
    return clear;
}
const clearScreen = "\u001Bc";
const clearTerminal = Deno.build.os === "windows" ? `${eraseScreen}${CSI}0f` : `${eraseScreen}${CSI}3J${CSI}H`;
function link(text, url) {
    return [
        OSC,
        "8",
        SEP,
        SEP,
        url,
        bel,
        text,
        OSC,
        "8",
        SEP,
        SEP,
        bel, 
    ].join("");
}
function image(buffer, options) {
    let ret = `${OSC}1337;File=inline=1`;
    if (options?.width) {
        ret += `;width=${options.width}`;
    }
    if (options?.height) {
        ret += `;height=${options.height}`;
    }
    if (options?.preserveAspectRatio === false) {
        ret += ";preserveAspectRatio=0";
    }
    return ret + ":" + encode(buffer) + bel;
}
const mod2 = function() {
    return {
        bel: bel,
        cursorPosition: cursorPosition,
        cursorTo: cursorTo,
        cursorMove: cursorMove,
        cursorUp: cursorUp,
        cursorDown: cursorDown,
        cursorForward: cursorForward,
        cursorBackward: cursorBackward,
        cursorNextLine: cursorNextLine,
        cursorPrevLine: cursorPrevLine,
        cursorLeft: cursorLeft,
        cursorHide: cursorHide,
        cursorShow: cursorShow,
        cursorSave: cursorSave,
        cursorRestore: cursorRestore,
        scrollUp: scrollUp,
        scrollDown: scrollDown,
        eraseScreen: eraseScreen,
        eraseUp: eraseUp,
        eraseDown: eraseDown,
        eraseLine: eraseLine,
        eraseLineEnd: eraseLineEnd,
        eraseLineStart: eraseLineStart,
        eraseLines: eraseLines,
        clearScreen: clearScreen,
        clearTerminal: clearTerminal,
        link: link,
        image: image
    };
}();
const proto = Object.create(null);
const methodNames = Object.keys(mod);
for (const name18 of methodNames){
    if (name18 === "setColorEnabled" || name18 === "getColorEnabled") {
        continue;
    }
    Object.defineProperty(proto, name18, {
        get () {
            return factory1([
                ...this._stack,
                name18
            ]);
        }
    });
}
const colors1 = factory1();
function factory1(stack = []) {
    const colors1 = function(str1, ...args) {
        if (str1) {
            const lastIndex = stack.length - 1;
            return stack.reduce((str2, name1, index)=>index === lastIndex ? mod[name1](str2, ...args) : mod[name1](str2)
            , str1);
        }
        const tmp = stack.slice();
        stack = [];
        return factory1(tmp);
    };
    Object.setPrototypeOf(colors1, proto);
    colors1._stack = stack;
    return colors1;
}
function getCursorPosition({ stdin =Deno.stdin , stdout =Deno.stdout  } = {
}) {
    const data = new Uint8Array(8);
    Deno.setRaw(stdin.rid, true);
    stdout.writeSync(new TextEncoder().encode(cursorPosition));
    stdin.readSync(data);
    Deno.setRaw(stdin.rid, false);
    const [y, x] = new TextDecoder().decode(data).match(/\[(\d+);(\d+)R/)?.slice(1, 3).map(Number) ?? [
        0,
        0
    ];
    return {
        x,
        y
    };
}
const tty1 = factory2();
function factory2(options) {
    let result = "";
    let stack = [];
    const stdout = options?.stdout ?? Deno.stdout;
    const stdin = options?.stdin ?? Deno.stdin;
    const tty1 = function(...args) {
        if (this) {
            update(args);
            stdout.writeSync(new TextEncoder().encode(result));
            return this;
        }
        return factory2(args[0] ?? options);
    };
    tty1.text = function(text) {
        stack.push([
            text,
            []
        ]);
        update();
        stdout.writeSync(new TextEncoder().encode(result));
        return this;
    };
    tty1.getCursorPosition = ()=>getCursorPosition({
            stdout,
            stdin
        })
    ;
    const methodList = Object.entries(mod2);
    for (const [name1, method] of methodList){
        if (name1 === "cursorPosition") {
            continue;
        }
        Object.defineProperty(tty1, name1, {
            get () {
                stack.push([
                    method,
                    []
                ]);
                return this;
            }
        });
    }
    return tty1;
    function update(args) {
        if (!stack.length) {
            return;
        }
        if (args) {
            stack[stack.length - 1][1] = args;
        }
        result = stack.reduce((prev, [cur, args1])=>prev + (typeof cur === "string" ? cur : cur.call(tty1, ...args1))
        , "");
        stack = [];
    }
}
function distance(a, b) {
    if (a.length == 0) {
        return b.length;
    }
    if (b.length == 0) {
        return a.length;
    }
    const matrix = [];
    for(let i1 = 0; i1 <= b.length; i1++){
        matrix[i1] = [
            i1
        ];
    }
    for(let j = 0; j <= a.length; j++){
        matrix[0][j] = j;
    }
    for(let i2 = 1; i2 <= b.length; i2++){
        for(let j1 = 1; j1 <= a.length; j1++){
            if (b.charAt(i2 - 1) == a.charAt(j1 - 1)) {
                matrix[i2][j1] = matrix[i2 - 1][j1 - 1];
            } else {
                matrix[i2][j1] = Math.min(matrix[i2 - 1][j1 - 1] + 1, Math.min(matrix[i2][j1 - 1] + 1, matrix[i2 - 1][j1] + 1));
            }
        }
    }
    return matrix[b.length][a.length];
}
function paramCaseToCamelCase(str1) {
    return str1.replace(/-([a-z])/g, (g)=>g[1].toUpperCase()
    );
}
function getOption(flags, name1) {
    while(name1[0] === "-"){
        name1 = name1.slice(1);
    }
    for (const flag of flags){
        if (isOption(flag, name1)) {
            return flag;
        }
    }
    return;
}
function didYouMeanOption(option, options) {
    const optionNames = options.map((option1)=>[
            option1.name,
            ...option1.aliases ?? []
        ]
    ).flat().map((option1)=>getFlag(option1)
    );
    return didYouMean(" Did you mean option", getFlag(option), optionNames);
}
function didYouMeanType(type, types) {
    return didYouMean(" Did you mean type", type, types);
}
function didYouMean(message3, type, types) {
    const match = closest(type, types);
    return match ? `${message3} "${match}"?` : "";
}
function getFlag(name1) {
    if (name1.startsWith("-")) {
        return name1;
    }
    if (name1.length > 1) {
        return `--${name1}`;
    }
    return `-${name1}`;
}
function isOption(option, name1) {
    return option.name === name1 || option.aliases && option.aliases.indexOf(name1) !== -1;
}
function closest(str1, arr) {
    let minDistance = Infinity;
    let minIndex = 0;
    for(let i1 = 0; i1 < arr.length; i1++){
        const dist = distance(str1, arr[i1]);
        if (dist < minDistance) {
            minDistance = dist;
            minIndex = i1;
        }
    }
    return arr[minIndex];
}
function getDefaultValue(option) {
    return typeof option.default === "function" ? option.default() : option.default;
}
class FlagsError extends Error {
    constructor(message3){
        super(message3);
        Object.setPrototypeOf(this, FlagsError.prototype);
    }
}
class UnknownRequiredOption extends FlagsError {
    constructor(option9, options3){
        super(`Unknown required option "${getFlag(option9)}".${didYouMeanOption(option9, options3)}`);
        Object.setPrototypeOf(this, UnknownRequiredOption.prototype);
    }
}
class UnknownConflictingOption extends FlagsError {
    constructor(option1, options1){
        super(`Unknown conflicting option "${getFlag(option1)}".${didYouMeanOption(option1, options1)}`);
        Object.setPrototypeOf(this, UnknownConflictingOption.prototype);
    }
}
class UnknownType extends FlagsError {
    constructor(type2, types1){
        super(`Unknown type "${type2}".${didYouMeanType(type2, types1)}`);
        Object.setPrototypeOf(this, UnknownType.prototype);
    }
}
class ValidationError extends FlagsError {
    constructor(message4){
        super(message4);
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}
class DuplicateOption extends ValidationError {
    constructor(name1){
        super(`Option "${getFlag(name1).replace(/^--no-/, "--")}" can only occur once, but was found several times.`);
        Object.setPrototypeOf(this, DuplicateOption.prototype);
    }
}
class UnknownOption extends ValidationError {
    constructor(option2, options2){
        super(`Unknown option "${getFlag(option2)}".${didYouMeanOption(option2, options2)}`);
        Object.setPrototypeOf(this, UnknownOption.prototype);
    }
}
class MissingOptionValue extends ValidationError {
    constructor(option3){
        super(`Missing value for option "${getFlag(option3)}".`);
        Object.setPrototypeOf(this, MissingOptionValue.prototype);
    }
}
class InvalidOptionValue extends ValidationError {
    constructor(option4, expected, value2){
        super(`Option "${getFlag(option4)}" must be of type "${expected}", but got "${value2}".`);
        Object.setPrototypeOf(this, InvalidOptionValue.prototype);
    }
}
class OptionNotCombinable extends ValidationError {
    constructor(option5){
        super(`Option "${getFlag(option5)}" cannot be combined with other options.`);
        Object.setPrototypeOf(this, OptionNotCombinable.prototype);
    }
}
class ConflictingOption extends ValidationError {
    constructor(option6, conflictingOption){
        super(`Option "${getFlag(option6)}" conflicts with option "${getFlag(conflictingOption)}".`);
        Object.setPrototypeOf(this, ConflictingOption.prototype);
    }
}
class DependingOption extends ValidationError {
    constructor(option7, dependingOption){
        super(`Option "${getFlag(option7)}" depends on option "${getFlag(dependingOption)}".`);
        Object.setPrototypeOf(this, DependingOption.prototype);
    }
}
class MissingRequiredOption extends ValidationError {
    constructor(option8){
        super(`Missing required option "${getFlag(option8)}".`);
        Object.setPrototypeOf(this, MissingRequiredOption.prototype);
    }
}
class RequiredArgumentFollowsOptionalArgument extends ValidationError {
    constructor(arg3){
        super(`An required argument cannot follow an optional argument, but "${arg3}"  is defined as required.`);
        Object.setPrototypeOf(this, RequiredArgumentFollowsOptionalArgument.prototype);
    }
}
class ArgumentFollowsVariadicArgument extends ValidationError {
    constructor(arg1){
        super(`An argument cannot follow an variadic argument, but got "${arg1}".`);
        Object.setPrototypeOf(this, ArgumentFollowsVariadicArgument.prototype);
    }
}
class NoArguments extends ValidationError {
    constructor(){
        super(`No arguments.`);
        Object.setPrototypeOf(this, NoArguments.prototype);
    }
}
class InvalidTypeError extends ValidationError {
    constructor({ label: label1 , name: name2 , value: value1 , type: type1  }, expected1){
        super(`${label1} "${name2}" must be of type "${type1}", but got "${value1}".` + (expected1 ? ` Expected values: ${expected1.map((value2)=>`"${value2}"`
        ).join(", ")}` : ""));
        Object.setPrototypeOf(this, MissingOptionValue.prototype);
    }
}
function normalize(args) {
    const normalized = [];
    let inLiteral = false;
    for (const arg2 of args){
        if (inLiteral) {
            normalized.push(arg2);
        } else if (arg2 === "--") {
            inLiteral = true;
            normalized.push(arg2);
        } else if (arg2.length > 1 && arg2[0] === "-") {
            const isLong = arg2[1] === "-";
            const isDotted = !isLong && arg2[2] === ".";
            if (arg2.includes("=")) {
                const parts = arg2.split("=");
                const flag = parts.shift();
                if (isLong) {
                    normalized.push(flag);
                } else {
                    normalizeShortFlags(flag);
                }
                normalized.push(parts.join("="));
            } else if (isLong || isDotted) {
                normalized.push(arg2);
            } else {
                normalizeShortFlags(arg2);
            }
        } else {
            normalized.push(arg2);
        }
    }
    return normalized;
    function normalizeShortFlags(flag) {
        const flags = flag.slice(1).split("");
        if (isNaN(Number(flag[flag.length - 1]))) {
            flags.forEach((val)=>normalized.push(`-${val}`)
            );
        } else {
            normalized.push(`-${flags.shift()}`);
            normalized.push(flags.join(""));
        }
    }
}
var OptionType;
(function(OptionType1) {
    OptionType1["STRING"] = "string";
    OptionType1["NUMBER"] = "number";
    OptionType1["INTEGER"] = "integer";
    OptionType1["BOOLEAN"] = "boolean";
})(OptionType || (OptionType = {
}));
const __boolean = (type2)=>{
    if (~[
        "1",
        "true"
    ].indexOf(type2.value)) {
        return true;
    }
    if (~[
        "0",
        "false"
    ].indexOf(type2.value)) {
        return false;
    }
    throw new InvalidTypeError(type2);
};
const number = (type2)=>{
    const value2 = Number(type2.value);
    if (Number.isFinite(value2)) {
        return value2;
    }
    throw new InvalidTypeError(type2);
};
const string = ({ value: value2  })=>{
    return value2;
};
function validateFlags(flags, values, _knownFlaks, allowEmpty, optionNames = {
}) {
    const defaultValues = {
    };
    for (const option9 of flags){
        let name3;
        let defaultValue = undefined;
        if (option9.name.startsWith("no-")) {
            const propName = option9.name.replace(/^no-/, "");
            if (propName in values) {
                continue;
            }
            const positiveOption = getOption(flags, propName);
            if (positiveOption) {
                continue;
            }
            name3 = paramCaseToCamelCase(propName);
            defaultValue = true;
        }
        if (!name3) {
            name3 = paramCaseToCamelCase(option9.name);
        }
        if (!(name3 in optionNames)) {
            optionNames[name3] = option9.name;
        }
        const hasDefaultValue = typeof values[name3] === "undefined" && (typeof option9.default !== "undefined" || typeof defaultValue !== "undefined");
        if (hasDefaultValue) {
            values[name3] = getDefaultValue(option9) ?? defaultValue;
            defaultValues[option9.name] = true;
            if (typeof option9.value === "function") {
                values[name3] = option9.value(values[name3]);
            }
        }
    }
    const keys = Object.keys(values);
    if (keys.length === 0 && allowEmpty) {
        return;
    }
    const options3 = keys.map((name3)=>({
            name: name3,
            option: getOption(flags, optionNames[name3])
        })
    );
    for (const { name: name3 , option: option10  } of options3){
        if (!option10) {
            throw new UnknownOption(name3, flags);
        }
        if (option10.standalone) {
            if (keys.length > 1) {
                if (options3.every(({ option: opt  })=>opt && (option10 === opt || defaultValues[opt.name])
                )) {
                    return;
                }
                throw new OptionNotCombinable(option10.name);
            }
            return;
        }
        option10.conflicts?.forEach((flag)=>{
            if (isset(flag, values)) {
                throw new ConflictingOption(option10.name, flag);
            }
        });
        option10.depends?.forEach((flag)=>{
            if (!isset(flag, values) && !defaultValues[option10.name]) {
                throw new DependingOption(option10.name, flag);
            }
        });
        const isArray = (option10.args?.length || 0) > 1;
        option10.args?.forEach((arg2, i1)=>{
            if (arg2.requiredValue && (typeof values[name3] === "undefined" || isArray && typeof values[name3][i1] === "undefined")) {
                throw new MissingOptionValue(option10.name);
            }
        });
    }
    for (const option11 of flags){
        if (option11.required && !(paramCaseToCamelCase(option11.name) in values)) {
            if ((!option11.conflicts || !option11.conflicts.find((flag)=>!!values[flag]
            )) && !options3.find((opt)=>opt.option?.conflicts?.find((flag)=>flag === option11.name
                )
            )) {
                throw new MissingRequiredOption(option11.name);
            }
        }
    }
    if (keys.length === 0 && !allowEmpty) {
        throw new NoArguments();
    }
}
function isset(flag, values) {
    const name3 = paramCaseToCamelCase(flag);
    return typeof values[name3] !== "undefined";
}
const integer = (type2)=>{
    const value2 = Number(type2.value);
    if (Number.isInteger(value2)) {
        return value2;
    }
    throw new InvalidTypeError(type2);
};
const Types = {
    [OptionType.STRING]: string,
    [OptionType.NUMBER]: number,
    [OptionType.INTEGER]: integer,
    [OptionType.BOOLEAN]: __boolean
};
function parseFlags(args, opts = {
}) {
    !opts.flags && (opts.flags = []);
    const normalized = normalize(args);
    let inLiteral = false;
    let negate = false;
    const flags = {
    };
    const optionNames = {
    };
    const literal = [];
    const unknown = [];
    let stopEarly = false;
    opts.flags.forEach((opt)=>{
        opt.depends?.forEach((flag)=>{
            if (!opts.flags || !getOption(opts.flags, flag)) {
                throw new UnknownRequiredOption(flag, opts.flags ?? []);
            }
        });
        opt.conflicts?.forEach((flag)=>{
            if (!opts.flags || !getOption(opts.flags, flag)) {
                throw new UnknownConflictingOption(flag, opts.flags ?? []);
            }
        });
    });
    for(let i1 = 0; i1 < normalized.length; i1++){
        let option9;
        let args1;
        const current = normalized[i1];
        if (inLiteral) {
            literal.push(current);
            continue;
        }
        if (current === "--") {
            inLiteral = true;
            continue;
        }
        const isFlag = current.length > 1 && current[0] === "-";
        const next = ()=>normalized[i1 + 1]
        ;
        if (isFlag && !stopEarly) {
            if (current[2] === "-" || current[1] === "-" && current.length === 3) {
                throw new UnknownOption(current, opts.flags);
            }
            negate = current.startsWith("--no-");
            option9 = getOption(opts.flags, current);
            if (!option9) {
                if (opts.flags.length) {
                    throw new UnknownOption(current, opts.flags);
                }
                option9 = {
                    name: current.replace(/^-+/, ""),
                    optionalValue: true,
                    type: OptionType.STRING
                };
            }
            const positiveName = option9.name.replace(/^no-?/, "");
            const propName = paramCaseToCamelCase(positiveName);
            if (typeof flags[propName] !== "undefined" && !option9.collect) {
                throw new DuplicateOption(current);
            }
            args1 = option9.args?.length ? option9.args : [
                {
                    type: option9.type,
                    requiredValue: option9.requiredValue,
                    optionalValue: option9.optionalValue,
                    variadic: option9.variadic,
                    list: option9.list,
                    separator: option9.separator
                }
            ];
            let argIndex = 0;
            let inOptionalArg = false;
            const previous = flags[propName];
            parseNext(option9, args1);
            if (typeof flags[propName] === "undefined") {
                if (typeof option9.default !== "undefined") {
                    flags[propName] = getDefaultValue(option9);
                } else if (args1[argIndex].requiredValue) {
                    throw new MissingOptionValue(option9.name);
                } else {
                    flags[propName] = true;
                }
            }
            if (option9.value) {
                flags[propName] = option9.value(flags[propName], previous);
            } else if (option9.collect) {
                const value2 = Array.isArray(previous) ? previous : [];
                value2.push(flags[propName]);
                flags[propName] = value2;
            }
            optionNames[propName] = option9.name;
            opts.option?.(option9, flags[propName]);
            function parseNext(option10, args2) {
                const arg2 = args2[argIndex];
                if (!arg2) {
                    const flag = next();
                    throw new UnknownOption(flag, opts.flags ?? []);
                }
                if (!arg2.type) {
                    arg2.type = OptionType.BOOLEAN;
                }
                if (option10.args?.length) {
                    if ((typeof arg2.optionalValue === "undefined" || arg2.optionalValue === false) && typeof arg2.requiredValue === "undefined") {
                        arg2.requiredValue = true;
                    }
                } else {
                    if (arg2.type !== OptionType.BOOLEAN && (typeof arg2.optionalValue === "undefined" || arg2.optionalValue === false) && typeof arg2.requiredValue === "undefined") {
                        arg2.requiredValue = true;
                    }
                }
                if (arg2.requiredValue) {
                    if (inOptionalArg) {
                        throw new RequiredArgumentFollowsOptionalArgument(option10.name);
                    }
                } else {
                    inOptionalArg = true;
                }
                if (negate) {
                    flags[propName] = false;
                    return;
                }
                let result;
                let increase = false;
                if (arg2.list && hasNext(arg2)) {
                    const parsed = next().split(arg2.separator || ",").map((nextValue)=>{
                        const value2 = parseValue(option10, arg2, nextValue);
                        if (typeof value2 === "undefined") {
                            throw new InvalidOptionValue(option10.name, arg2.type ?? "?", nextValue);
                        }
                        return value2;
                    });
                    if (parsed?.length) {
                        result = parsed;
                    }
                } else {
                    if (hasNext(arg2)) {
                        result = parseValue(option10, arg2, next());
                    } else if (arg2.optionalValue && arg2.type === OptionType.BOOLEAN) {
                        result = true;
                    }
                }
                if (increase) {
                    i1++;
                    if (!arg2.variadic) {
                        argIndex++;
                    } else if (args2[argIndex + 1]) {
                        throw new ArgumentFollowsVariadicArgument(next());
                    }
                }
                if (typeof result !== "undefined" && (args2.length > 1 || arg2.variadic)) {
                    if (!flags[propName]) {
                        flags[propName] = [];
                    }
                    flags[propName].push(result);
                    if (hasNext(arg2)) {
                        parseNext(option10, args2);
                    }
                } else {
                    flags[propName] = result;
                }
                function hasNext(arg3) {
                    return !!(normalized[i1 + 1] && (arg3.optionalValue || arg3.requiredValue || arg3.variadic) && (normalized[i1 + 1][0] !== "-" || arg3.type === OptionType.NUMBER && !isNaN(Number(normalized[i1 + 1]))) && arg3);
                }
                function parseValue(option11, arg3, value2) {
                    const type2 = arg3.type || OptionType.STRING;
                    const result1 = opts.parse ? opts.parse({
                        label: "Option",
                        type: type2,
                        name: `--${option11.name}`,
                        value: value2
                    }) : parseFlagValue(option11, arg3, value2);
                    if (typeof result1 !== "undefined") {
                        increase = true;
                    }
                    return result1;
                }
            }
        } else {
            if (opts.stopEarly) {
                stopEarly = true;
            }
            unknown.push(current);
        }
    }
    if (opts.flags && opts.flags.length) {
        validateFlags(opts.flags, flags, opts.knownFlaks, opts.allowEmpty, optionNames);
    }
    const result = Object.keys(flags).reduce((result1, key1)=>{
        if (~key1.indexOf(".")) {
            key1.split(".").reduce((result2, subKey, index, parts)=>{
                if (index === parts.length - 1) {
                    result2[subKey] = flags[key1];
                } else {
                    result2[subKey] = result2[subKey] ?? {
                    };
                }
                return result2[subKey];
            }, result1);
        } else {
            result1[key1] = flags[key1];
        }
        return result1;
    }, {
    });
    return {
        flags: result,
        unknown,
        literal
    };
}
function parseFlagValue(option9, arg2, value2) {
    const type2 = arg2.type || OptionType.STRING;
    const parseType = Types[type2];
    if (!parseType) {
        throw new UnknownType(type2, Object.keys(Types));
    }
    return parseType({
        label: "Option",
        type: type2,
        name: `--${option9.name}`,
        value: value2
    });
}
function getPermissions() {
    return hasPermissions([
        "env",
        "hrtime",
        "net",
        "plugin",
        "read",
        "run",
        "write", 
    ]);
}
function isUnstable() {
    return !!Deno.permissions;
}
function didYouMeanCommand(command, commands, excludes = []) {
    const commandNames = commands.map((command1)=>command1.getName()
    ).filter((command1)=>!excludes.includes(command1)
    );
    return didYouMean(" Did you mean command", command, commandNames);
}
async function hasPermission(permission) {
    try {
        return (await Deno.permissions?.query?.({
            name: permission
        }))?.state === "granted";
    } catch  {
        return false;
    }
}
async function hasPermissions(names) {
    const permissions = {
    };
    await Promise.all(names.map((name3)=>hasPermission(name3).then((hasPermission1)=>permissions[name3] = hasPermission1
        )
    ));
    return permissions;
}
const ARGUMENT_REGEX = /^[<\[].+[\]>]$/;
const ARGUMENT_DETAILS_REGEX = /[<\[:>\]]/;
function splitArguments(args) {
    const parts = args.trim().split(/[, =] */g);
    const typeParts = [];
    while(parts[parts.length - 1] && ARGUMENT_REGEX.test(parts[parts.length - 1])){
        typeParts.unshift(parts.pop());
    }
    const typeDefinition = typeParts.join(" ");
    return {
        flags: parts,
        typeDefinition
    };
}
function parseArgumentsDefinition(argsDefinition) {
    const argumentDetails = [];
    let hasOptional = false;
    let hasVariadic = false;
    const parts = argsDefinition.split(/ +/);
    for (const arg2 of parts){
        if (hasVariadic) {
            throw new ArgumentFollowsVariadicArgument(arg2);
        }
        const parts1 = arg2.split(ARGUMENT_DETAILS_REGEX);
        const type2 = parts1[2] || OptionType.STRING;
        const details = {
            optionalValue: arg2[0] !== "<",
            name: parts1[1],
            action: parts1[3] || type2,
            variadic: false,
            list: type2 ? arg2.indexOf(type2 + "[]") !== -1 : false,
            type: type2
        };
        if (!details.optionalValue && hasOptional) {
            throw new RequiredArgumentFollowsOptionalArgument(details.name);
        }
        if (arg2[0] === "[") {
            hasOptional = true;
        }
        if (details.name.length > 3) {
            const istVariadicLeft = details.name.slice(0, 3) === "...";
            const istVariadicRight = details.name.slice(-3) === "...";
            hasVariadic = details.variadic = istVariadicLeft || istVariadicRight;
            if (istVariadicLeft) {
                details.name = details.name.slice(3);
            } else if (istVariadicRight) {
                details.name = details.name.slice(0, -3);
            }
        }
        if (details.name) {
            argumentDetails.push(details);
        }
    }
    return argumentDetails;
}
class CommandError extends Error {
    constructor(message5){
        super(message5);
        Object.setPrototypeOf(this, CommandError.prototype);
    }
}
class ValidationError1 extends CommandError {
    exitCode;
    constructor(message6, { exitCode  } = {
    }){
        super(message6);
        Object.setPrototypeOf(this, ValidationError1.prototype);
        this.exitCode = exitCode ?? 1;
    }
}
class DuplicateOptionName extends CommandError {
    constructor(name3){
        super(`Option with name "${getFlag(name3)}" already exists.`);
        Object.setPrototypeOf(this, DuplicateOptionName.prototype);
    }
}
class MissingCommandName extends CommandError {
    constructor(){
        super("Missing command name.");
        Object.setPrototypeOf(this, MissingCommandName.prototype);
    }
}
class DuplicateCommandName extends CommandError {
    constructor(name4){
        super(`Duplicate command name "${name4}".`);
        Object.setPrototypeOf(this, DuplicateCommandName.prototype);
    }
}
class DuplicateCommandAlias extends CommandError {
    constructor(alias1){
        super(`Duplicate command alias "${alias1}".`);
        Object.setPrototypeOf(this, DuplicateCommandAlias.prototype);
    }
}
class CommandNotFound extends CommandError {
    constructor(name5, commands4, excluded){
        super(`Unknown command "${name5}".${didYouMeanCommand(name5, commands4, excluded)}`);
        Object.setPrototypeOf(this, UnknownCommand.prototype);
    }
}
class DuplicateType extends CommandError {
    constructor(name6){
        super(`Type with name "${name6}" already exists.`);
        Object.setPrototypeOf(this, DuplicateType.prototype);
    }
}
class DuplicateCompletion extends CommandError {
    constructor(name7){
        super(`Completion with name "${name7}" already exists.`);
        Object.setPrototypeOf(this, DuplicateCompletion.prototype);
    }
}
class DuplicateExample extends CommandError {
    constructor(name8){
        super(`Example with name "${name8}" already exists.`);
        Object.setPrototypeOf(this, DuplicateExample.prototype);
    }
}
class DuplicateEnvironmentVariable extends CommandError {
    constructor(name9){
        super(`Environment variable with name "${name9}" already exists.`);
        Object.setPrototypeOf(this, DuplicateEnvironmentVariable.prototype);
    }
}
class EnvironmentVariableSingleValue extends CommandError {
    constructor(name10){
        super(`An environment variable can only have one value, but "${name10}" has more than one.`);
        Object.setPrototypeOf(this, EnvironmentVariableSingleValue.prototype);
    }
}
class EnvironmentVariableOptionalValue extends CommandError {
    constructor(name11){
        super(`An environment variable cannot have an optional value, but "${name11}" is defined as optional.`);
        Object.setPrototypeOf(this, EnvironmentVariableOptionalValue.prototype);
    }
}
class EnvironmentVariableVariadicValue extends CommandError {
    constructor(name12){
        super(`An environment variable cannot have an variadic value, but "${name12}" is defined as variadic.`);
        Object.setPrototypeOf(this, EnvironmentVariableVariadicValue.prototype);
    }
}
class DefaultCommandNotFound extends CommandError {
    constructor(name13, commands1){
        super(`Default command "${name13}" not found.${didYouMeanCommand(name13, commands1)}`);
        Object.setPrototypeOf(this, DefaultCommandNotFound.prototype);
    }
}
class CommandExecutableNotFound extends CommandError {
    constructor(name14, files){
        super(`Command executable not found: ${name14}:\n    - ${files.join("\\n    - ")}`);
        Object.setPrototypeOf(this, CommandExecutableNotFound.prototype);
    }
}
class UnknownCompletionCommand extends CommandError {
    constructor(name15, commands2){
        super(`Auto-completion failed. Unknown command "${name15}".${didYouMeanCommand(name15, commands2)}`);
        Object.setPrototypeOf(this, UnknownCompletionCommand.prototype);
    }
}
class UnknownCommand extends ValidationError1 {
    constructor(name16, commands3, excluded1){
        super(`Unknown command "${name16}".${didYouMeanCommand(name16, commands3, excluded1)}`);
        Object.setPrototypeOf(this, UnknownCommand.prototype);
    }
}
class NoArgumentsAllowed extends ValidationError1 {
    constructor(name17){
        super(`No arguments allowed for command "${name17}".`);
        Object.setPrototypeOf(this, NoArgumentsAllowed.prototype);
    }
}
class MissingArguments extends ValidationError1 {
    constructor(args2){
        super("Missing argument(s): " + args2.join(", "));
        Object.setPrototypeOf(this, MissingArguments.prototype);
    }
}
class MissingArgument extends ValidationError1 {
    constructor(arg2){
        super(`Missing argument "${arg2}".`);
        Object.setPrototypeOf(this, MissingArgument.prototype);
    }
}
class TooManyArguments extends ValidationError1 {
    constructor(args1){
        super(`Too many arguments: ${args1.join(" ")}`);
        Object.setPrototypeOf(this, TooManyArguments.prototype);
    }
}
class Type {
}
class BooleanType extends Type {
    parse(type) {
        return __boolean(type);
    }
    complete() {
        return [
            "true",
            "false"
        ];
    }
}
class NumberType extends Type {
    parse(type) {
        return number(type);
    }
}
class StringType extends Type {
    parse(type) {
        return string(type);
    }
}
const border = {
    top: "─",
    topMid: "┬",
    topLeft: "┌",
    topRight: "┐",
    bottom: "─",
    bottomMid: "┴",
    bottomLeft: "└",
    bottomRight: "┘",
    left: "│",
    leftMid: "├",
    mid: "─",
    midMid: "┼",
    right: "│",
    rightMid: "┤",
    middle: "│"
};
class Cell {
    value;
    options = {
    };
    get length() {
        return this.toString().length;
    }
    static from(value) {
        const cell = new this(value);
        if (value instanceof Cell) {
            cell.options = {
                ...value.options
            };
        }
        return cell;
    }
    constructor(value3){
        this.value = value3;
    }
    toString() {
        return this.value.toString();
    }
    setValue(value) {
        this.value = value;
        return this;
    }
    clone(value) {
        const cell = new Cell(value ?? this);
        cell.options = {
            ...this.options
        };
        return cell;
    }
    border(enable, override = true) {
        if (override || typeof this.options.border === "undefined") {
            this.options.border = enable;
        }
        return this;
    }
    colSpan(span, override = true) {
        if (override || typeof this.options.colSpan === "undefined") {
            this.options.colSpan = span;
        }
        return this;
    }
    rowSpan(span, override = true) {
        if (override || typeof this.options.rowSpan === "undefined") {
            this.options.rowSpan = span;
        }
        return this;
    }
    align(direction, override = true) {
        if (override || typeof this.options.align === "undefined") {
            this.options.align = direction;
        }
        return this;
    }
    getBorder() {
        return this.options.border === true;
    }
    getColSpan() {
        return typeof this.options.colSpan === "number" && this.options.colSpan > 0 ? this.options.colSpan : 1;
    }
    getRowSpan() {
        return typeof this.options.rowSpan === "number" && this.options.rowSpan > 0 ? this.options.rowSpan : 1;
    }
    getAlign() {
        return this.options.align ?? "left";
    }
}
class Row extends Array {
    options = {
    };
    static from(cells) {
        const row = new this(...cells);
        if (cells instanceof Row) {
            row.options = {
                ...cells.options
            };
        }
        return row;
    }
    clone() {
        const row = new Row(...this.map((cell)=>cell instanceof Cell ? cell.clone() : cell
        ));
        row.options = {
            ...this.options
        };
        return row;
    }
    border(enable, override = true) {
        if (override || typeof this.options.border === "undefined") {
            this.options.border = enable;
        }
        return this;
    }
    align(direction, override = true) {
        if (override || typeof this.options.align === "undefined") {
            this.options.align = direction;
        }
        return this;
    }
    getBorder() {
        return this.options.border === true;
    }
    hasBorder() {
        return this.getBorder() || this.some((cell)=>cell instanceof Cell && cell.getBorder()
        );
    }
    getAlign() {
        return this.options.align ?? "left";
    }
}
function consumeWords(length, content) {
    let consumed = "";
    const words = content.split(/ /g);
    for(let i1 = 0; i1 < words.length; i1++){
        let word = words[i1];
        const hasLineBreak = word.indexOf("\n") !== -1;
        if (hasLineBreak) {
            word = word.split("\n").shift();
        }
        if (consumed) {
            const nextLength = stripColor(word).length;
            const consumedLength = stripColor(consumed).length;
            if (consumedLength + nextLength >= length) {
                break;
            }
        }
        consumed += (i1 > 0 ? " " : "") + word;
        if (hasLineBreak) {
            break;
        }
    }
    return consumed;
}
function longest(index, rows, maxWidth) {
    return Math.max(...rows.map((row)=>(row[index] instanceof Cell && row[index].getColSpan() > 1 ? "" : row[index]?.toString() || "").split("\n").map((r2)=>{
            const str1 = typeof maxWidth === "undefined" ? r2 : consumeWords(maxWidth, r2);
            return stripColor(str1).length || 0;
        })
    ).flat());
}
class TableLayout {
    table;
    options;
    constructor(table, options4){
        this.table = table;
        this.options = options4;
    }
    toString() {
        const opts = this.createLayout();
        return opts.rows.length ? this.renderRows(opts) : "";
    }
    createLayout() {
        Object.keys(this.options.chars).forEach((key1)=>{
            if (typeof this.options.chars[key1] !== "string") {
                this.options.chars[key1] = "";
            }
        });
        const hasBodyBorder = this.table.getBorder() || this.table.hasBodyBorder();
        const hasHeaderBorder = this.table.hasHeaderBorder();
        const hasBorder = hasHeaderBorder || hasBodyBorder;
        const header = this.table.getHeader();
        const rows = this.spanRows(header ? [
            header,
            ...this.table
        ] : this.table.slice());
        const columns = Math.max(...rows.map((row)=>row.length
        ));
        for (const row of rows){
            const length = row.length;
            if (length < columns) {
                const diff = columns - length;
                for(let i1 = 0; i1 < diff; i1++){
                    row.push(this.createCell(null, row));
                }
            }
        }
        const padding = [];
        const width = [];
        for(let colIndex = 0; colIndex < columns; colIndex++){
            const minColWidth = Array.isArray(this.options.minColWidth) ? this.options.minColWidth[colIndex] : this.options.minColWidth;
            const maxColWidth = Array.isArray(this.options.maxColWidth) ? this.options.maxColWidth[colIndex] : this.options.maxColWidth;
            const colWidth = longest(colIndex, rows, maxColWidth);
            width[colIndex] = Math.min(maxColWidth, Math.max(minColWidth, colWidth));
            padding[colIndex] = Array.isArray(this.options.padding) ? this.options.padding[colIndex] : this.options.padding;
        }
        return {
            padding,
            width,
            rows,
            columns,
            hasBorder,
            hasBodyBorder,
            hasHeaderBorder
        };
    }
    spanRows(_rows, rowIndex = 0, colIndex = 0, rowSpan = [], colSpan = 1) {
        const rows = _rows;
        if (rowIndex >= rows.length && rowSpan.every((span)=>span === 1
        )) {
            return rows;
        } else if (rows[rowIndex] && colIndex >= rows[rowIndex].length && colIndex >= rowSpan.length && colSpan === 1) {
            return this.spanRows(rows, ++rowIndex, 0, rowSpan, 1);
        }
        if (colSpan > 1) {
            colSpan--;
            rowSpan[colIndex] = rowSpan[colIndex - 1];
            rows[rowIndex].splice(colIndex - 1, 0, rows[rowIndex][colIndex - 1]);
            return this.spanRows(rows, rowIndex, ++colIndex, rowSpan, colSpan);
        }
        if (colIndex === 0) {
            rows[rowIndex] = this.createRow(rows[rowIndex] || []);
        }
        if (rowSpan[colIndex] > 1) {
            rowSpan[colIndex]--;
            rows[rowIndex].splice(colIndex, 0, rows[rowIndex - 1][colIndex]);
            return this.spanRows(rows, rowIndex, ++colIndex, rowSpan, colSpan);
        }
        rows[rowIndex][colIndex] = this.createCell(rows[rowIndex][colIndex] || null, rows[rowIndex]);
        colSpan = rows[rowIndex][colIndex].getColSpan();
        rowSpan[colIndex] = rows[rowIndex][colIndex].getRowSpan();
        return this.spanRows(rows, rowIndex, ++colIndex, rowSpan, colSpan);
    }
    createRow(row) {
        return Row.from(row).border(this.table.getBorder(), false).align(this.table.getAlign(), false);
    }
    createCell(cell, row) {
        return Cell.from(cell ?? "").border(row.getBorder(), false).align(row.getAlign(), false);
    }
    renderRows(opts) {
        let result = "";
        const rowSpan = new Array(opts.columns).fill(1);
        for(let rowIndex = 0; rowIndex < opts.rows.length; rowIndex++){
            result += this.renderRow(rowSpan, rowIndex, opts);
        }
        return result.slice(0, -1);
    }
    renderRow(rowSpan, rowIndex, opts, isMultiline) {
        const row = opts.rows[rowIndex];
        const prevRow = opts.rows[rowIndex - 1];
        const nextRow = opts.rows[rowIndex + 1];
        let result = "";
        let colSpan = 1;
        if (!isMultiline && rowIndex === 0 && row.hasBorder()) {
            result += this.renderBorderRow(undefined, row, rowSpan, opts);
        }
        let isMultilineRow = false;
        result += " ".repeat(this.options.indent || 0);
        for(let colIndex = 0; colIndex < opts.columns; colIndex++){
            if (colSpan > 1) {
                colSpan--;
                rowSpan[colIndex] = rowSpan[colIndex - 1];
                continue;
            }
            result += this.renderCell(colIndex, row, opts);
            if (rowSpan[colIndex] > 1) {
                if (!isMultiline) {
                    rowSpan[colIndex]--;
                }
            } else if (!prevRow || prevRow[colIndex] !== row[colIndex]) {
                rowSpan[colIndex] = row[colIndex].getRowSpan();
            }
            colSpan = row[colIndex].getColSpan();
            if (rowSpan[colIndex] === 1 && row[colIndex].length) {
                isMultilineRow = true;
            }
        }
        if (opts.columns > 0) {
            if (row[opts.columns - 1].getBorder()) {
                result += this.options.chars.right;
            } else if (opts.hasBorder) {
                result += " ";
            }
        }
        result += "\n";
        if (isMultilineRow) {
            return result + this.renderRow(rowSpan, rowIndex, opts, isMultilineRow);
        }
        if (rowIndex === 0 && opts.hasHeaderBorder || rowIndex < opts.rows.length - 1 && opts.hasBodyBorder) {
            result += this.renderBorderRow(row, nextRow, rowSpan, opts);
        }
        if (rowIndex === opts.rows.length - 1 && row.hasBorder()) {
            result += this.renderBorderRow(row, undefined, rowSpan, opts);
        }
        return result;
    }
    renderCell(colIndex, row, opts, noBorder) {
        let result = "";
        const prevCell = row[colIndex - 1];
        const cell = row[colIndex];
        if (!noBorder) {
            if (colIndex === 0) {
                if (cell.getBorder()) {
                    result += this.options.chars.left;
                } else if (opts.hasBorder) {
                    result += " ";
                }
            } else {
                if (cell.getBorder() || prevCell?.getBorder()) {
                    result += this.options.chars.middle;
                } else if (opts.hasBorder) {
                    result += " ";
                }
            }
        }
        let maxLength = opts.width[colIndex];
        const colSpan = cell.getColSpan();
        if (colSpan > 1) {
            for(let o = 1; o < colSpan; o++){
                maxLength += opts.width[colIndex + o] + opts.padding[colIndex + o];
                if (opts.hasBorder) {
                    maxLength += opts.padding[colIndex + o] + 1;
                }
            }
        }
        const { current , next  } = this.renderCellValue(cell, maxLength);
        row[colIndex].setValue(next);
        if (opts.hasBorder) {
            result += " ".repeat(opts.padding[colIndex]);
        }
        result += current;
        if (opts.hasBorder || colIndex < opts.columns - 1) {
            result += " ".repeat(opts.padding[colIndex]);
        }
        return result;
    }
    renderCellValue(cell, maxLength) {
        const length = Math.min(maxLength, stripColor(cell.toString()).length);
        let words = consumeWords(length, cell.toString());
        const breakWord = stripColor(words).length > length;
        if (breakWord) {
            words = words.slice(0, length);
        }
        const next = cell.toString().slice(words.length + (breakWord ? 0 : 1));
        const fillLength = maxLength - stripColor(words).length;
        const align = cell.getAlign();
        let current;
        if (fillLength === 0) {
            current = words;
        } else if (align === "left") {
            current = words + " ".repeat(fillLength);
        } else if (align === "center") {
            current = " ".repeat(Math.floor(fillLength / 2)) + words + " ".repeat(Math.ceil(fillLength / 2));
        } else if (align === "right") {
            current = " ".repeat(fillLength) + words;
        } else {
            throw new Error("Unknown direction: " + align);
        }
        return {
            current,
            next: cell.clone(next)
        };
    }
    renderBorderRow(prevRow, nextRow, rowSpan, opts) {
        let result = "";
        let colSpan = 1;
        for(let colIndex = 0; colIndex < opts.columns; colIndex++){
            if (rowSpan[colIndex] > 1) {
                if (!nextRow) {
                    throw new Error("invalid layout");
                }
                if (colSpan > 1) {
                    colSpan--;
                    continue;
                }
            }
            result += this.renderBorderCell(colIndex, prevRow, nextRow, rowSpan, opts);
            colSpan = nextRow?.[colIndex].getColSpan() ?? 1;
        }
        return result.length ? " ".repeat(this.options.indent) + result + "\n" : "";
    }
    renderBorderCell(colIndex, prevRow, nextRow, rowSpan, opts) {
        const a1 = prevRow?.[colIndex - 1];
        const a2 = nextRow?.[colIndex - 1];
        const b1 = prevRow?.[colIndex];
        const b2 = nextRow?.[colIndex];
        const a1Border = !!a1?.getBorder();
        const a2Border = !!a2?.getBorder();
        const b1Border = !!b1?.getBorder();
        const b2Border = !!b2?.getBorder();
        const hasColSpan = (cell)=>(cell?.getColSpan() ?? 1) > 1
        ;
        const hasRowSpan = (cell)=>(cell?.getRowSpan() ?? 1) > 1
        ;
        let result = "";
        if (colIndex === 0) {
            if (rowSpan[colIndex] > 1) {
                if (b1Border) {
                    result += this.options.chars.left;
                } else {
                    result += " ";
                }
            } else if (b1Border && b2Border) {
                result += this.options.chars.leftMid;
            } else if (b1Border) {
                result += this.options.chars.bottomLeft;
            } else if (b2Border) {
                result += this.options.chars.topLeft;
            } else {
                result += " ";
            }
        } else if (colIndex < opts.columns) {
            if (a1Border && b2Border || b1Border && a2Border) {
                const a1ColSpan = hasColSpan(a1);
                const a2ColSpan = hasColSpan(a2);
                const b1ColSpan = hasColSpan(b1);
                const b2ColSpan = hasColSpan(b2);
                const a1RowSpan = hasRowSpan(a1);
                const a2RowSpan = hasRowSpan(a2);
                const b1RowSpan = hasRowSpan(b1);
                const b2RowSpan = hasRowSpan(b2);
                const hasAllBorder = a1Border && b2Border && b1Border && a2Border;
                const hasAllRowSpan = a1RowSpan && b1RowSpan && a2RowSpan && b2RowSpan;
                const hasAllColSpan = a1ColSpan && b1ColSpan && a2ColSpan && b2ColSpan;
                if (hasAllRowSpan && hasAllBorder) {
                    result += this.options.chars.middle;
                } else if (hasAllColSpan && hasAllBorder && a1 === b1 && a2 === b2) {
                    result += this.options.chars.mid;
                } else if (a1ColSpan && b1ColSpan && a1 === b1) {
                    result += this.options.chars.topMid;
                } else if (a2ColSpan && b2ColSpan && a2 === b2) {
                    result += this.options.chars.bottomMid;
                } else if (a1RowSpan && a2RowSpan && a1 === a2) {
                    result += this.options.chars.leftMid;
                } else if (b1RowSpan && b2RowSpan && b1 === b2) {
                    result += this.options.chars.rightMid;
                } else {
                    result += this.options.chars.midMid;
                }
            } else if (a1Border && b1Border) {
                if (hasColSpan(a1) && hasColSpan(b1) && a1 === b1) {
                    result += this.options.chars.bottom;
                } else {
                    result += this.options.chars.bottomMid;
                }
            } else if (b1Border && b2Border) {
                if (rowSpan[colIndex] > 1) {
                    result += this.options.chars.left;
                } else {
                    result += this.options.chars.leftMid;
                }
            } else if (b2Border && a2Border) {
                if (hasColSpan(a2) && hasColSpan(b2) && a2 === b2) {
                    result += this.options.chars.top;
                } else {
                    result += this.options.chars.topMid;
                }
            } else if (a1Border && a2Border) {
                if (hasRowSpan(a1) && a1 === a2) {
                    result += this.options.chars.right;
                } else {
                    result += this.options.chars.rightMid;
                }
            } else if (a1Border) {
                result += this.options.chars.bottomRight;
            } else if (b1Border) {
                result += this.options.chars.bottomLeft;
            } else if (a2Border) {
                result += this.options.chars.topRight;
            } else if (b2Border) {
                result += this.options.chars.topLeft;
            } else {
                result += " ";
            }
        }
        const length = opts.padding[colIndex] + opts.width[colIndex] + opts.padding[colIndex];
        if (rowSpan[colIndex] > 1 && nextRow) {
            result += this.renderCell(colIndex, nextRow, opts, true);
            if (nextRow[colIndex] === nextRow[nextRow.length - 1]) {
                if (b1Border) {
                    result += this.options.chars.right;
                } else {
                    result += " ";
                }
                return result;
            }
        } else if (b1Border && b2Border) {
            result += this.options.chars.mid.repeat(length);
        } else if (b1Border) {
            result += this.options.chars.bottom.repeat(length);
        } else if (b2Border) {
            result += this.options.chars.top.repeat(length);
        } else {
            result += " ".repeat(length);
        }
        if (colIndex === opts.columns - 1) {
            if (b1Border && b2Border) {
                result += this.options.chars.rightMid;
            } else if (b1Border) {
                result += this.options.chars.bottomRight;
            } else if (b2Border) {
                result += this.options.chars.topRight;
            } else {
                result += " ";
            }
        }
        return result;
    }
}
class Table extends Array {
    static _chars = {
        ...border
    };
    options = {
        indent: 0,
        border: false,
        maxColWidth: Infinity,
        minColWidth: 0,
        padding: 1,
        chars: {
            ...Table._chars
        }
    };
    headerRow;
    static from(rows) {
        const table1 = new this(...rows);
        if (rows instanceof Table) {
            table1.options = {
                ...rows.options
            };
            table1.headerRow = rows.headerRow ? Row.from(rows.headerRow) : undefined;
        }
        return table1;
    }
    static fromJson(rows) {
        return new this().fromJson(rows);
    }
    static chars(chars) {
        Object.assign(this._chars, chars);
        return this;
    }
    static render(rows) {
        Table.from(rows).render();
    }
    fromJson(rows) {
        this.header(Object.keys(rows[0]));
        this.body(rows.map((row)=>Object.values(row)
        ));
        return this;
    }
    header(header) {
        this.headerRow = header instanceof Row ? header : Row.from(header);
        return this;
    }
    body(rows) {
        this.length = 0;
        this.push(...rows);
        return this;
    }
    clone() {
        const table1 = new Table(...this.map((row)=>row instanceof Row ? row.clone() : Row.from(row).clone()
        ));
        table1.options = {
            ...this.options
        };
        table1.headerRow = this.headerRow?.clone();
        return table1;
    }
    toString() {
        return new TableLayout(this, this.options).toString();
    }
    render() {
        Deno.stdout.writeSync(new TextEncoder().encode(this.toString() + "\n"));
        return this;
    }
    maxColWidth(width, override = true) {
        if (override || typeof this.options.maxColWidth === "undefined") {
            this.options.maxColWidth = width;
        }
        return this;
    }
    minColWidth(width, override = true) {
        if (override || typeof this.options.minColWidth === "undefined") {
            this.options.minColWidth = width;
        }
        return this;
    }
    indent(width, override = true) {
        if (override || typeof this.options.indent === "undefined") {
            this.options.indent = width;
        }
        return this;
    }
    padding(padding, override = true) {
        if (override || typeof this.options.padding === "undefined") {
            this.options.padding = padding;
        }
        return this;
    }
    border(enable, override = true) {
        if (override || typeof this.options.border === "undefined") {
            this.options.border = enable;
        }
        return this;
    }
    align(direction, override = true) {
        if (override || typeof this.options.align === "undefined") {
            this.options.align = direction;
        }
        return this;
    }
    chars(chars) {
        Object.assign(this.options.chars, chars);
        return this;
    }
    getHeader() {
        return this.headerRow;
    }
    getBody() {
        return [
            ...this
        ];
    }
    getMaxColWidth() {
        return this.options.maxColWidth;
    }
    getMinColWidth() {
        return this.options.minColWidth;
    }
    getIndent() {
        return this.options.indent;
    }
    getPadding() {
        return this.options.padding;
    }
    getBorder() {
        return this.options.border === true;
    }
    hasHeaderBorder() {
        const hasBorder = this.headerRow?.hasBorder();
        return hasBorder === true || this.getBorder() && hasBorder !== false;
    }
    hasBodyBorder() {
        return this.getBorder() || this.some((row)=>row instanceof Row ? row.hasBorder() : row.some((cell)=>cell instanceof Cell ? cell.getBorder : false
            )
        );
    }
    hasBorder() {
        return this.hasHeaderBorder() || this.hasBodyBorder();
    }
    getAlign() {
        return this.options.align ?? "left";
    }
}
class HelpGenerator {
    cmd;
    indent = 2;
    options;
    static generate(cmd, options) {
        return new HelpGenerator(cmd, options).generate();
    }
    constructor(cmd1, options5 = {
    }){
        this.cmd = cmd1;
        this.options = {
            types: false,
            hints: true,
            colors: true,
            ...options5
        };
    }
    generate() {
        const areColorsEnabled = getColorEnabled();
        setColorEnabled(this.options.colors);
        const result = this.generateHeader() + this.generateDescription() + this.generateOptions() + this.generateCommands() + this.generateEnvironmentVariables() + this.generateExamples() + "\n";
        setColorEnabled(areColorsEnabled);
        return result;
    }
    generateHeader() {
        const rows = [
            [
                bold("Usage:"),
                magenta(`${this.cmd.getPath()}${this.cmd.getArgsDefinition() ? " " + this.cmd.getArgsDefinition() : ""}`), 
            ], 
        ];
        const version = this.cmd.getVersion();
        if (version) {
            rows.push([
                bold("Version:"),
                yellow(`v${this.cmd.getVersion()}`)
            ]);
        }
        return "\n" + Table.from(rows).indent(this.indent).padding(1).toString() + "\n";
    }
    generateDescription() {
        if (!this.cmd.getDescription()) {
            return "";
        }
        return this.label("Description") + Table.from([
            [
                this.cmd.getDescription()
            ], 
        ]).indent(this.indent * 2).maxColWidth(140).padding(1).toString() + "\n";
    }
    generateOptions() {
        const options6 = this.cmd.getOptions(false);
        if (!options6.length) {
            return "";
        }
        const hasTypeDefinitions = !!options6.find((option9)=>!!option9.typeDefinition
        );
        if (hasTypeDefinitions) {
            return this.label("Options") + Table.from([
                ...options6.map((option9)=>[
                        option9.flags.map((flag)=>blue(flag)
                        ).join(", "),
                        highlightArguments(option9.typeDefinition || "", this.options.types),
                        red(bold("-")) + " " + option9.description.split("\n").shift(),
                        this.generateHints(option9), 
                    ]
                ), 
            ]).padding([
                2,
                2,
                2
            ]).indent(this.indent * 2).maxColWidth([
                60,
                60,
                80,
                60
            ]).toString() + "\n";
        }
        return this.label("Options") + Table.from([
            ...options6.map((option9)=>[
                    option9.flags.map((flag)=>blue(flag)
                    ).join(", "),
                    red(bold("-")) + " " + option9.description.split("\n").shift(),
                    this.generateHints(option9), 
                ]
            ), 
        ]).padding([
            2,
            2
        ]).indent(this.indent * 2).maxColWidth([
            60,
            80,
            60
        ]).toString() + "\n";
    }
    generateCommands() {
        const commands4 = this.cmd.getCommands(false);
        if (!commands4.length) {
            return "";
        }
        const hasTypeDefinitions = !!commands4.find((command)=>!!command.getArgsDefinition()
        );
        if (hasTypeDefinitions) {
            return this.label("Commands") + Table.from([
                ...commands4.map((command)=>[
                        [
                            command.getName(),
                            ...command.getAliases()
                        ].map((name18)=>blue(name18)
                        ).join(", "),
                        highlightArguments(command.getArgsDefinition() || "", this.options.types),
                        red(bold("-")) + " " + command.getDescription().split("\n").shift(), 
                    ]
                ), 
            ]).padding([
                2,
                2,
                2
            ]).indent(this.indent * 2).toString() + "\n";
        }
        return this.label("Commands") + Table.from([
            ...commands4.map((command)=>[
                    [
                        command.getName(),
                        ...command.getAliases()
                    ].map((name18)=>blue(name18)
                    ).join(", "),
                    red(bold("-")) + " " + command.getDescription().split("\n").shift(), 
                ]
            ), 
        ]).padding([
            2,
            2
        ]).indent(this.indent * 2).toString() + "\n";
    }
    generateEnvironmentVariables() {
        const envVars = this.cmd.getEnvVars(false);
        if (!envVars.length) {
            return "";
        }
        return this.label("Environment variables") + Table.from([
            ...envVars.map((envVar)=>[
                    envVar.names.map((name18)=>blue(name18)
                    ).join(", "),
                    highlightArgumentDetails(envVar.details, this.options.types),
                    `${red(bold("-"))} ${envVar.description}`, 
                ]
            ), 
        ]).padding(2).indent(this.indent * 2).toString() + "\n";
    }
    generateExamples() {
        const examples = this.cmd.getExamples();
        if (!examples.length) {
            return "";
        }
        return this.label("Examples") + Table.from(examples.map((example)=>[
                dim(bold(`${capitalize(example.name)}:`)),
                example.description, 
            ]
        )).padding(1).indent(this.indent * 2).maxColWidth(150).toString() + "\n";
    }
    generateHints(option) {
        if (!this.options.hints) {
            return "";
        }
        const hints = [];
        option.required && hints.push(yellow(`required`));
        typeof option.default !== "undefined" && hints.push(bold(`Default: `) + inspect(option.default, this.options.colors));
        option.depends?.length && hints.push(yellow(bold(`Depends: `)) + italic(option.depends.map(getFlag).join(", ")));
        option.conflicts?.length && hints.push(red(bold(`Conflicts: `)) + italic(option.conflicts.map(getFlag).join(", ")));
        const type3 = this.cmd.getType(option.args[0]?.type)?.handler;
        if (type3 instanceof Type) {
            const possibleValues = type3.values?.(this.cmd, this.cmd.getParent());
            if (possibleValues?.length) {
                hints.push(bold(`Values: `) + possibleValues.map((value4)=>inspect(value4, this.options.colors)
                ).join(", "));
            }
        }
        if (hints.length) {
            return `(${hints.join(", ")})`;
        }
        return "";
    }
    label(label) {
        return "\n" + " ".repeat(this.indent) + bold(`${label}:`) + "\n\n";
    }
}
function capitalize(string1) {
    return (string1?.charAt(0).toUpperCase() + string1.slice(1)) ?? "";
}
function inspect(value4, colors1) {
    return Deno.inspect(value4, {
        depth: 1,
        colors: colors1,
        trailingComma: false
    });
}
function highlightArguments(argsDefinition, types1 = true) {
    if (!argsDefinition) {
        return "";
    }
    return parseArgumentsDefinition(argsDefinition).map((arg3)=>highlightArgumentDetails(arg3, types1)
    ).join(" ");
}
function highlightArgumentDetails(arg3, types1 = true) {
    let str1 = "";
    str1 += yellow(arg3.optionalValue ? "[" : "<");
    let name18 = "";
    name18 += arg3.name;
    if (arg3.variadic) {
        name18 += "...";
    }
    name18 = magenta(name18);
    str1 += name18;
    if (types1) {
        str1 += yellow(":");
        str1 += red(arg3.type);
    }
    if (arg3.list) {
        str1 += green("[]");
    }
    str1 += yellow(arg3.optionalValue ? "]" : ">");
    return str1;
}
class IntegerType extends Type {
    parse(type) {
        return integer(type);
    }
}
class Command {
    types = new Map();
    rawArgs = [];
    literalArgs = [];
    _name = "COMMAND";
    _parent;
    _globalParent;
    ver;
    desc = "";
    fn;
    options = [];
    commands = new Map();
    examples = [];
    envVars = [];
    aliases = [];
    completions = new Map();
    cmd = this;
    argsDefinition;
    isExecutable = false;
    throwOnError = false;
    _allowEmpty = true;
    _stopEarly = false;
    defaultCommand;
    _useRawArgs = false;
    args = [];
    isHidden = false;
    isGlobal = false;
    hasDefaults = false;
    _versionOption;
    _helpOption;
    _help;
    versionOption(flags, desc, opts) {
        this._versionOption = flags === false ? flags : {
            flags,
            desc,
            opts: typeof opts === "function" ? {
                action: opts
            } : opts
        };
        return this;
    }
    helpOption(flags, desc, opts) {
        this._helpOption = flags === false ? flags : {
            flags,
            desc,
            opts: typeof opts === "function" ? {
                action: opts
            } : opts
        };
        return this;
    }
    command(nameAndArguments, cmdOrDescription, override) {
        const result = splitArguments(nameAndArguments);
        const name18 = result.flags.shift();
        const aliases = result.flags;
        if (!name18) {
            throw new MissingCommandName();
        }
        if (this.getBaseCommand(name18, true)) {
            if (!override) {
                throw new DuplicateCommandName(name18);
            }
            this.removeCommand(name18);
        }
        let description;
        let cmd2;
        if (typeof cmdOrDescription === "string") {
            description = cmdOrDescription;
        }
        if (cmdOrDescription instanceof Command) {
            cmd2 = cmdOrDescription.reset();
        } else {
            cmd2 = new Command();
        }
        cmd2._name = name18;
        cmd2._parent = this;
        if (description) {
            cmd2.description(description);
        }
        if (result.typeDefinition) {
            cmd2.arguments(result.typeDefinition);
        }
        aliases.forEach((alias1)=>cmd2.alias(alias1)
        );
        this.commands.set(name18, cmd2);
        this.select(name18);
        return this;
    }
    alias(alias) {
        if (this.cmd._name === alias || this.cmd.aliases.includes(alias)) {
            throw new DuplicateCommandAlias(alias);
        }
        this.cmd.aliases.push(alias);
        return this;
    }
    reset() {
        this.cmd = this;
        return this;
    }
    select(name) {
        const cmd2 = this.getBaseCommand(name, true);
        if (!cmd2) {
            throw new CommandNotFound(name, this.getBaseCommands(true));
        }
        this.cmd = cmd2;
        return this;
    }
    name(name) {
        this.cmd._name = name;
        return this;
    }
    version(version) {
        if (typeof version === "string") {
            this.cmd.ver = ()=>version
            ;
        } else if (typeof version === "function") {
            this.cmd.ver = version;
        }
        return this;
    }
    help(help) {
        if (typeof help === "string") {
            this.cmd._help = ()=>help
            ;
        } else if (typeof help === "function") {
            this.cmd._help = help;
        } else {
            this.cmd._help = (cmd2)=>HelpGenerator.generate(cmd2, help)
            ;
        }
        return this;
    }
    description(description) {
        this.cmd.desc = description;
        return this;
    }
    hidden() {
        this.cmd.isHidden = true;
        return this;
    }
    global() {
        this.cmd.isGlobal = true;
        return this;
    }
    executable() {
        this.cmd.isExecutable = true;
        return this;
    }
    arguments(args) {
        this.cmd.argsDefinition = args;
        return this;
    }
    action(fn) {
        this.cmd.fn = fn;
        return this;
    }
    allowEmpty(allowEmpty = true) {
        this.cmd._allowEmpty = allowEmpty;
        return this;
    }
    stopEarly(stopEarly = true) {
        this.cmd._stopEarly = stopEarly;
        return this;
    }
    useRawArgs(useRawArgs = true) {
        this.cmd._useRawArgs = useRawArgs;
        return this;
    }
    default(name) {
        this.cmd.defaultCommand = name;
        return this;
    }
    globalType(name, type, options) {
        return this.type(name, type, {
            ...options,
            global: true
        });
    }
    type(name, handler, options) {
        if (this.cmd.types.get(name) && !options?.override) {
            throw new DuplicateType(name);
        }
        this.cmd.types.set(name, {
            ...options,
            name,
            handler
        });
        if (handler instanceof Type && (typeof handler.complete !== "undefined" || typeof handler.values !== "undefined")) {
            const completeHandler = (cmd2, parent)=>handler.complete?.(cmd2, parent) || []
            ;
            this.complete(name, completeHandler, options);
        }
        return this;
    }
    globalComplete(name, complete, options) {
        return this.complete(name, complete, {
            ...options,
            global: true
        });
    }
    complete(name, complete, options) {
        if (this.cmd.completions.has(name) && !options?.override) {
            throw new DuplicateCompletion(name);
        }
        this.cmd.completions.set(name, {
            name,
            complete,
            ...options
        });
        return this;
    }
    throwErrors() {
        this.cmd.throwOnError = true;
        return this;
    }
    shouldThrowErrors() {
        return this.cmd.throwOnError || !!this.cmd._parent?.shouldThrowErrors();
    }
    globalOption(flags, desc, opts) {
        if (typeof opts === "function") {
            return this.option(flags, desc, {
                value: opts,
                global: true
            });
        }
        return this.option(flags, desc, {
            ...opts,
            global: true
        });
    }
    option(flags, desc, opts) {
        if (typeof opts === "function") {
            return this.option(flags, desc, {
                value: opts
            });
        }
        const result = splitArguments(flags);
        const args3 = result.typeDefinition ? parseArgumentsDefinition(result.typeDefinition) : [];
        const option10 = {
            ...opts,
            name: "",
            description: desc,
            args: args3,
            flags: result.flags,
            typeDefinition: result.typeDefinition
        };
        if (option10.separator) {
            for (const arg3 of args3){
                if (arg3.list) {
                    arg3.separator = option10.separator;
                }
            }
        }
        for (const part of option10.flags){
            const arg3 = part.trim();
            const isLong = /^--/.test(arg3);
            const name19 = isLong ? arg3.slice(2) : arg3.slice(1);
            if (this.cmd.getBaseOption(name19, true)) {
                if (opts?.override) {
                    this.removeOption(name19);
                } else {
                    throw new DuplicateOptionName(name19);
                }
            }
            if (!option10.name && isLong) {
                option10.name = name19;
            } else if (!option10.aliases) {
                option10.aliases = [
                    name19
                ];
            } else {
                option10.aliases.push(name19);
            }
        }
        if (option10.prepend) {
            this.cmd.options.unshift(option10);
        } else {
            this.cmd.options.push(option10);
        }
        return this;
    }
    example(name, description) {
        if (this.cmd.hasExample(name)) {
            throw new DuplicateExample(name);
        }
        this.cmd.examples.push({
            name,
            description
        });
        return this;
    }
    globalEnv(name, description, options) {
        return this.env(name, description, {
            ...options,
            global: true
        });
    }
    env(name, description, options) {
        const result = splitArguments(name);
        if (!result.typeDefinition) {
            result.typeDefinition = "<value:boolean>";
        }
        if (result.flags.some((envName)=>this.cmd.getBaseEnvVar(envName, true)
        )) {
            throw new DuplicateEnvironmentVariable(name);
        }
        const details = parseArgumentsDefinition(result.typeDefinition);
        if (details.length > 1) {
            throw new EnvironmentVariableSingleValue(name);
        } else if (details.length && details[0].optionalValue) {
            throw new EnvironmentVariableOptionalValue(name);
        } else if (details.length && details[0].variadic) {
            throw new EnvironmentVariableVariadicValue(name);
        }
        this.cmd.envVars.push({
            name: result.flags[0],
            names: result.flags,
            description,
            type: details[0].type,
            details: details.shift(),
            ...options
        });
        return this;
    }
    async parse(args = Deno.args, dry) {
        try {
            this.reset();
            this.registerDefaults();
            this.rawArgs = args;
            const subCommand = args.length > 0 && this.getCommand(args[0], true);
            if (subCommand) {
                subCommand._globalParent = this;
                return await subCommand.parse(this.rawArgs.slice(1), dry);
            }
            const result = {
                options: {
                },
                args: this.rawArgs,
                cmd: this,
                literal: this.literalArgs
            };
            if (this.isExecutable) {
                if (!dry) {
                    await this.executeExecutable(this.rawArgs);
                }
                return result;
            } else if (this._useRawArgs) {
                if (dry) {
                    return result;
                }
                return await this.execute({
                }, ...this.rawArgs);
            } else {
                const { action , flags , unknown , literal  } = this.parseFlags(this.rawArgs);
                this.literalArgs = literal;
                const params = this.parseArguments(unknown, flags);
                await this.validateEnvVars();
                if (dry || action) {
                    if (action) {
                        await action.call(this, flags, ...params);
                    }
                    return {
                        options: flags,
                        args: params,
                        cmd: this,
                        literal: this.literalArgs
                    };
                }
                return await this.execute(flags, ...params);
            }
        } catch (error) {
            throw this.error(error);
        }
    }
    registerDefaults() {
        if (this.hasDefaults || this.getParent()) {
            return this;
        }
        this.hasDefaults = true;
        this.reset();
        !this.types.has("string") && this.type("string", new StringType(), {
            global: true
        });
        !this.types.has("number") && this.type("number", new NumberType(), {
            global: true
        });
        !this.types.has("integer") && this.type("integer", new IntegerType(), {
            global: true
        });
        !this.types.has("boolean") && this.type("boolean", new BooleanType(), {
            global: true
        });
        if (!this._help) {
            this.help({
                hints: true,
                types: false
            });
        }
        if (this._versionOption !== false && (this._versionOption || this.ver)) {
            this.option(this._versionOption?.flags || "-V, --version", this._versionOption?.desc || "Show the version number for this program.", {
                standalone: true,
                prepend: true,
                action: function() {
                    this.showVersion();
                    Deno.exit(0);
                },
                ...this._versionOption?.opts ?? {
                }
            });
        }
        if (this._helpOption !== false) {
            this.option(this._helpOption?.flags || "-h, --help", this._helpOption?.desc || "Show this help.", {
                standalone: true,
                global: true,
                prepend: true,
                action: function() {
                    this.showHelp();
                    Deno.exit(0);
                },
                ...this._helpOption?.opts ?? {
                }
            });
        }
        return this;
    }
    async execute(options, ...args) {
        if (this.fn) {
            await this.fn(options, ...args);
        } else if (this.defaultCommand) {
            const cmd2 = this.getCommand(this.defaultCommand, true);
            if (!cmd2) {
                throw new DefaultCommandNotFound(this.defaultCommand, this.getCommands());
            }
            cmd2._globalParent = this;
            await cmd2.execute(options, ...args);
        }
        return {
            options,
            args,
            cmd: this,
            literal: this.literalArgs
        };
    }
    async executeExecutable(args) {
        const permissions = await getPermissions();
        if (!permissions.read) {
            await Deno.permissions?.request({
                name: "read"
            });
        }
        if (!permissions.run) {
            await Deno.permissions?.request({
                name: "run"
            });
        }
        const [main, ...names] = this.getPath().split(" ");
        names.unshift(main.replace(/\.ts$/, ""));
        const executableName = names.join("-");
        const files1 = [];
        const parts = Deno.mainModule.replace(/^file:\/\//g, "").split("/");
        parts.pop();
        const path = parts.join("/");
        files1.push(path + "/" + executableName, path + "/" + executableName + ".ts");
        files1.push(executableName, executableName + ".ts");
        const denoOpts = [];
        if (isUnstable()) {
            denoOpts.push("--unstable");
        }
        denoOpts.push("--allow-read", "--allow-run");
        Object.keys(permissions).forEach((name19)=>{
            if (name19 === "read" || name19 === "run") {
                return;
            }
            if (permissions[name19]) {
                denoOpts.push(`--allow-${name19}`);
            }
        });
        for (const file of files1){
            try {
                Deno.lstatSync(file);
            } catch (error) {
                if (error instanceof Deno.errors.NotFound) {
                    return false;
                }
                throw error;
            }
            const cmd2 = [
                "deno",
                "run",
                ...denoOpts,
                file,
                ...args
            ];
            const process = Deno.run({
                cmd: cmd2
            });
            const status = await process.status();
            if (!status.success) {
                Deno.exit(status.code);
            }
            return;
        }
        throw new CommandExecutableNotFound(executableName, files1);
    }
    parseFlags(args) {
        try {
            let action;
            const result = parseFlags(args, {
                stopEarly: this._stopEarly,
                allowEmpty: this._allowEmpty,
                flags: this.getOptions(true),
                parse: (type3)=>this.parseType(type3)
                ,
                option: (option10)=>{
                    if (!action && option10.action) {
                        action = option10.action;
                    }
                }
            });
            return {
                ...result,
                action
            };
        } catch (error) {
            if (error instanceof ValidationError) {
                throw new ValidationError1(error.message);
            }
            throw error;
        }
    }
    parseType(type) {
        const typeSettings = this.getType(type.type);
        if (!typeSettings) {
            throw new UnknownType(type.type, this.getTypes().map((type3)=>type3.name
            ));
        }
        return typeSettings.handler instanceof Type ? typeSettings.handler.parse(type) : typeSettings.handler(type);
    }
    async validateEnvVars() {
        if (!await hasPermission("env")) {
            return;
        }
        const envVars = this.getEnvVars(true);
        if (!envVars.length) {
            return;
        }
        envVars.forEach((env)=>{
            const name19 = env.names.find((name20)=>!!Deno.env.get(name20)
            );
            if (name19) {
                this.parseType({
                    label: "Environment variable",
                    type: env.type,
                    name: name19,
                    value: Deno.env.get(name19) ?? ""
                });
            }
        });
    }
    parseArguments(args, flags) {
        const params = [];
        args = args.slice(0);
        if (!this.hasArguments()) {
            if (args.length) {
                if (this.hasCommands(true)) {
                    throw new UnknownCommand(args[0], this.getCommands());
                } else {
                    throw new NoArgumentsAllowed(this.getPath());
                }
            }
        } else {
            if (!args.length) {
                const required = this.getArguments().filter((expectedArg)=>!expectedArg.optionalValue
                ).map((expectedArg)=>expectedArg.name
                );
                if (required.length) {
                    const flagNames = Object.keys(flags);
                    const hasStandaloneOption = !!flagNames.find((name19)=>this.getOption(name19, true)?.standalone
                    );
                    if (!hasStandaloneOption) {
                        throw new MissingArguments(required);
                    }
                }
            } else {
                for (const expectedArg of this.getArguments()){
                    if (!args.length) {
                        if (expectedArg.optionalValue) {
                            break;
                        }
                        throw new MissingArgument(`Missing argument: ${expectedArg.name}`);
                    }
                    let arg3;
                    if (expectedArg.variadic) {
                        arg3 = args.splice(0, args.length).map((value4)=>this.parseType({
                                label: "Argument",
                                type: expectedArg.type,
                                name: expectedArg.name,
                                value: value4
                            })
                        );
                    } else {
                        arg3 = this.parseType({
                            label: "Argument",
                            type: expectedArg.type,
                            name: expectedArg.name,
                            value: args.shift()
                        });
                    }
                    if (arg3) {
                        params.push(arg3);
                    }
                }
                if (args.length) {
                    throw new TooManyArguments(args);
                }
            }
        }
        return params;
    }
    error(error) {
        if (this.shouldThrowErrors() || !(error instanceof ValidationError1)) {
            return error;
        }
        this.showHelp();
        Deno.stderr.writeSync(new TextEncoder().encode(red(`  ${bold("error")}: ${error.message}\n`) + "\n"));
        Deno.exit(error instanceof ValidationError1 ? error.exitCode : 1);
    }
    getName() {
        return this._name;
    }
    getParent() {
        return this._parent;
    }
    getGlobalParent() {
        return this._globalParent;
    }
    getMainCommand() {
        return this._parent?.getMainCommand() ?? this;
    }
    getAliases() {
        return this.aliases;
    }
    getPath() {
        return this._parent ? this._parent.getPath() + " " + this._name : this._name;
    }
    getArgsDefinition() {
        return this.argsDefinition;
    }
    getArgument(name) {
        return this.getArguments().find((arg3)=>arg3.name === name
        );
    }
    getArguments() {
        if (!this.args.length && this.argsDefinition) {
            this.args = parseArgumentsDefinition(this.argsDefinition);
        }
        return this.args;
    }
    hasArguments() {
        return !!this.argsDefinition;
    }
    getVersion() {
        return this.getVersionHandler()?.call(this, this);
    }
    getVersionHandler() {
        return this.ver ?? this._parent?.getVersionHandler();
    }
    getDescription() {
        return typeof this.desc === "function" ? this.desc = this.desc() : this.desc;
    }
    getShortDescription() {
        return this.getDescription().trim().split("\n").shift();
    }
    getRawArgs() {
        return this.rawArgs;
    }
    getLiteralArgs() {
        return this.literalArgs;
    }
    showVersion() {
        Deno.stdout.writeSync(new TextEncoder().encode(this.getVersion()));
    }
    showHelp() {
        Deno.stdout.writeSync(new TextEncoder().encode(this.getHelp()));
    }
    getHelp() {
        this.registerDefaults();
        return this.getHelpHandler().call(this, this);
    }
    getHelpHandler() {
        return this._help ?? this._parent?.getHelpHandler();
    }
    hasOptions(hidden) {
        return this.getOptions(hidden).length > 0;
    }
    getOptions(hidden) {
        return this.getGlobalOptions(hidden).concat(this.getBaseOptions(hidden));
    }
    getBaseOptions(hidden) {
        if (!this.options.length) {
            return [];
        }
        return hidden ? this.options.slice(0) : this.options.filter((opt)=>!opt.hidden
        );
    }
    getGlobalOptions(hidden) {
        const getOptions = (cmd2, options6 = [], names = [])=>{
            if (cmd2) {
                if (cmd2.options.length) {
                    cmd2.options.forEach((option10)=>{
                        if (option10.global && !this.options.find((opt)=>opt.name === option10.name
                        ) && names.indexOf(option10.name) === -1 && (hidden || !option10.hidden)) {
                            names.push(option10.name);
                            options6.push(option10);
                        }
                    });
                }
                return getOptions(cmd2._parent, options6, names);
            }
            return options6;
        };
        return getOptions(this._parent);
    }
    hasOption(name, hidden) {
        return !!this.getOption(name, hidden);
    }
    getOption(name, hidden) {
        return this.getBaseOption(name, hidden) ?? this.getGlobalOption(name, hidden);
    }
    getBaseOption(name, hidden) {
        const option10 = this.options.find((option11)=>option11.name === name
        );
        return option10 && (hidden || !option10.hidden) ? option10 : undefined;
    }
    getGlobalOption(name, hidden) {
        if (!this._parent) {
            return;
        }
        const option10 = this._parent.getBaseOption(name, hidden);
        if (!option10 || !option10.global) {
            return this._parent.getGlobalOption(name, hidden);
        }
        return option10;
    }
    removeOption(name) {
        const index = this.options.findIndex((option10)=>option10.name === name
        );
        if (index === -1) {
            return;
        }
        return this.options.splice(index, 1)[0];
    }
    hasCommands(hidden) {
        return this.getCommands(hidden).length > 0;
    }
    getCommands(hidden) {
        return this.getGlobalCommands(hidden).concat(this.getBaseCommands(hidden));
    }
    getBaseCommands(hidden) {
        const commands5 = Array.from(this.commands.values());
        return hidden ? commands5 : commands5.filter((cmd2)=>!cmd2.isHidden
        );
    }
    getGlobalCommands(hidden) {
        const getCommands = (cmd2, commands5 = [], names = [])=>{
            if (cmd2) {
                if (cmd2.commands.size) {
                    cmd2.commands.forEach((cmd3)=>{
                        if (cmd3.isGlobal && this !== cmd3 && !this.commands.has(cmd3._name) && names.indexOf(cmd3._name) === -1 && (hidden || !cmd3.isHidden)) {
                            names.push(cmd3._name);
                            commands5.push(cmd3);
                        }
                    });
                }
                return getCommands(cmd2._parent, commands5, names);
            }
            return commands5;
        };
        return getCommands(this._parent);
    }
    hasCommand(name, hidden) {
        return !!this.getCommand(name, hidden);
    }
    getCommand(name, hidden) {
        return this.getBaseCommand(name, hidden) ?? this.getGlobalCommand(name, hidden);
    }
    getBaseCommand(name, hidden) {
        for (const cmd2 of this.commands.values()){
            if (cmd2._name === name || cmd2.aliases.includes(name)) {
                return cmd2 && (hidden || !cmd2.isHidden) ? cmd2 : undefined;
            }
        }
    }
    getGlobalCommand(name, hidden) {
        if (!this._parent) {
            return;
        }
        const cmd2 = this._parent.getBaseCommand(name, hidden);
        if (!cmd2?.isGlobal) {
            return this._parent.getGlobalCommand(name, hidden);
        }
        return cmd2;
    }
    removeCommand(name) {
        const command = this.getBaseCommand(name, true);
        if (command) {
            this.commands.delete(command._name);
        }
        return command;
    }
    getTypes() {
        return this.getGlobalTypes().concat(this.getBaseTypes());
    }
    getBaseTypes() {
        return Array.from(this.types.values());
    }
    getGlobalTypes() {
        const getTypes = (cmd2, types2 = [], names = [])=>{
            if (cmd2) {
                if (cmd2.types.size) {
                    cmd2.types.forEach((type3)=>{
                        if (type3.global && !this.types.has(type3.name) && names.indexOf(type3.name) === -1) {
                            names.push(type3.name);
                            types2.push(type3);
                        }
                    });
                }
                return getTypes(cmd2._parent, types2, names);
            }
            return types2;
        };
        return getTypes(this._parent);
    }
    getType(name) {
        return this.getBaseType(name) ?? this.getGlobalType(name);
    }
    getBaseType(name) {
        return this.types.get(name);
    }
    getGlobalType(name) {
        if (!this._parent) {
            return;
        }
        const cmd2 = this._parent.getBaseType(name);
        if (!cmd2?.global) {
            return this._parent.getGlobalType(name);
        }
        return cmd2;
    }
    getCompletions() {
        return this.getGlobalCompletions().concat(this.getBaseCompletions());
    }
    getBaseCompletions() {
        return Array.from(this.completions.values());
    }
    getGlobalCompletions() {
        const getCompletions = (cmd2, completions = [], names = [])=>{
            if (cmd2) {
                if (cmd2.completions.size) {
                    cmd2.completions.forEach((completion)=>{
                        if (completion.global && !this.completions.has(completion.name) && names.indexOf(completion.name) === -1) {
                            names.push(completion.name);
                            completions.push(completion);
                        }
                    });
                }
                return getCompletions(cmd2._parent, completions, names);
            }
            return completions;
        };
        return getCompletions(this._parent);
    }
    getCompletion(name) {
        return this.getBaseCompletion(name) ?? this.getGlobalCompletion(name);
    }
    getBaseCompletion(name) {
        return this.completions.get(name);
    }
    getGlobalCompletion(name) {
        if (!this._parent) {
            return;
        }
        const completion = this._parent.getBaseCompletion(name);
        if (!completion?.global) {
            return this._parent.getGlobalCompletion(name);
        }
        return completion;
    }
    hasEnvVars(hidden) {
        return this.getEnvVars(hidden).length > 0;
    }
    getEnvVars(hidden) {
        return this.getGlobalEnvVars(hidden).concat(this.getBaseEnvVars(hidden));
    }
    getBaseEnvVars(hidden) {
        if (!this.envVars.length) {
            return [];
        }
        return hidden ? this.envVars.slice(0) : this.envVars.filter((env)=>!env.hidden
        );
    }
    getGlobalEnvVars(hidden) {
        const getEnvVars = (cmd2, envVars = [], names = [])=>{
            if (cmd2) {
                if (cmd2.envVars.length) {
                    cmd2.envVars.forEach((envVar)=>{
                        if (envVar.global && !this.envVars.find((env)=>env.names[0] === envVar.names[0]
                        ) && names.indexOf(envVar.names[0]) === -1 && (hidden || !envVar.hidden)) {
                            names.push(envVar.names[0]);
                            envVars.push(envVar);
                        }
                    });
                }
                return getEnvVars(cmd2._parent, envVars, names);
            }
            return envVars;
        };
        return getEnvVars(this._parent);
    }
    hasEnvVar(name, hidden) {
        return !!this.getEnvVar(name, hidden);
    }
    getEnvVar(name, hidden) {
        return this.getBaseEnvVar(name, hidden) ?? this.getGlobalEnvVar(name, hidden);
    }
    getBaseEnvVar(name, hidden) {
        const envVar = this.envVars.find((env)=>env.names.indexOf(name) !== -1
        );
        return envVar && (hidden || !envVar.hidden) ? envVar : undefined;
    }
    getGlobalEnvVar(name, hidden) {
        if (!this._parent) {
            return;
        }
        const envVar = this._parent.getBaseEnvVar(name, hidden);
        if (!envVar?.global) {
            return this._parent.getGlobalEnvVar(name, hidden);
        }
        return envVar;
    }
    hasExamples() {
        return this.examples.length > 0;
    }
    getExamples() {
        return this.examples;
    }
    hasExample(name) {
        return !!this.getExample(name);
    }
    getExample(name) {
        return this.examples.find((example)=>example.name === name
        );
    }
}
class BashCompletionsGenerator {
    cmd;
    static generate(cmd) {
        return new BashCompletionsGenerator(cmd).generate();
    }
    constructor(cmd2){
        this.cmd = cmd2;
    }
    generate() {
        const path = this.cmd.getPath();
        const version = this.cmd.getVersion() ? ` v${this.cmd.getVersion()}` : "";
        return `#!/usr/bin/env bash\n# bash completion support for ${path}${version}\n\n_${replaceSpecialChars1(path)}() {\n  local word cur prev\n  local -a opts\n  COMPREPLY=()\n  cur="\${COMP_WORDS[COMP_CWORD]}"\n  prev="\${COMP_WORDS[COMP_CWORD-1]}"\n  cmd="_"\n  opts=()\n\n  _${replaceSpecialChars1(this.cmd.getName())}_complete() {\n    local action="$1"; shift\n    mapfile -t values < <( ${this.cmd.getName()} completions complete "\${action}" "\${@}" )\n    for i in "\${values[@]}"; do\n      opts+=("$i")\n    done\n  }\n\n  ${this.generateCompletions(this.cmd).trim()}\n\n  for word in "\${COMP_WORDS[@]}"; do\n    case "\${word}" in\n      -*) ;;\n      *)\n        cmd_tmp="\${cmd}_\${word//[^[:alnum:]]/_}"\n        if type "\${cmd_tmp}" &>/dev/null; then\n          cmd="\${cmd_tmp}"\n        fi\n    esac\n  done\n\n  \${cmd}\n\n  if [[ \${#opts[@]} -eq 0 ]]; then\n    # shellcheck disable=SC2207\n    COMPREPLY=($(compgen -f "\${cur}"))\n    return 0\n  fi\n\n  local values\n  values="$( printf "\\n%s" "\${opts[@]}" )"\n  local IFS=$'\\n'\n  # shellcheck disable=SC2207\n  local result=($(compgen -W "\${values[@]}" -- "\${cur}"))\n  if [[ \${#result[@]} -eq 0 ]]; then\n    # shellcheck disable=SC2207\n    COMPREPLY=($(compgen -f "\${cur}"))\n  else\n    # shellcheck disable=SC2207\n    COMPREPLY=($(printf '%q\\n' "\${result[@]}"))\n  fi\n\n  return 0\n}\n\ncomplete -F _${replaceSpecialChars1(path)} -o bashdefault -o default ${path}\n`;
    }
    generateCompletions(command, path = "", index = 1) {
        path = (path ? path + " " : "") + command.getName();
        const commandCompletions = this.generateCommandCompletions(command, path, index);
        const childCommandCompletions = command.getCommands(false).filter((subCommand)=>subCommand !== command
        ).map((subCommand)=>this.generateCompletions(subCommand, path, index + 1)
        ).join("");
        return `${commandCompletions}\n\n${childCommandCompletions}`;
    }
    generateCommandCompletions(command, path, index) {
        const flags = this.getFlags(command);
        const childCommandNames = command.getCommands(false).map((childCommand)=>childCommand.getName()
        );
        const completionsPath = ~path.indexOf(" ") ? " " + path.split(" ").slice(1).join(" ") : "";
        const optionArguments = this.generateOptionArguments(command, completionsPath);
        const completionsCmd = this.generateCommandCompletionsCommand(command.getArguments(), completionsPath);
        return `  __${replaceSpecialChars1(path)}() {\n    opts=(${[
            ...flags,
            ...childCommandNames
        ].join(" ")})\n    ${completionsCmd}\n    if [[ \${cur} == -* || \${COMP_CWORD} -eq ${index} ]] ; then\n      return 0\n    fi\n    ${optionArguments}\n  }`;
    }
    getFlags(command) {
        return command.getOptions(false).map((option10)=>option10.flags
        ).flat();
    }
    generateOptionArguments(command, completionsPath) {
        let opts = "";
        const options6 = command.getOptions(false);
        if (options6.length) {
            opts += 'case "${prev}" in';
            for (const option10 of options6){
                const flags = option10.flags.map((flag)=>flag.trim()
                ).join("|");
                const completionsCmd = this.generateOptionCompletionsCommand(option10.args, completionsPath, {
                    standalone: option10.standalone
                });
                opts += `\n      ${flags}) ${completionsCmd} ;;`;
            }
            opts += "\n    esac";
        }
        return opts;
    }
    generateCommandCompletionsCommand(args, path) {
        if (args.length) {
            return `_${replaceSpecialChars1(this.cmd.getName())}_complete ${args[0].action}${path}`;
        }
        return "";
    }
    generateOptionCompletionsCommand(args, path, opts) {
        if (args.length) {
            return `opts=(); _${replaceSpecialChars1(this.cmd.getName())}_complete ${args[0].action}${path}`;
        }
        if (opts?.standalone) {
            return "opts=()";
        }
        return "";
    }
}
function replaceSpecialChars1(str1) {
    return str1.replace(/[^a-zA-Z0-9]/g, "_");
}
class BashCompletionsCommand extends Command {
    #cmd;
    constructor(cmd3){
        super();
        this.#cmd = cmd3;
        this.description(()=>{
            const baseCmd = this.#cmd || this.getMainCommand();
            return `Generate shell completions for bash.\n\nTo enable bash completions for this program add following line to your ${dim(italic("~/.bashrc"))}:\n\n    ${dim(italic(`source <(${baseCmd.getPath()} completions bash)`))}`;
        }).action(()=>{
            const baseCmd = this.#cmd || this.getMainCommand();
            Deno.stdout.writeSync(new TextEncoder().encode(BashCompletionsGenerator.generate(baseCmd)));
        });
    }
}
class CompleteCommand extends Command {
    constructor(cmd4){
        super();
        this.description("Get completions for given action from given command.").arguments("<action:string> [command...:string]").action(async (_, action, commandNames)=>{
            let parent;
            const completeCommand = commandNames?.reduce((cmd5, name19)=>{
                parent = cmd5;
                const childCmd = cmd5.getCommand(name19, false);
                if (!childCmd) {
                    throw new UnknownCompletionCommand(name19, cmd5.getCommands());
                }
                return childCmd;
            }, cmd4 || this.getMainCommand()) ?? (cmd4 || this.getMainCommand());
            const completion = completeCommand.getCompletion(action);
            const result = await completion?.complete(completeCommand, parent) ?? [];
            if (result?.length) {
                Deno.stdout.writeSync(new TextEncoder().encode(result.join("\n")));
            }
        }).reset();
    }
}
class FishCompletionsGenerator {
    cmd;
    static generate(cmd) {
        return new FishCompletionsGenerator(cmd).generate();
    }
    constructor(cmd5){
        this.cmd = cmd5;
    }
    generate() {
        const path = this.cmd.getPath();
        const version = this.cmd.getVersion() ? ` v${this.cmd.getVersion()}` : "";
        return `#!/usr/bin/env fish\n# fish completion support for ${path}${version}\n\nfunction __fish_${replaceSpecialChars2(this.cmd.getName())}_using_command\n  set cmds ${getCommandFnNames(this.cmd).join(" ")}\n  set words (commandline -opc)\n  set cmd "_"\n  for word in $words\n    switch $word\n      case '-*'\n        continue\n      case '*'\n        set word (string replace -r -a '\\W' '_' $word)\n        set cmd_tmp $cmd"_$word"\n        if contains $cmd_tmp $cmds\n          set cmd $cmd_tmp\n        end\n    end\n  end\n  if [ "$cmd" = "$argv[1]" ]\n    return 0\n  end\n  return 1\nend\n\n${this.generateCompletions(this.cmd).trim()}\n`;
    }
    generateCompletions(command) {
        const parent = command.getParent();
        let result = ``;
        if (parent) {
            result += "\n" + this.complete(parent, {
                description: command.getShortDescription(),
                arguments: command.getName()
            });
        }
        const commandArgs = command.getArguments();
        if (commandArgs.length) {
            result += "\n" + this.complete(command, {
                arguments: commandArgs.length ? this.getCompletionCommand(commandArgs[0].action + " " + getCompletionsPath(command)) : undefined
            });
        }
        for (const option10 of command.getOptions(false)){
            result += "\n" + this.completeOption(command, option10);
        }
        for (const subCommand of command.getCommands(false)){
            result += this.generateCompletions(subCommand);
        }
        return result;
    }
    completeOption(command, option) {
        const shortOption = option.flags.find((flag)=>flag.length === 2
        )?.replace(/^(-)+/, "");
        const longOption = option.flags.find((flag)=>flag.length > 2
        )?.replace(/^(-)+/, "");
        return this.complete(command, {
            description: option.description,
            shortOption: shortOption,
            longOption: longOption,
            required: true,
            standalone: option.standalone,
            arguments: option.args.length ? this.getCompletionCommand(option.args[0].action + " " + getCompletionsPath(command)) : undefined
        });
    }
    complete(command, options) {
        const cmd6 = [
            "complete"
        ];
        cmd6.push("-c", this.cmd.getName());
        cmd6.push("-n", `'__fish_${replaceSpecialChars2(this.cmd.getName())}_using_command __${replaceSpecialChars2(command.getPath())}'`);
        options.shortOption && cmd6.push("-s", options.shortOption);
        options.longOption && cmd6.push("-l", options.longOption);
        options.standalone && cmd6.push("-x");
        cmd6.push("-k");
        cmd6.push("-f");
        if (options.arguments) {
            options.required && cmd6.push("-r");
            cmd6.push("-a", options.arguments);
        }
        options.description && cmd6.push("-d", `'${options.description}'`);
        return cmd6.join(" ");
    }
    getCompletionCommand(cmd) {
        return `'(${this.cmd.getName()} completions complete ${cmd.trim()})'`;
    }
}
function getCommandFnNames(cmd6, cmds = []) {
    cmds.push(`__${replaceSpecialChars2(cmd6.getPath())}`);
    cmd6.getCommands(false).forEach((command)=>{
        getCommandFnNames(command, cmds);
    });
    return cmds;
}
function getCompletionsPath(command) {
    return command.getPath().split(" ").slice(1).join(" ");
}
function replaceSpecialChars2(str1) {
    return str1.replace(/[^a-zA-Z0-9]/g, "_");
}
class FishCompletionsCommand extends Command {
    #cmd;
    constructor(cmd6){
        super();
        this.#cmd = cmd6;
        this.description(()=>{
            const baseCmd = this.#cmd || this.getMainCommand();
            return `Generate shell completions for fish.\n\nTo enable fish completions for this program add following line to your ${dim(italic("~/.config/fish/config.fish"))}:\n\n    ${dim(italic(`source (${baseCmd.getPath()} completions fish | psub)`))}`;
        }).action(()=>{
            const baseCmd = this.#cmd || this.getMainCommand();
            Deno.stdout.writeSync(new TextEncoder().encode(FishCompletionsGenerator.generate(baseCmd)));
        });
    }
}
class ZshCompletionsGenerator {
    cmd;
    actions = new Map();
    static generate(cmd) {
        return new ZshCompletionsGenerator(cmd).generate();
    }
    constructor(cmd7){
        this.cmd = cmd7;
    }
    generate() {
        const path = this.cmd.getPath();
        const name19 = this.cmd.getName();
        const version = this.cmd.getVersion() ? ` v${this.cmd.getVersion()}` : "";
        return `#!/usr/bin/env zsh\n# zsh completion support for ${path}${version}\n\nautoload -U is-at-least\n\n# shellcheck disable=SC2154\n(( $+functions[__${replaceSpecialChars3(name19)}_complete] )) ||\nfunction __${replaceSpecialChars3(name19)}_complete {\n  local name="$1"; shift\n  local action="$1"; shift\n  integer ret=1\n  local -a values\n  local expl lines\n  _tags "$name"\n  while _tags; do\n    if _requested "$name"; then\n      # shellcheck disable=SC2034\n      lines="$(${name19} completions complete "\${action}" "\${@}")"\n      values=("\${(ps:\\n:)lines}")\n      if (( \${#values[@]} )); then\n        while _next_label "$name" expl "$action"; do\n          compadd -S '' "\${expl[@]}" "\${values[@]}"\n        done\n      fi\n    fi\n  done\n}\n\n${this.generateCompletions(this.cmd).trim()}\n\n# _${replaceSpecialChars3(path)} "\${@}"\n\ncompdef _${replaceSpecialChars3(path)} ${path}\n\n`;
    }
    generateCompletions(command, path = "") {
        if (!command.hasCommands(false) && !command.hasOptions(false) && !command.hasArguments()) {
            return "";
        }
        path = (path ? path + " " : "") + command.getName();
        return `# shellcheck disable=SC2154\n(( $+functions[_${replaceSpecialChars3(path)}] )) ||\nfunction _${replaceSpecialChars3(path)}() {` + (!command.getParent() ? `\n  local state` : "") + this.generateCommandCompletions(command, path) + this.generateSubCommandCompletions(command, path) + this.generateArgumentCompletions(command, path) + this.generateActions(command) + `\n}\n\n` + command.getCommands(false).filter((subCommand)=>subCommand !== command
        ).map((subCommand)=>this.generateCompletions(subCommand, path)
        ).join("");
    }
    generateCommandCompletions(command, path) {
        const commands5 = command.getCommands(false);
        let completions = commands5.map((subCommand)=>`'${subCommand.getName()}:${subCommand.getShortDescription()}'`
        ).join("\n      ");
        if (completions) {
            completions = `\n    local -a commands\n    # shellcheck disable=SC2034\n    commands=(\n      ${completions}\n    )\n    _describe 'command' commands`;
        }
        if (command.hasArguments()) {
            const completionsPath = path.split(" ").slice(1).join(" ");
            const arg3 = command.getArguments()[0];
            const action = this.addAction(arg3, completionsPath);
            if (action && command.getCompletion(arg3.action)) {
                completions += `\n    __${replaceSpecialChars3(this.cmd.getName())}_complete ${action.arg.name} ${action.arg.action} ${action.cmd}`;
            }
        }
        if (completions) {
            completions = `\n\n  function _commands() {${completions}\n  }`;
        }
        return completions;
    }
    generateSubCommandCompletions(command, path) {
        if (command.hasCommands(false)) {
            const actions = command.getCommands(false).map((command)=>`${command.getName()}) _${replaceSpecialChars3(path + " " + command.getName())} ;;`
            ).join("\n      ");
            return `\n\n  function _command_args() {\n    case "\${words[1]}" in\n      ${actions}\n    esac\n  }`;
        }
        return "";
    }
    generateArgumentCompletions(command, path) {
        this.actions.clear();
        const options6 = this.generateOptions(command, path);
        let argIndex = 0;
        let argsCommand = "\n\n  _arguments -w -s -S -C";
        if (command.hasOptions()) {
            argsCommand += ` \\\n    ${options6.join(" \\\n    ")}`;
        }
        if (command.hasCommands(false) || command.getArguments().filter((arg3)=>command.getCompletion(arg3.action)
        ).length) {
            argsCommand += ` \\\n    '${++argIndex}: :_commands'`;
        }
        if (command.hasArguments() || command.hasCommands(false)) {
            const args3 = [];
            for (const arg3 of command.getArguments().slice(1)){
                const completionsPath = path.split(" ").slice(1).join(" ");
                const action = this.addAction(arg3, completionsPath);
                args3.push(`${++argIndex}${arg3.optionalValue ? "::" : ":"}${action.name}`);
            }
            argsCommand += args3.map((arg4)=>`\\\n    '${arg4}'`
            ).join("");
            if (command.hasCommands(false)) {
                argsCommand += ` \\\n    '*:: :->command_args'`;
            }
        }
        return argsCommand;
    }
    generateOptions(command, path) {
        const options6 = [];
        const cmdArgs = path.split(" ");
        const _baseName = cmdArgs.shift();
        const completionsPath = cmdArgs.join(" ");
        const excludedFlags = command.getOptions(false).map((option10)=>option10.standalone ? option10.flags : false
        ).flat().filter((flag)=>typeof flag === "string"
        );
        for (const option10 of command.getOptions(false)){
            options6.push(this.generateOption(option10, completionsPath, excludedFlags));
        }
        return options6;
    }
    generateOption(option, completionsPath, excludedOptions) {
        const flags = option.flags;
        let excludedFlags = option.conflicts?.length ? [
            ...excludedOptions,
            ...option.conflicts.map((opt)=>"--" + opt.replace(/^--/, "")
            ), 
        ] : excludedOptions;
        excludedFlags = option.collect ? excludedFlags : [
            ...excludedFlags,
            ...flags, 
        ];
        let args3 = "";
        for (const arg3 of option.args){
            const action = this.addAction(arg3, completionsPath);
            if (arg3.variadic) {
                args3 += `${arg3.optionalValue ? "::" : ":"}${arg3.name}:->${action.name}`;
            } else {
                args3 += `${arg3.optionalValue ? "::" : ":"}${arg3.name}:->${action.name}`;
            }
        }
        let description = option.description.trim().split("\n").shift();
        description = description.replace(/\[/g, "\\[").replace(/]/g, "\\]").replace(/"/g, '\\"').replace(/'/g, "'\"'\"'");
        const collect = option.collect ? "*" : "";
        if (option.standalone) {
            return `'(- *)'{${collect}${flags}}'[${description}]${args3}'`;
        } else {
            const excluded2 = excludedFlags.length ? `'(${excludedFlags.join(" ")})'` : "";
            if (collect || flags.length > 1) {
                return `${excluded2}{${collect}${flags}}'[${description}]${args3}'`;
            } else {
                return `${excluded2}${flags}'[${description}]${args3}'`;
            }
        }
    }
    addAction(arg, cmd) {
        const action = `${arg.name}-${arg.action}`;
        if (!this.actions.has(action)) {
            this.actions.set(action, {
                arg: arg,
                label: `${arg.name}: ${arg.action}`,
                name: action,
                cmd
            });
        }
        return this.actions.get(action);
    }
    generateActions(command) {
        let actions = [];
        if (this.actions.size) {
            actions = Array.from(this.actions).map(([name19, action])=>`${name19}) __${replaceSpecialChars3(this.cmd.getName())}_complete ${action.arg.name} ${action.arg.action} ${action.cmd} ;;`
            );
        }
        if (command.hasCommands(false)) {
            actions.unshift(`command_args) _command_args ;;`);
        }
        if (actions.length) {
            return `\n\n  case "$state" in\n    ${actions.join("\n    ")}\n  esac`;
        }
        return "";
    }
}
function replaceSpecialChars3(str1) {
    return str1.replace(/[^a-zA-Z0-9]/g, "_");
}
class ZshCompletionsCommand extends Command {
    #cmd;
    constructor(cmd8){
        super();
        this.#cmd = cmd8;
        this.description(()=>{
            const baseCmd = this.#cmd || this.getMainCommand();
            return `Generate shell completions for zsh.\n\nTo enable zsh completions for this program add following line to your ${dim(italic("~/.zshrc"))}:\n\n    ${dim(italic(`source <(${baseCmd.getPath()} completions zsh)`))}`;
        }).action(()=>{
            const baseCmd = this.#cmd || this.getMainCommand();
            Deno.stdout.writeSync(new TextEncoder().encode(ZshCompletionsGenerator.generate(baseCmd)));
        });
    }
}
class CompletionsCommand extends Command {
    #cmd;
    constructor(cmd9){
        super();
        this.#cmd = cmd9;
        this.description(()=>{
            const baseCmd = this.#cmd || this.getMainCommand();
            return `Generate shell completions.\n\nTo enable shell completions for this program add the following line to your ${dim(italic("~/.bashrc"))} or similar:\n\n    ${dim(italic(`source <(${baseCmd.getPath()} completions [shell])`))}\n\n    For more information run ${dim(italic(`${baseCmd.getPath()} completions [shell] --help`))}\n`;
        }).action(()=>this.showHelp()
        ).command("bash", new BashCompletionsCommand(this.#cmd)).command("fish", new FishCompletionsCommand(this.#cmd)).command("zsh", new ZshCompletionsCommand(this.#cmd)).command("complete", new CompleteCommand(this.#cmd).hidden()).reset();
    }
}
class CommandType extends StringType {
    complete(_cmd, parent) {
        return parent?.getCommands(false).map((cmd10)=>cmd10.getName()
        ) || [];
    }
}
class HelpCommand extends Command {
    constructor(cmd10){
        super();
        this.type("command", new CommandType()).arguments("[command:command]").description("Show this help or the help of a sub-command.").action((_, name19)=>{
            if (!cmd10) {
                cmd10 = name19 ? this.getGlobalParent()?.getBaseCommand(name19) : this.getGlobalParent();
            }
            if (!cmd10) {
                const cmds = this.getGlobalParent()?.getCommands();
                throw new UnknownCommand(name19 ?? "", cmds ?? [], [
                    this.getName(),
                    ...this.getAliases(), 
                ]);
            }
            cmd10.showHelp();
            Deno.exit(0);
        });
    }
}
class ActionListType extends StringType {
    cmd;
    constructor(cmd11){
        super();
        this.cmd = cmd11;
    }
    complete() {
        return this.cmd.getCompletions().map((type3)=>type3.name
        ).filter((value4, index, self)=>self.indexOf(value4) === index
        );
    }
}
class ChildCommandType extends StringType {
    #cmd;
    constructor(cmd12){
        super();
        this.#cmd = cmd12;
    }
    complete(cmd) {
        return (this.#cmd ?? cmd)?.getCommands(false).map((cmd13)=>cmd13.getName()
        ) || [];
    }
}
class EnumType extends Type {
    allowedValues;
    constructor(values){
        super();
        this.allowedValues = values;
    }
    parse(type) {
        for (const value4 of this.allowedValues){
            if (value4.toString() === type.value) {
                return value4;
            }
        }
        throw new InvalidTypeError(type, this.allowedValues.slice());
    }
    values() {
        return this.allowedValues.slice();
    }
    complete() {
        return this.values();
    }
}
const KeyMap = {
    "[P": "f1",
    "[Q": "f2",
    "[R": "f3",
    "[S": "f4",
    "OP": "f1",
    "OQ": "f2",
    "OR": "f3",
    "OS": "f4",
    "[11~": "f1",
    "[12~": "f2",
    "[13~": "f3",
    "[14~": "f4",
    "[[A": "f1",
    "[[B": "f2",
    "[[C": "f3",
    "[[D": "f4",
    "[[E": "f5",
    "[15~": "f5",
    "[17~": "f6",
    "[18~": "f7",
    "[19~": "f8",
    "[20~": "f9",
    "[21~": "f10",
    "[23~": "f11",
    "[24~": "f12",
    "[A": "up",
    "[B": "down",
    "[C": "right",
    "[D": "left",
    "[E": "clear",
    "[F": "end",
    "[H": "home",
    "OA": "up",
    "OB": "down",
    "OC": "right",
    "OD": "left",
    "OE": "clear",
    "OF": "end",
    "OH": "home",
    "[1~": "home",
    "[2~": "insert",
    "[3~": "delete",
    "[4~": "end",
    "[5~": "pageup",
    "[6~": "pagedown",
    "[[5~": "pageup",
    "[[6~": "pagedown",
    "[7~": "home",
    "[8~": "end"
};
const KeyMapShift = {
    "[a": "up",
    "[b": "down",
    "[c": "right",
    "[d": "left",
    "[e": "clear",
    "[2$": "insert",
    "[3$": "delete",
    "[5$": "pageup",
    "[6$": "pagedown",
    "[7$": "home",
    "[8$": "end",
    "[Z": "tab"
};
const KeyMapCtrl = {
    "Oa": "up",
    "Ob": "down",
    "Oc": "right",
    "Od": "left",
    "Oe": "clear",
    "[2^": "insert",
    "[3^": "delete",
    "[5^": "pageup",
    "[6^": "pagedown",
    "[7^": "home",
    "[8^": "end"
};
const SpecialKeyMap = {
    "\r": "return",
    "\n": "enter",
    "\t": "tab",
    "\b": "backspace",
    "\x7f": "backspace",
    "\x1b": "escape",
    " ": "space"
};
const kEscape = "\x1b";
function parse(data) {
    let index = -1;
    const keys = [];
    const input = data instanceof Uint8Array ? new TextDecoder().decode(data) : data;
    const hasNext = ()=>input.length - 1 >= index + 1
    ;
    const next = ()=>input[++index]
    ;
    parseNext();
    return keys;
    function parseNext() {
        let ch = next();
        let s = ch;
        let escaped = false;
        const key1 = {
            name: undefined,
            sequence: undefined,
            code: undefined,
            ctrl: false,
            meta: false,
            shift: false
        };
        if (ch === kEscape && hasNext()) {
            escaped = true;
            s += ch = next();
            if (ch === kEscape) {
                s += ch = next();
            }
        }
        if (escaped && (ch === "O" || ch === "[")) {
            let code2 = ch;
            let modifier = 0;
            if (ch === "O") {
                s += ch = next();
                if (ch >= "0" && ch <= "9") {
                    modifier = (Number(ch) >> 0) - 1;
                    s += ch = next();
                }
                code2 += ch;
            } else if (ch === "[") {
                s += ch = next();
                if (ch === "[") {
                    code2 += ch;
                    s += ch = next();
                }
                const cmdStart = s.length - 1;
                if (ch >= "0" && ch <= "9") {
                    s += ch = next();
                    if (ch >= "0" && ch <= "9") {
                        s += ch = next();
                    }
                }
                if (ch === ";") {
                    s += ch = next();
                    if (ch >= "0" && ch <= "9") {
                        s += next();
                    }
                }
                const cmd13 = s.slice(cmdStart);
                let match;
                if (match = cmd13.match(/^(\d\d?)(;(\d))?([~^$])$/)) {
                    code2 += match[1] + match[4];
                    modifier = (Number(match[3]) || 1) - 1;
                } else if (match = cmd13.match(/^((\d;)?(\d))?([A-Za-z])$/)) {
                    code2 += match[4];
                    modifier = (Number(match[3]) || 1) - 1;
                } else {
                    code2 += cmd13;
                }
            }
            key1.ctrl = !!(modifier & 4);
            key1.meta = !!(modifier & 10);
            key1.shift = !!(modifier & 1);
            key1.code = code2;
            if (code2 in KeyMap) {
                key1.name = KeyMap[code2];
            } else if (code2 in KeyMapShift) {
                key1.name = KeyMapShift[code2];
                key1.shift = true;
            } else if (code2 in KeyMapCtrl) {
                key1.name = KeyMapCtrl[code2];
                key1.ctrl = true;
            } else {
                key1.name = "undefined";
            }
        } else if (ch in SpecialKeyMap) {
            key1.name = SpecialKeyMap[ch];
            key1.meta = escaped;
        } else if (!escaped && ch <= "\x1a") {
            key1.name = String.fromCharCode(ch.charCodeAt(0) + "a".charCodeAt(0) - 1);
            key1.ctrl = true;
        } else if (/^[0-9A-Za-z]$/.test(ch)) {
            key1.name = ch.toLowerCase();
            key1.shift = /^[A-Z]$/.test(ch);
            key1.meta = escaped;
        } else if (escaped) {
            key1.name = ch.length ? undefined : "escape";
            key1.meta = true;
        }
        key1.sequence = s;
        if (s.length !== 0 && (key1.name !== undefined || escaped)) {
            keys.push(key1);
        } else if (charLengthAt(s, 0) === s.length) {
            keys.push(key1);
        } else {
            throw new Error("Unrecognized or broken escape sequence");
        }
        if (hasNext()) {
            parseNext();
        }
    }
}
function charLengthAt(str1, i1) {
    const pos = str1.codePointAt(i1);
    if (typeof pos === "undefined") {
        return 1;
    }
    return pos >= 65536 ? 2 : 1;
}
const main = {
    ARROW_UP: "↑",
    ARROW_DOWN: "↓",
    ARROW_LEFT: "←",
    ARROW_RIGHT: "→",
    ARROW_UP_LEFT: "↖",
    ARROW_UP_RIGHT: "↗",
    ARROW_DOWN_RIGHT: "↘",
    ARROW_DOWN_LEFT: "↙",
    RADIO_ON: "◉",
    RADIO_OFF: "◯",
    TICK: "✔",
    CROSS: "✘",
    ELLIPSIS: "…",
    POINTER_SMALL: "›",
    LINE: "─",
    POINTER: "❯",
    INFO: "ℹ",
    TAB_LEFT: "⇤",
    TAB_RIGHT: "⇥",
    ESCAPE: "⎋",
    BACKSPACE: "⌫",
    PAGE_UP: "⇞",
    PAGE_DOWN: "⇟",
    ENTER: "↵",
    SEARCH: "⌕"
};
const win = {
    ...main,
    RADIO_ON: "(*)",
    RADIO_OFF: "( )",
    TICK: "√",
    CROSS: "×",
    POINTER_SMALL: "»"
};
const Figures = Deno.build.os === "windows" ? win : main;
class GenericPrompt {
    static injectedValue;
    settings;
    tty = tty1;
    indent;
    cursor = {
        x: 0,
        y: 0
    };
    #value;
    #lastError;
    #isFirstRun = true;
    static inject(value) {
        GenericPrompt.injectedValue = value;
    }
    constructor(settings){
        this.settings = {
            ...settings,
            keys: {
                submit: [
                    "enter",
                    "return"
                ],
                ...settings.keys ?? {
                }
            }
        };
        this.indent = this.settings.indent ?? " ";
    }
    async prompt() {
        try {
            return await this.#execute();
        } finally{
            this.tty.cursorShow();
        }
    }
    clear() {
        this.tty.cursorLeft.eraseDown();
    }
    #execute = async ()=>{
        if (typeof GenericPrompt.injectedValue !== "undefined" && this.#lastError) {
            throw new Error(await this.error());
        }
        await this.render();
        this.#lastError = undefined;
        if (!await this.read()) {
            return this.#execute();
        }
        if (typeof this.#value === "undefined") {
            throw new Error("internal error: failed to read value");
        }
        this.clear();
        const successMessage = this.success(this.#value);
        if (successMessage) {
            console.log(successMessage);
        }
        GenericPrompt.injectedValue = undefined;
        this.tty.cursorShow();
        return this.#value;
    };
    async render() {
        const result = await Promise.all([
            this.message(),
            this.body?.(),
            this.footer(), 
        ]);
        const content = result.filter(Boolean).join("\n");
        const y = content.split("\n").length - this.cursor.y - 1;
        if (!this.#isFirstRun || this.#lastError) {
            this.clear();
        }
        this.#isFirstRun = false;
        if (Deno.build.os === "windows") {
            console.log(content);
            this.tty.cursorUp();
        } else {
            Deno.stdout.writeSync(new TextEncoder().encode(content));
        }
        if (y) {
            this.tty.cursorUp(y);
        }
        this.tty.cursorTo(this.cursor.x);
    }
    async read() {
        if (typeof GenericPrompt.injectedValue !== "undefined") {
            const value4 = GenericPrompt.injectedValue;
            await this.#validateValue(value4);
        } else {
            const events = await this.#readKey();
            if (!events.length) {
                return false;
            }
            for (const event of events){
                await this.handleEvent(event);
            }
        }
        return typeof this.#value !== "undefined";
    }
    submit() {
        return this.#validateValue(this.getValue());
    }
    message() {
        return `${this.settings.indent}${yellow("?")} ` + bold(this.settings.message) + this.defaults();
    }
    defaults() {
        let defaultMessage = "";
        if (typeof this.settings.default !== "undefined") {
            defaultMessage += dim(` (${this.format(this.settings.default)})`);
        }
        return defaultMessage;
    }
    success(value) {
        return `${this.settings.indent}${yellow("?")} ` + bold(this.settings.message) + this.defaults() + " " + this.settings.pointer + " " + green(this.format(value));
    }
    footer() {
        return this.error() ?? this.hint();
    }
    error() {
        return this.#lastError ? this.settings.indent + red(bold(`${Figures.CROSS} `) + this.#lastError) : undefined;
    }
    hint() {
        return this.settings.hint ? this.settings.indent + italic(blue(dim(`${Figures.POINTER} `) + this.settings.hint)) : undefined;
    }
    async handleEvent(event) {
        switch(true){
            case event.name === "c" && event.ctrl:
                this.clear();
                this.tty.cursorShow();
                Deno.exit(0);
                return;
            case this.isKey(this.settings.keys, "submit", event):
                await this.submit();
                break;
        }
    }
    #readKey = async ()=>{
        const data = await this.#readChar();
        return data.length ? parse(data) : [];
    };
    #readChar = async ()=>{
        const buffer = new Uint8Array(8);
        const isTty = Deno.isatty(Deno.stdin.rid);
        if (isTty) {
            Deno.setRaw(Deno.stdin.rid, true, {
                cbreak: this.settings.cbreak === true
            });
        }
        const nread = await Deno.stdin.read(buffer);
        if (isTty) {
            Deno.setRaw(Deno.stdin.rid, false);
        }
        if (nread === null) {
            return buffer;
        }
        return buffer.subarray(0, nread);
    };
    #transformValue = (value4)=>{
        return this.settings.transform ? this.settings.transform(value4) : this.transform(value4);
    };
    #validateValue = async (value4)=>{
        if (!value4 && typeof this.settings.default !== "undefined") {
            this.#value = this.settings.default;
            return;
        }
        this.#value = undefined;
        this.#lastError = undefined;
        const validation = await (this.settings.validate ? this.settings.validate(value4) : this.validate(value4));
        if (validation === false) {
            this.#lastError = `Invalid answer.`;
        } else if (typeof validation === "string") {
            this.#lastError = validation;
        } else {
            this.#value = this.#transformValue(value4);
        }
    };
    isKey(keys, name, event) {
        const keyNames = keys?.[name];
        return typeof keyNames !== "undefined" && (typeof event.name !== "undefined" && keyNames.indexOf(event.name) !== -1 || typeof event.sequence !== "undefined" && keyNames.indexOf(event.sequence) !== -1);
    }
}
class GenericInput extends GenericPrompt {
    inputValue = "";
    inputIndex = 0;
    constructor(settings1){
        super({
            ...settings1,
            keys: {
                moveCursorLeft: [
                    "left"
                ],
                moveCursorRight: [
                    "right"
                ],
                deleteCharLeft: [
                    "backspace"
                ],
                deleteCharRight: [
                    "delete"
                ],
                ...settings1.keys ?? {
                }
            }
        });
    }
    getCurrentInputValue() {
        return this.inputValue;
    }
    message() {
        const message7 = super.message() + " " + this.settings.pointer + " ";
        this.cursor.x = stripColor(message7).length + this.inputIndex + 1;
        return message7 + this.input();
    }
    input() {
        return underline(this.inputValue);
    }
    highlight(value, color1 = dim, color2 = blue) {
        value = value.toString();
        const inputLowerCase = this.getCurrentInputValue().toLowerCase();
        const valueLowerCase = value.toLowerCase();
        const index = valueLowerCase.indexOf(inputLowerCase);
        const matched = value.slice(index, index + inputLowerCase.length);
        return index >= 0 ? color1(value.slice(0, index)) + color2(matched) + color1(value.slice(index + inputLowerCase.length)) : value;
    }
    async handleEvent(event) {
        switch(true){
            case event.name === "c" && event.ctrl:
                this.clear();
                this.tty.cursorShow();
                Deno.exit(0);
                return;
            case this.isKey(this.settings.keys, "moveCursorLeft", event):
                this.moveCursorLeft();
                break;
            case this.isKey(this.settings.keys, "moveCursorRight", event):
                this.moveCursorRight();
                break;
            case this.isKey(this.settings.keys, "deleteCharRight", event):
                this.deleteCharRight();
                break;
            case this.isKey(this.settings.keys, "deleteCharLeft", event):
                this.deleteChar();
                break;
            case this.isKey(this.settings.keys, "submit", event):
                await this.submit();
                break;
            default:
                if (event.sequence && !event.meta && !event.ctrl) {
                    this.addChar(event.sequence);
                }
        }
    }
    addChar(__char) {
        this.inputValue = this.inputValue.slice(0, this.inputIndex) + __char + this.inputValue.slice(this.inputIndex);
        this.inputIndex++;
    }
    moveCursorLeft() {
        if (this.inputIndex > 0) {
            this.inputIndex--;
        }
    }
    moveCursorRight() {
        if (this.inputIndex < this.inputValue.length) {
            this.inputIndex++;
        }
    }
    deleteChar() {
        if (this.inputIndex > 0) {
            this.inputIndex--;
            this.deleteCharRight();
        }
    }
    deleteCharRight() {
        if (this.inputIndex < this.inputValue.length) {
            this.inputValue = this.inputValue.slice(0, this.inputIndex) + this.inputValue.slice(this.inputIndex + 1);
        }
    }
}
class GenericList extends GenericInput {
    options = this.settings.options;
    listIndex = this.getListIndex();
    listOffset = this.getPageOffset(this.listIndex);
    static separator(label = "------------") {
        return {
            value: label,
            disabled: true
        };
    }
    static mapOption(option) {
        return {
            value: option.value,
            name: typeof option.name === "undefined" ? option.value : option.name,
            disabled: !!option.disabled
        };
    }
    constructor(settings2){
        super({
            ...settings2,
            keys: {
                previous: settings2.search ? [
                    "up"
                ] : [
                    "up",
                    "u",
                    "8"
                ],
                next: settings2.search ? [
                    "down"
                ] : [
                    "down",
                    "d",
                    "2"
                ],
                previousPage: [
                    "pageup"
                ],
                nextPage: [
                    "pagedown"
                ],
                ...settings2.keys ?? {
                }
            }
        });
    }
    match() {
        const input = this.getCurrentInputValue().toLowerCase();
        if (!input.length) {
            this.options = this.settings.options.slice();
        } else {
            this.options = this.settings.options.filter((option10)=>match(option10.name) || option10.name !== option10.value && match(option10.value)
            ).sort((a, b)=>distance(a.name, input) - distance(b.name, input)
            );
        }
        this.listIndex = Math.max(0, Math.min(this.options.length - 1, this.listIndex));
        this.listOffset = Math.max(0, Math.min(this.options.length - this.getListHeight(), this.listOffset));
        function match(value4) {
            return stripColor(value4).toLowerCase().includes(input);
        }
    }
    message() {
        let message7 = `${this.settings.indent}${yellow("?")} ` + bold(this.settings.message) + this.defaults();
        if (this.settings.search) {
            message7 += " " + this.settings.searchLabel + " ";
        }
        this.cursor.x = stripColor(message7).length + this.inputIndex + 1;
        return message7 + this.input();
    }
    body() {
        return this.getList() + this.getInfo();
    }
    getInfo() {
        if (!this.settings.info) {
            return "";
        }
        const selected = this.listIndex + 1;
        const actions = [
            [
                "Next",
                [
                    Figures.ARROW_DOWN
                ]
            ],
            [
                "Previous",
                [
                    Figures.ARROW_UP
                ]
            ],
            [
                "Next Page",
                [
                    Figures.PAGE_DOWN
                ]
            ],
            [
                "Previous Page",
                [
                    Figures.PAGE_UP
                ]
            ],
            [
                "Submit",
                [
                    Figures.ENTER
                ]
            ], 
        ];
        return "\n" + this.settings.indent + blue(Figures.INFO) + bold(` ${selected}/${this.options.length} `) + actions.map((cur)=>`${cur[0]}: ${bold(cur[1].join(" "))}`
        ).join(", ");
    }
    getList() {
        const list = [];
        const height = this.getListHeight();
        for(let i1 = this.listOffset; i1 < this.listOffset + height; i1++){
            list.push(this.getListItem(this.options[i1], this.listIndex === i1));
        }
        if (!list.length) {
            list.push(this.settings.indent + dim("  No matches..."));
        }
        return list.join("\n");
    }
    getListHeight() {
        return Math.min(this.options.length, this.settings.maxRows || this.options.length);
    }
    getListIndex(value) {
        return typeof value === "undefined" ? this.options.findIndex((item)=>!item.disabled
        ) || 0 : this.options.findIndex((item)=>item.value === value
        ) || 0;
    }
    getPageOffset(index) {
        if (index === 0) {
            return 0;
        }
        const height = this.getListHeight();
        return Math.floor(index / height) * height;
    }
    getOptionByValue(value) {
        return this.options.find((option10)=>option10.value === value
        );
    }
    read() {
        if (!this.settings.search) {
            this.tty.cursorHide();
        }
        return super.read();
    }
    async handleEvent(event) {
        switch(true){
            case this.isKey(this.settings.keys, "previous", event):
                this.selectPrevious();
                break;
            case this.isKey(this.settings.keys, "next", event):
                this.selectNext();
                break;
            case this.isKey(this.settings.keys, "nextPage", event):
                this.selectNextPage();
                break;
            case this.isKey(this.settings.keys, "previousPage", event):
                this.selectPreviousPage();
                break;
            default:
                await super.handleEvent(event);
        }
    }
    moveCursorLeft() {
        if (this.settings.search) {
            super.moveCursorLeft();
        }
    }
    moveCursorRight() {
        if (this.settings.search) {
            super.moveCursorRight();
        }
    }
    deleteChar() {
        if (this.settings.search) {
            super.deleteChar();
        }
    }
    deleteCharRight() {
        if (this.settings.search) {
            super.deleteCharRight();
            this.match();
        }
    }
    addChar(__char) {
        if (this.settings.search) {
            super.addChar(__char);
            this.match();
        }
    }
    selectPrevious() {
        if (this.options.length < 2) {
            return;
        }
        if (this.listIndex > 0) {
            this.listIndex--;
            if (this.listIndex < this.listOffset) {
                this.listOffset--;
            }
            if (this.options[this.listIndex].disabled) {
                this.selectPrevious();
            }
        } else {
            this.listIndex = this.options.length - 1;
            this.listOffset = this.options.length - this.getListHeight();
            if (this.options[this.listIndex].disabled) {
                this.selectPrevious();
            }
        }
    }
    selectNext() {
        if (this.options.length < 2) {
            return;
        }
        if (this.listIndex < this.options.length - 1) {
            this.listIndex++;
            if (this.listIndex >= this.listOffset + this.getListHeight()) {
                this.listOffset++;
            }
            if (this.options[this.listIndex].disabled) {
                this.selectNext();
            }
        } else {
            this.listIndex = this.listOffset = 0;
            if (this.options[this.listIndex].disabled) {
                this.selectNext();
            }
        }
    }
    selectPreviousPage() {
        if (this.options?.length) {
            const height = this.getListHeight();
            if (this.listOffset >= height) {
                this.listIndex -= height;
                this.listOffset -= height;
            } else if (this.listOffset > 0) {
                this.listIndex -= this.listOffset;
                this.listOffset = 0;
            }
        }
    }
    selectNextPage() {
        if (this.options?.length) {
            const height = this.getListHeight();
            if (this.listOffset + height + height < this.options.length) {
                this.listIndex += height;
                this.listOffset += height;
            } else if (this.listOffset + height < this.options.length) {
                const offset = this.options.length - height;
                this.listIndex += offset - this.listOffset;
                this.listOffset = offset;
            }
        }
    }
}
class Checkbox extends GenericList {
    static inject(value) {
        GenericPrompt.inject(value);
    }
    static prompt(options) {
        return new this({
            pointer: blue(Figures.POINTER_SMALL),
            indent: " ",
            listPointer: blue(Figures.POINTER),
            maxRows: 10,
            searchLabel: blue(Figures.SEARCH),
            minOptions: 0,
            maxOptions: Infinity,
            check: green(Figures.TICK),
            uncheck: red(Figures.CROSS),
            ...options,
            keys: {
                check: [
                    "space"
                ],
                ...options.keys ?? {
                }
            },
            options: Checkbox.mapOptions(options)
        }).prompt();
    }
    static separator(label) {
        return {
            ...super.separator(label),
            icon: false
        };
    }
    static mapOptions(options) {
        return options.options.map((item)=>typeof item === "string" ? {
                value: item
            } : item
        ).map((item)=>({
                ...this.mapOption(item),
                checked: typeof item.checked === "undefined" && options.default && options.default.indexOf(item.value) !== -1 ? true : !!item.checked,
                icon: typeof item.icon === "undefined" ? true : item.icon
            })
        );
    }
    getListItem(item, isSelected) {
        let line = this.settings.indent;
        line += isSelected ? this.settings.listPointer + " " : "  ";
        if (item.icon) {
            let check = item.checked ? this.settings.check + " " : this.settings.uncheck + " ";
            if (item.disabled) {
                check = dim(check);
            }
            line += check;
        } else {
            line += "  ";
        }
        line += `${isSelected ? this.highlight(item.name, (val)=>val
        ) : this.highlight(item.name)}`;
        return line;
    }
    getValue() {
        return this.settings.options.filter((item)=>item.checked
        ).map((item)=>item.value
        );
    }
    async handleEvent(event) {
        switch(true){
            case this.isKey(this.settings.keys, "check", event):
                this.checkValue();
                break;
            default:
                await super.handleEvent(event);
        }
    }
    checkValue() {
        const item = this.options[this.listIndex];
        item.checked = !item.checked;
    }
    validate(value) {
        const isValidValue = Array.isArray(value) && value.every((val)=>typeof val === "string" && val.length > 0 && this.settings.options.findIndex((option10)=>option10.value === val
            ) !== -1
        );
        if (!isValidValue) {
            return false;
        }
        if (value.length < this.settings.minOptions) {
            return `The minimum number of options is ${this.settings.minOptions} but got ${value.length}.`;
        }
        if (value.length > this.settings.maxOptions) {
            return `The maximum number of options is ${this.settings.maxOptions} but got ${value.length}.`;
        }
        return true;
    }
    transform(value) {
        return value.map((val)=>val.trim()
        );
    }
    format(value) {
        return value.map((val)=>this.getOptionByValue(val)?.name ?? val
        ).join(", ");
    }
}
class GenericSuggestions extends GenericInput {
    suggestionsIndex = -1;
    suggestionsOffset = 0;
    suggestions = [];
    constructor(settings3){
        super({
            ...settings3,
            keys: {
                complete: [
                    "tab"
                ],
                next: [
                    "up"
                ],
                previous: [
                    "down"
                ],
                nextPage: [
                    "pageup"
                ],
                previousPage: [
                    "pagedown"
                ],
                ...settings3.keys ?? {
                }
            }
        });
        const suggestions1 = this.loadSuggestions();
        if (suggestions1.length || this.settings.suggestions) {
            this.settings.suggestions = [
                ...suggestions1,
                ...this.settings.suggestions ?? [], 
            ].filter(uniqueSuggestions);
        }
    }
    get localStorage() {
        if (this.settings.id && "localStorage" in window) {
            try {
                return window.localStorage;
            } catch (_) {
            }
        }
        return null;
    }
    loadSuggestions() {
        if (this.settings.id) {
            const json = this.localStorage?.getItem(this.settings.id);
            const suggestions1 = json ? JSON.parse(json) : [];
            if (!Array.isArray(suggestions1)) {
                return [];
            }
            return suggestions1;
        }
        return [];
    }
    saveSuggestions(...suggestions) {
        if (this.settings.id) {
            this.localStorage?.setItem(this.settings.id, JSON.stringify([
                ...suggestions,
                ...this.loadSuggestions(), 
            ].filter(uniqueSuggestions)));
        }
    }
    render() {
        this.match();
        return super.render();
    }
    match() {
        if (!this.settings.suggestions?.length) {
            return;
        }
        const input = this.getCurrentInputValue().toLowerCase();
        if (!input.length) {
            this.suggestions = this.settings.suggestions.slice();
        } else {
            this.suggestions = this.settings.suggestions.filter((value4)=>stripColor(value4.toString()).toLowerCase().startsWith(input)
            ).sort((a, b)=>distance((a || a).toString(), input) - distance((b || b).toString(), input)
            );
        }
        this.suggestionsIndex = Math.max(this.getCurrentInputValue().trim().length === 0 ? -1 : 0, Math.min(this.suggestions.length - 1, this.suggestionsIndex));
        this.suggestionsOffset = Math.max(0, Math.min(this.suggestions.length - this.getListHeight(), this.suggestionsOffset));
    }
    input() {
        return super.input() + dim(this.getSuggestion());
    }
    getSuggestion() {
        return this.suggestions[this.suggestionsIndex]?.toString().substr(this.getCurrentInputValue().length) ?? "";
    }
    body() {
        return this.getList() + this.getInfo();
    }
    getInfo() {
        if (!this.settings.info) {
            return "";
        }
        const selected = this.suggestionsIndex + 1;
        const matched = this.suggestions.length;
        const actions = [];
        if (this.settings.suggestions?.length) {
            if (this.settings.list) {
                actions.push([
                    "Next",
                    [
                        Figures.ARROW_DOWN
                    ]
                ], [
                    "Previous",
                    [
                        Figures.ARROW_UP
                    ]
                ], [
                    "Next Page",
                    [
                        Figures.PAGE_DOWN
                    ]
                ], [
                    "Previous Page",
                    [
                        Figures.PAGE_UP
                    ]
                ]);
            } else {
                actions.push([
                    "Next",
                    [
                        Figures.ARROW_UP
                    ]
                ], [
                    "Previous",
                    [
                        Figures.ARROW_DOWN
                    ]
                ]);
            }
            actions.push([
                "Complete",
                [
                    Figures.TAB_RIGHT,
                    dim(" or"),
                    Figures.ARROW_RIGHT
                ]
            ]);
        }
        actions.push([
            "Submit",
            [
                Figures.ENTER
            ]
        ]);
        let info = this.settings.indent;
        if (this.settings.suggestions?.length) {
            info += blue(Figures.INFO) + bold(` ${selected}/${matched} `);
        }
        info += actions.map((cur)=>`${cur[0]}: ${bold(cur[1].join(" "))}`
        ).join(", ");
        return info;
    }
    getList() {
        if (!this.settings.suggestions?.length || !this.settings.list) {
            return "";
        }
        const list = [];
        const height = this.getListHeight();
        for(let i1 = this.suggestionsOffset; i1 < this.suggestionsOffset + height; i1++){
            list.push(this.getListItem(this.suggestions[i1], this.suggestionsIndex === i1));
        }
        if (list.length && this.settings.info) {
            list.push("");
        }
        return list.join("\n");
    }
    getListItem(value, isSelected) {
        let line = this.settings.indent ?? "";
        line += isSelected ? `${this.settings.listPointer} ` : "  ";
        if (isSelected) {
            line += underline(this.highlight(value));
        } else {
            line += this.highlight(value);
        }
        return line;
    }
    getListHeight(suggestions = this.suggestions) {
        return Math.min(suggestions.length, this.settings.maxRows || suggestions.length);
    }
    async handleEvent(event) {
        switch(true){
            case this.isKey(this.settings.keys, "next", event):
                if (this.settings.list) {
                    this.selectPreviousSuggestion();
                } else {
                    this.selectNextSuggestion();
                }
                break;
            case this.isKey(this.settings.keys, "previous", event):
                if (this.settings.list) {
                    this.selectNextSuggestion();
                } else {
                    this.selectPreviousSuggestion();
                }
                break;
            case this.isKey(this.settings.keys, "nextPage", event):
                if (this.settings.list) {
                    this.selectPreviousSuggestionsPage();
                } else {
                    this.selectNextSuggestionsPage();
                }
                break;
            case this.isKey(this.settings.keys, "previousPage", event):
                if (this.settings.list) {
                    this.selectNextSuggestionsPage();
                } else {
                    this.selectPreviousSuggestionsPage();
                }
                break;
            case this.isKey(this.settings.keys, "complete", event):
                this.complete();
                break;
            case this.isKey(this.settings.keys, "moveCursorRight", event):
                if (this.inputIndex < this.inputValue.length) {
                    this.moveCursorRight();
                } else {
                    this.complete();
                }
                break;
            default:
                await super.handleEvent(event);
        }
    }
    deleteCharRight() {
        if (this.inputIndex < this.inputValue.length) {
            super.deleteCharRight();
            if (!this.getCurrentInputValue().length) {
                this.suggestionsIndex = -1;
                this.suggestionsOffset = 0;
            }
        }
    }
    complete() {
        if (this.suggestions.length && this.suggestions[this.suggestionsIndex]) {
            this.inputValue = this.suggestions[this.suggestionsIndex].toString();
            this.inputIndex = this.inputValue.length;
            this.suggestionsIndex = 0;
            this.suggestionsOffset = 0;
        }
    }
    selectPreviousSuggestion() {
        if (this.suggestions?.length) {
            if (this.suggestionsIndex > -1) {
                this.suggestionsIndex--;
                if (this.suggestionsIndex < this.suggestionsOffset) {
                    this.suggestionsOffset--;
                }
            }
        }
    }
    selectNextSuggestion() {
        if (this.suggestions?.length) {
            if (this.suggestionsIndex < this.suggestions.length - 1) {
                this.suggestionsIndex++;
                if (this.suggestionsIndex >= this.suggestionsOffset + this.getListHeight()) {
                    this.suggestionsOffset++;
                }
            }
        }
    }
    selectPreviousSuggestionsPage() {
        if (this.suggestions?.length) {
            const height = this.getListHeight();
            if (this.suggestionsOffset >= height) {
                this.suggestionsIndex -= height;
                this.suggestionsOffset -= height;
            } else if (this.suggestionsOffset > 0) {
                this.suggestionsIndex -= this.suggestionsOffset;
                this.suggestionsOffset = 0;
            }
        }
    }
    selectNextSuggestionsPage() {
        if (this.suggestions?.length) {
            const height = this.getListHeight();
            if (this.suggestionsOffset + height + height < this.suggestions.length) {
                this.suggestionsIndex += height;
                this.suggestionsOffset += height;
            } else if (this.suggestionsOffset + height < this.suggestions.length) {
                const offset = this.suggestions.length - height;
                this.suggestionsIndex += offset - this.suggestionsOffset;
                this.suggestionsOffset = offset;
            }
        }
    }
}
function uniqueSuggestions(value4, index, self) {
    return typeof value4 !== "undefined" && value4 !== "" && self.indexOf(value4) === index;
}
class Select extends GenericList {
    listIndex = this.getListIndex(this.settings.default);
    static inject(value) {
        GenericPrompt.inject(value);
    }
    static prompt(options) {
        return new this({
            pointer: blue(Figures.POINTER_SMALL),
            indent: " ",
            listPointer: blue(Figures.POINTER),
            maxRows: 10,
            searchLabel: blue(Figures.SEARCH),
            ...options,
            options: Select.mapOptions(options)
        }).prompt();
    }
    static mapOptions(options) {
        return options.options.map((item)=>typeof item === "string" ? {
                value: item
            } : item
        ).map((item)=>this.mapOption(item)
        );
    }
    input() {
        return underline(blue(this.inputValue));
    }
    getListItem(item, isSelected) {
        let line = this.settings.indent;
        line += isSelected ? `${this.settings.listPointer} ` : "  ";
        line += `${isSelected ? this.highlight(item.name, (val)=>val
        ) : this.highlight(item.name)}`;
        return line;
    }
    getValue() {
        return this.options[this.listIndex]?.value ?? this.settings.default;
    }
    validate(value) {
        return typeof value === "string" && value.length > 0 && this.options.findIndex((option10)=>option10.value === value
        ) !== -1;
    }
    transform(value) {
        return value.trim();
    }
    format(value) {
        return this.getOptionByValue(value)?.name ?? value;
    }
}
let injected = {
};
class PromptList {
    prompts;
    options;
    result = {
    };
    index = -1;
    names;
    isInBeforeHook = false;
    get prompt() {
        return this.prompts[this.index];
    }
    constructor(prompts, options6){
        this.prompts = prompts;
        this.options = options6;
        this.names = this.prompts.map((prompt)=>prompt.name
        );
    }
    async run(name) {
        this.index = -1;
        this.result = {
        };
        this.isInBeforeHook = false;
        await this.next(name);
        return this.result;
    }
    async next(name) {
        if (this.updateIndex(name)) {
            await this.runBeforeHook(async ()=>{
                this.isInBeforeHook = false;
                await this.runPrompt();
                await this.runAfterHook();
            });
        }
    }
    updateIndex(name) {
        if (name && typeof name === "string") {
            this.index = this.names.indexOf(name);
            if (this.index === -1) {
                throw new Error(`Invalid prompt name: ${name}, allowed prompt names: ${this.names.join(", ")}`);
            }
        } else if (typeof name === "number") {
            if (name < 0 || name > this.names.length) {
                throw new Error(`Invalid prompt index: ${name}, prompt length: ${this.names.length}`);
            }
            this.index = name;
        } else if (name === true && !this.isInBeforeHook) {
            this.index++;
            if (this.index < this.names.length - 1) {
                this.index++;
            }
        } else {
            this.index++;
        }
        this.isInBeforeHook = false;
        if (this.index < this.names.length) {
            return true;
        } else if (this.index === this.names.length) {
            return false;
        } else {
            throw new Error("next() called multiple times");
        }
    }
    async runBeforeHook(run) {
        this.isInBeforeHook = true;
        const next = async (name19)=>{
            if (name19 || typeof name19 === "number") {
                return this.next(name19);
            }
            await run();
        };
        if (this.options?.before) {
            await this.options.before(this.prompt.name, this.result, async (name19)=>{
                if (name19 || typeof name19 === "number") {
                    return this.next(name19);
                } else if (this.prompt.before) {
                    await this.prompt.before(this.result, next);
                } else {
                    await run();
                }
            });
            return;
        } else if (this.prompt.before) {
            await this.prompt.before(this.result, next);
            return;
        }
        await run();
    }
    async runPrompt() {
        const prompt = this.prompt.type;
        if (typeof injected[this.prompt.name] !== "undefined") {
            if (prompt.inject) {
                prompt.inject(injected[this.prompt.name]);
            } else {
                GenericPrompt.inject(injected[this.prompt.name]);
            }
        }
        try {
            this.result[this.prompt.name] = await prompt.prompt({
                cbreak: this.options?.cbreak,
                ...this.prompt
            });
        } finally{
            tty1.cursorShow();
        }
    }
    async runAfterHook() {
        if (this.options?.after) {
            await this.options.after(this.prompt.name, this.result, async (name19)=>{
                if (name19) {
                    return this.next(name19);
                } else if (this.prompt.after) {
                    await this.prompt.after(this.result, (name20)=>this.next(name20)
                    );
                } else {
                    await this.next();
                }
            });
        } else if (this.prompt.after) {
            await this.prompt.after(this.result, (name19)=>this.next(name19)
            );
        } else {
            await this.next();
        }
    }
}
class KeyPressEvent extends Event {
    key;
    sequence;
    code;
    ctrlKey;
    metaKey;
    shiftKey;
    altKey;
    repeat;
    constructor(type3, eventInitDict){
        super(type3, eventInitDict);
        this.key = eventInitDict.name;
        this.sequence = eventInitDict.sequence;
        this.code = eventInitDict.code;
        this.ctrlKey = eventInitDict.ctrl ?? false;
        this.metaKey = eventInitDict.meta ?? false;
        this.shiftKey = eventInitDict.shift ?? false;
        this.altKey = eventInitDict.alt ?? false;
        this.repeat = eventInitDict.repeat ?? false;
    }
}
class Keypress extends EventTarget {
    #disposed = false;
    #pullQueue = [];
    #pushQueue = [];
    #lastEvent;
    #listeners = {
        keydown: new Set()
    };
    [Symbol.asyncIterator]() {
        return this;
    }
    get disposed() {
        return this.#disposed;
    }
    async next() {
        const event = !this.#disposed && await this.#pullEvent();
        return event && !this.#disposed ? {
            done: false,
            value: event
        } : {
            done: true,
            value: undefined
        };
    }
    then(f, g) {
        return this.next().then(({ value: value4  })=>{
            this.dispose();
            return value4;
        }).then(f).catch(g);
    }
    addEventListener(type, listener, options) {
        if (!this.#hasListeners()) {
            void this.#eventLoop();
        }
        super.addEventListener(type, listener, options);
        this.#listeners[type].add(listener);
    }
    removeEventListener(type, listener, options) {
        super.removeEventListener(type, listener, options);
        this.#listeners[type].delete(listener);
    }
    dispose(error) {
        if (this.#disposed) {
            throw new Error("KeyCodeStream already disposed");
        }
        this.#disposed = true;
        if (this.#pullQueue.length > 0) {
            const { resolve , reject  } = this.#pullQueue[0];
            this.#pullQueue.shift();
            error ? reject(error) : resolve(null);
        }
    }
    #eventLoop = async ()=>{
        if (this.#disposed) {
            return;
        }
        await this.#read();
        await new Promise((resolve)=>setTimeout(resolve)
        );
        if (this.#pullQueue.length || this.#hasListeners()) {
            await this.#eventLoop();
        }
    };
    #read = async ()=>{
        const buffer = new Uint8Array(8);
        Deno.setRaw(Deno.stdin.rid, true);
        const nread = await Deno.stdin.read(buffer).catch((error)=>{
            if (!this.#disposed) {
                this.dispose(error);
            }
            return null;
        });
        Deno.setRaw(Deno.stdin.rid, false);
        if (this.#disposed) {
            return;
        }
        let keys;
        try {
            keys = nread === null ? parse(buffer) : parse(buffer.subarray(0, nread));
        } catch (_) {
            return this.#read();
        }
        this.#dispatch(keys);
    };
    #dispatch = (keys)=>{
        for (const key2 of keys){
            const event = new KeyPressEvent("keydown", {
                ...key2,
                cancelable: true,
                repeat: this.#lastEvent && this.#lastEvent.sequence === key2.sequence && Date.now() - this.#lastEvent.timeStamp < 100
            });
            if (this.#pullQueue.length || !this.#hasListeners()) {
                this.#pushEvent(event);
            }
            if (this.#hasListeners()) {
                this.dispatchEvent(event);
                if (this.#disposed) {
                    break;
                }
            }
            this.#lastEvent = event;
        }
    };
    #pushEvent = (event)=>{
        if (this.#pullQueue.length > 0) {
            const { resolve  } = this.#pullQueue.shift();
            resolve(event);
        } else {
            this.#pushQueue.push(event);
        }
    };
    #pullEvent = async ()=>{
        if (!this.#hasListeners()) {
            await this.#read();
        }
        return new Promise((resolve, reject)=>{
            if (this.#pushQueue.length > 0) {
                const event = this.#pushQueue.shift() ?? null;
                resolve(event);
            } else {
                this.#pullQueue.push({
                    resolve,
                    reject
                });
            }
        });
    };
    #hasListeners = ()=>{
        return Object.values(this.#listeners).some((listeners)=>listeners.size
        );
    };
}
class Connection {
    static _data = {
    };
    static _count = 0;
    static get(id) {
        return this._data[id] || null;
    }
    static add(id, sock) {
        if (this._data[id]) {
            return false;
        } else {
            ++this._count;
            this._data[id] = sock;
            return true;
        }
    }
    static del(id) {
        PlayerCollection.exitRoom(id);
        PlayerCollection.del(id);
        --this._count;
        return delete this._data[id];
    }
    static sendTo(event, sockid, data) {
        const sock = this.get(sockid);
        if (sock) {
            if (!sock.isClosed) {
                sock.send(JSON.stringify({
                    func: event,
                    data
                }));
            }
        }
    }
}
var CardColor;
(function(CardColor1) {
    CardColor1[CardColor1["yellow"] = 0] = "yellow";
    CardColor1[CardColor1["red"] = 1] = "red";
    CardColor1[CardColor1["blue"] = 2] = "blue";
    CardColor1[CardColor1["green"] = 3] = "green";
    CardColor1[CardColor1["all"] = 4] = "all";
})(CardColor || (CardColor = {
}));
var CardType;
(function(CardType1) {
    CardType1[CardType1["number"] = 0] = "number";
    CardType1[CardType1["plus2"] = 1] = "plus2";
    CardType1[CardType1["reverse"] = 2] = "reverse";
    CardType1[CardType1["skip"] = 3] = "skip";
    CardType1[CardType1["plus4"] = 4] = "plus4";
    CardType1[CardType1["colorSwitch"] = 5] = "colorSwitch";
})(CardType || (CardType = {
}));
const colorFn = (color, str1)=>{
    if (str1 === '') str1 = ' ';
    switch(color){
        case CardColor.yellow:
            return colors1.bgWhite.yellow.underline(str1);
        case CardColor.red:
            return colors1.bgWhite.red.underline(str1);
        case CardColor.blue:
            return colors1.bgWhite.blue.underline(str1);
        case CardColor.green:
            return colors1.bgWhite.green.underline(str1);
        case CardColor.all:
            return colors1.bgBlack.white.underline(str1);
        default:
            return '';
    }
};
class Card {
    color;
    type;
    constructor(type4, color1){
        this.type = type4;
        this.color = color1;
    }
    toColorString(color) {
        const _color = color ?? this.color;
        return colorFn(_color, this.toString());
    }
}
class NumberCard extends Card {
    value;
    constructor(value4, color2){
        super(CardType.number, color2);
        this.value = value4;
    }
    toString() {
        return `Number[${this.value}]`;
    }
    judge(card, color) {
        if (!card) return true;
        if (this.color === card.color) {
            return true;
        }
        if (card instanceof NumberCard && this.value === card.value) {
            return true;
        }
        if (card.color === CardColor.all && color === this.color) {
            return true;
        }
        return false;
    }
}
class Plus2Card extends Card {
    constructor(color3){
        super(CardType.plus2, color3);
    }
    toString() {
        return "Draw Two (+2)";
    }
    judge(card, color) {
        if (!card) return true;
        if (card instanceof Plus2Card) return true;
        if (card.color === CardColor.all && color === this.color) {
            return true;
        }
        return this.color === card.color;
    }
}
class ReverseCard extends Card {
    constructor(color4){
        super(CardType.reverse, color4);
    }
    toString() {
        return "Reverse";
    }
    judge(card, color) {
        if (!card) return true;
        if (card instanceof ReverseCard) return true;
        if (card.color === CardColor.all && color === this.color) {
            return true;
        }
        return this.color === card.color;
    }
}
class SkipCard extends Card {
    constructor(color5){
        super(CardType.skip, color5);
    }
    toString() {
        return `Skip`;
    }
    judge(card, color) {
        if (!card) return true;
        if (card instanceof SkipCard) return true;
        if (card.color === CardColor.all && color === this.color) {
            return true;
        }
        return this.color === card.color;
    }
}
class ColorSwitchCard extends Card {
    constructor(){
        super(CardType.colorSwitch, CardColor.all);
    }
    toString() {
        return `Wild`;
    }
    judge() {
        return true;
    }
}
class Plus4Card extends Card {
    constructor(){
        super(CardType.plus4, CardColor.all);
    }
    toString() {
        return "Wild Draw Four (+4)";
    }
    judge() {
        return true;
    }
}
var MyEvent;
(function(MyEvent1) {
    MyEvent1[MyEvent1["Login"] = 0] = "Login";
    MyEvent1[MyEvent1["ChangeNick"] = 1] = "ChangeNick";
    MyEvent1[MyEvent1["OnlineNum"] = 2] = "OnlineNum";
    MyEvent1[MyEvent1["CreateRoom"] = 3] = "CreateRoom";
    MyEvent1[MyEvent1["GetRoomList"] = 4] = "GetRoomList";
    MyEvent1[MyEvent1["JoinRoom"] = 5] = "JoinRoom";
    MyEvent1[MyEvent1["Ready"] = 6] = "Ready";
    MyEvent1[MyEvent1["ExitRoom"] = 7] = "ExitRoom";
    MyEvent1[MyEvent1["PlayCard"] = 8] = "PlayCard";
    MyEvent1[MyEvent1["DrawCard"] = 9] = "DrawCard";
    MyEvent1[MyEvent1["PlayerJoinRoom"] = 10] = "PlayerJoinRoom";
    MyEvent1[MyEvent1["PlayerExitRoom"] = 11] = "PlayerExitRoom";
    MyEvent1[MyEvent1["GameStateChange"] = 12] = "GameStateChange";
    MyEvent1[MyEvent1["GameMeta"] = 13] = "GameMeta";
    MyEvent1[MyEvent1["RoomUserState"] = 14] = "RoomUserState";
})(MyEvent || (MyEvent = {
}));
var UserState;
(function(UserState1) {
    UserState1[UserState1["Online"] = 0] = "Online";
    UserState1[UserState1["Ready"] = 1] = "Ready";
    UserState1[UserState1["Leave"] = 2] = "Leave";
    UserState1[UserState1["Offline"] = 3] = "Offline";
})(UserState || (UserState = {
}));
var GameState;
(function(GameState1) {
    GameState1[GameState1["Ready"] = 0] = "Ready";
    GameState1[GameState1["Start"] = 1] = "Start";
    GameState1[GameState1["End"] = 2] = "End";
})(GameState || (GameState = {
}));
class PM {
    cardRecord = {
        [CardType.number]: 0,
        [CardType.plus2]: 20,
        [CardType.reverse]: 20,
        [CardType.skip]: 20,
        [CardType.plus4]: 50,
        [CardType.colorSwitch]: 50
    };
    colors = [
        CardColor.blue,
        CardColor.green,
        CardColor.red,
        CardColor.yellow, 
    ];
    DEAL_COUNT = 7;
    players;
    leavePlayers = {
    };
    cards;
    get cardNum() {
        return this.cards.length;
    }
    roomid;
    turn;
    turnPlayerId;
    clockwise;
    currentColor;
    currentValue = -1;
    currentPlus = 0;
    lastCard = null;
    life;
    get playerCount() {
        return Object.keys(this.players).length;
    }
    constructor(roomid1, player){
        this.roomid = roomid1;
        this.players = {
        };
        const playerKeys = Object.keys(player);
        playerKeys.forEach((key2)=>this.players[key2] = []
        );
        this.cards = this.getInitialCard();
        this.cards = this.shuffle();
        this.dealCards();
        this.turn = 0;
        this.turnPlayerId = playerKeys[0];
        this.clockwise = true;
        this.currentColor = CardColor.all;
        this.life = true;
    }
    calCardScore(cards) {
        let score = 0, num;
        for (const card of cards){
            if (card instanceof NumberCard) {
                num = card.value;
            } else {
                num = this.cardRecord[card.type];
            }
            score += num;
        }
        return score;
    }
    getInitialCard() {
        const cards = [];
        const colors2 = this.colors;
        function makeGroup(callback) {
            const arr = [], len = colors2.length;
            let item;
            for(let i1 = 0; i1 < len; i1++){
                item = callback(colors2[i1]);
                if (Array.isArray(item)) {
                    arr.push(...item);
                } else {
                    arr.push(item);
                }
            }
            return arr;
        }
        const cardNum0 = makeGroup(function(color6) {
            return new NumberCard(0, color6);
        });
        const cardNum1to9 = makeGroup(function(color6) {
            const arr = [];
            for(let i1 = 1; i1 <= 9; ++i1){
                arr.push(new NumberCard(i1, color6));
                arr.push(new NumberCard(i1, color6));
            }
            return arr;
        });
        const cardFn = makeGroup(function(color6) {
            const arr = [];
            for(let i1 = 0; i1 < 2; ++i1){
                arr.push(...[
                    new Plus2Card(color6),
                    new ReverseCard(color6),
                    new SkipCard(color6), 
                ]);
            }
            return arr;
        });
        const cardHigh = function() {
            const arr = [];
            for(let i1 = 0; i1 < 4; ++i1){
                arr.push(new ColorSwitchCard());
                arr.push(new Plus4Card());
            }
            return arr;
        }();
        cards.push(...cardNum0, ...cardNum1to9, ...cardFn, ...cardHigh);
        return cards;
    }
    shuffle() {
        const arr = this.cards;
        let i1 = arr.length;
        while(i1){
            const j = Math.floor(Math.random() * i1--);
            [arr[j], arr[i1]] = [
                arr[i1],
                arr[j]
            ];
        }
        return arr.slice(0, 16);
    }
    dealCards() {
        const playersCardsList = Object.keys(this.players).map((k)=>this.players[k]
        );
        const len = playersCardsList.length, maxCountPer = this.DEAL_COUNT * len, cardNum = this.cardNum;
        let currIdx = 0;
        for(let i1 = 0; i1 < maxCountPer && i1 < cardNum; i1++){
            const card = this.cards.pop();
            playersCardsList[currIdx++].push(card);
            if (currIdx >= len) {
                currIdx = 0;
            }
        }
    }
    getTurnPlayerId() {
        return Object.keys(this.players)[this.turn];
    }
    get leavePlayerCount() {
        return Object.keys(this.leavePlayers).filter((key2)=>this.leavePlayers[key2]
        ).length;
    }
    onUserLeave(sockid) {
        this.leavePlayers[sockid] = true;
        if (this.turnPlayerId === sockid && this.life) {
            this.nextTurn();
            Object.keys(this.players).forEach((id)=>{
                if (!this.leavePlayers[id]) {
                    Connection.sendTo(MyEvent.GameMeta, id, {
                        turn: this.turnPlayerId
                    });
                }
            });
        }
        return true;
    }
    onGameOver(winner) {
        this.life = false;
        const scoreMap = {
        };
        let min = Number.MAX_SAFE_INTEGER, _winner = winner ?? '';
        Object.keys(this.players).forEach((key2)=>{
            const cards = this.players[key2];
            const score = this.calCardScore(cards);
            scoreMap[key2] = score;
            if (!_winner && min > score) {
                min = score, _winner = key2;
            }
        });
        Object.keys(this.players).forEach((id)=>{
            if (!this.leavePlayers[id]) {
                Connection.sendTo(MyEvent.GameMeta, id, {
                    playerPoint: scoreMap,
                    turn: ''
                });
            }
        });
        Rooms.setRoom(this.roomid, {
            status: GameState.Ready
        });
        return _winner;
    }
    playCard(uid, index, color) {
        const cards = this.players[uid];
        if (!cards) return false;
        const card = cards[index];
        if (!card) return false;
        const ret = card.judge(this.lastCard, this.currentColor);
        if (!ret) return false;
        cards.splice(index, 1);
        if (card instanceof NumberCard) {
            this.currentValue = card.value;
        } else if (card instanceof ReverseCard) {
            this.clockwise = !this.clockwise;
        } else if (card instanceof Plus2Card) {
            this.currentPlus += 2;
        } else if (card instanceof Plus4Card) {
            this.currentPlus += 4;
        } else if (card instanceof SkipCard) {
        }
        this.currentColor = color === void 0 ? card.color : color;
        this.nextTurn(1);
        this.lastCard = card;
        return true;
    }
    nextTurn(step = 1) {
        if (!this.clockwise) step = -step;
        let nextTurn = this.turn + step;
        const lenth = this.playerCount;
        if (nextTurn >= lenth) nextTurn = nextTurn % lenth;
        else if (nextTurn < 0) nextTurn = lenth + nextTurn;
        console.log('[turn]', nextTurn);
        this.turn = nextTurn;
        const turnId = this.getTurnPlayerId();
        this.turnPlayerId = turnId;
        this.leavePlayers[turnId] && this.nextTurn(1);
    }
    drawCard(sid) {
        const cards = this.players[sid];
        if (!cards) return false;
        if (this.cardNum <= 0) return false;
        let num = 1;
        if (this.currentPlus !== 0) {
            num = this.currentPlus;
            this.currentPlus = 0;
        }
        const newCards = this.cards.splice(this.cards.length - 1 - num, num);
        cards.push(...newCards);
        this.nextTurn();
        return true;
    }
}
class Logger {
    static log = (...args3)=>{
        console.log(...args3);
    };
    static error = (...args3)=>{
        console.error(...args3);
    };
}
const devConf = {
    addr: 'localhost:20210'
};
class User {
    _name;
    constructor(name19){
        this._name = name19;
    }
    setName(name) {
        this._name = name;
    }
    get name() {
        return this._name;
    }
}
class PlayerCollection {
    static _data = {
    };
    static get playerCount() {
        return Object.keys(this._data).length;
    }
    static add(id, data) {
        this._data[id] = data;
        return true;
    }
    static set(id, data) {
        if (this._data[id]) {
            Object.assign(this._data[id], data);
            return true;
        } else {
            return false;
        }
    }
    static get(id, field) {
        const target = this._data[id];
        if (!target) return null;
        else return field ? target[field] : this._data[id];
    }
    static del(id) {
        delete this._data[id];
    }
    static joinRoom(sockid, roomid, pwd) {
        const oldRoomid = PlayerCollection.get(sockid, 'roomid');
        if (oldRoomid && oldRoomid != roomid && Rooms.playerInThisRoom(oldRoomid, sockid)) {
            return false;
        }
        const room = Rooms.getRoom(roomid);
        if (!room) {
            return false;
        }
        if (room.status === GameState.Start) {
            return false;
        }
        if (room.pwd && room._pwd !== pwd) {
            return false;
        }
        if (room.count >= room.max) {
            return false;
        }
        PlayerCollection.set(sockid, {
            roomid: room.id
        });
        Rooms.broadcastJoin(sockid, room);
        return true;
    }
    static exitRoom(sockid) {
        const roomid2 = PlayerCollection.get(sockid, 'roomid');
        if (!roomid2) {
            return;
        }
        PlayerCollection.set(sockid, {
            roomid: null
        });
        Rooms.broadcastExit(roomid2, sockid);
        const room = Rooms.getRoom(roomid2), players = Rooms.getRoomPlayers(roomid2);
        if (room && players) {
            const len = Object.keys(players).length;
            room.count = len;
            if (len === 0) {
                Rooms.del(roomid2);
            }
        }
    }
}
class Rooms {
    static _roomList = [];
    static _roomPlayer = {
    };
    static _gameProcess = {
    };
    static get roomCount() {
        return this._roomList.length;
    }
    static add(roomData) {
        const roomid2 = roomData.id;
        this._roomList.push(roomData);
        this._roomPlayer[roomid2] = {
        };
    }
    static getRoom(roomid) {
        return this._roomList.find((x)=>x.id === roomid
        );
    }
    static getList(no, num) {
        const start = (no - 1) * num;
        return {
            list: this._roomList.slice(start, start + num).map((itm)=>({
                    ...itm,
                    _pwd: void 0
                })
            ),
            no,
            max: Math.ceil(this._roomList.length / no)
        };
    }
    static getRoomPlayers(roomid) {
        return this._roomPlayer[roomid];
    }
    static getRoomPlayer(roomid, sockid) {
        return this.getRoomPlayers(roomid)?.[sockid];
    }
    static getGameProcess(sockid) {
        return this._gameProcess[sockid] || null;
    }
    static playerInThisRoom(sockid, roomid) {
        return !!this.getRoomPlayers(roomid)?.[sockid];
    }
    static setRoom(roomid, data) {
        let room;
        if (typeof roomid === 'string') {
            room = this.getRoom(roomid);
        } else {
            room = roomid;
        }
        if (!room) return false;
        Object.assign(room, data);
        return true;
    }
    static del(roomid) {
        const idx = this._roomList.findIndex((x)=>x.id === roomid
        );
        if (idx === -1) return false;
        this._roomList.splice(idx, 1);
        delete this._roomPlayer[roomid];
        delete this._gameProcess[roomid];
    }
    static roomBroadcast(roomid, option) {
        const rp = this._roomPlayer[roomid];
        if (!rp) return;
        option.before?.(rp);
        Object.keys(rp).forEach((sid)=>{
            const data = rp[sid];
            data && option.callback(sid, data);
        });
        option.after?.(rp);
        return rp;
    }
    static broadcastJoin(id, roomData) {
        let len, playerData;
        const roomid2 = roomData.id;
        this.roomBroadcast(roomid2, {
            before: (data)=>{
                len = Object.keys(data).length + 1;
                playerData = PlayerCollection.get(id);
            },
            callback: (sid)=>{
                playerData && Connection.sendTo(MyEvent.PlayerJoinRoom, sid, {
                    playerData: playerData,
                    roomData: {
                        count: len
                    }
                });
            },
            after: (data)=>{
                if (playerData) {
                    data[id] = playerData;
                    roomData && (roomData.count = Object.keys(data).length);
                    Logger.log('[join room]', roomid2);
                }
            }
        });
    }
    static broadcastExit(roomid, sockid) {
        let len;
        return this.roomBroadcast(roomid, {
            before: (data)=>{
                delete data[sockid];
                len = Object.keys(data).length;
            },
            callback: (sid)=>{
                Connection.sendTo(MyEvent.PlayerExitRoom, sid, {
                    playerData: {
                        _sockid: sockid
                    },
                    roomData: {
                        count: len
                    }
                });
            },
            after: (datas)=>{
                const pm = this.getGameProcess(roomid), keys = Object.keys(datas);
                if (keys.length === 1 && pm?.life) {
                    const winner = keys[0];
                    pm.onGameOver(winner);
                    Connection.sendTo(MyEvent.GameMeta, winner, {
                        winner,
                        gameStatus: GameState.End
                    });
                }
                pm?.onUserLeave(sockid);
            }
        });
    }
    static roomStart(roomid, players) {
        Rooms.setRoom(roomid, {
            status: GameState.Start
        });
        const pm = new PM(roomid, players);
        this._gameProcess[roomid] = pm;
        this.roomBroadcast(roomid, {
            callback: (sid)=>{
                const data = {
                    cards: pm.players[sid],
                    color: pm.currentColor,
                    turn: Object.keys(pm.players)[pm.turn],
                    clockwise: pm.clockwise,
                    cardNum: pm.cardNum,
                    gameStatus: GameState.Start,
                    playersCardsNum: Object.keys(pm.players).reduce((p, cur)=>{
                        p[cur] = pm.players[cur].length;
                        return p;
                    }, {
                    })
                };
                console.log(data);
                Connection.sendTo(MyEvent.GameMeta, sid, data);
            }
        });
    }
}
class cardStack {
    cards;
    constructor(arr){
        this.cards = arr;
    }
    draw() {
        return this.cards.pop();
    }
}
const prodConf = {
    addr: '101.34.48.12:20210'
};
const defaultConf = {
    isDev: false,
    serverPort: '20210'
};
const Constant = Object.assign(defaultConf, defaultConf.isDev ? devConf : prodConf);
const playerUser = new User('nick');
const ServerConf = {
    maxRoom: 100,
    maxPlayer: 1000,
    sv: 1,
    onlineBroadcast: true
};
function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
    var desc = {
    };
    Object.keys(descriptor).forEach(function(key2) {
        desc[key2] = descriptor[key2];
    });
    desc.enumerable = !!desc.enumerable;
    desc.configurable = !!desc.configurable;
    if ("value" in desc || desc.initializer) {
        desc.writable = true;
    }
    desc = decorators.slice().reverse().reduce(function(desc, decorator) {
        return decorator(target, property, desc) || desc;
    }, desc);
    if (context && desc.initializer !== void 0) {
        desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
        desc.initializer = undefined;
    }
    if (desc.initializer === void 0) {
        Object.defineProperty(target, property, desc);
        desc = null;
    }
    return desc;
}
var _class, _dec, _dec1, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8;
const map = {
};
function Event1(event) {
    return (target, propertyKey)=>{
        const func = Reflect.get(target, propertyKey);
        map[event] = func;
    };
}
let EventRouter = ((_class = class EventRouter1 {
    sid;
    sock;
    constructor(id, sock){
        this.sid = id;
        this.sock = sock;
    }
    response(func, data) {
        this.sock.send(JSON.stringify({
            func,
            data
        }));
    }
    handle(req) {
        const { func , data  } = req;
        const executor = map[func];
        executor.call(this, data);
    }
    login(data) {
        let succ = true, reason;
        if (data.cv != ServerConf.sv) {
            succ = false;
            reason = 'version';
        }
        if (PlayerCollection.playerCount >= ServerConf.maxPlayer) {
            succ = false;
            reason = 'count_limit';
        }
        if (succ) {
            Logger.log(`[login]`, data.nick);
            succ = PlayerCollection.add(this.sid, {
                nick: data.nick,
                status: UserState.Online,
                _sockid: this.sid
            });
        }
        this.response(MyEvent.Login, {
            succ,
            userId: this.sid,
            reason
        });
    }
    changeNick(data) {
        const succ = PlayerCollection.set(this.sid, {
            nick: data
        });
        this.response(MyEvent.ChangeNick, {
            succ
        });
    }
    getRoomList(data) {
        const list = Rooms.getList(data.no, data.num);
        this.response(MyEvent.GetRoomList, list);
    }
    createRoom(data) {
        let succ = true;
        const id1 = mod1.generate();
        if (Rooms.roomCount > ServerConf.maxRoom) {
            succ = false;
        } else {
            Rooms.add({
                ...data,
                id: id1,
                createTime: Date.now(),
                count: 0,
                ownerId: this.sid,
                status: GameState.Ready,
                pwd: !!data._pwd
            });
        }
        this.response(MyEvent.CreateRoom, {
            succ,
            roomid: id1
        });
    }
    joinRoom(data) {
        const succ = PlayerCollection.joinRoom(this.sid, data.id, data.pwd);
        if (!succ) {
            this.response(MyEvent.JoinRoom, {
                succ
            });
        } else {
            this.response(MyEvent.JoinRoom, {
                succ,
                players: Rooms.getRoomPlayers(data.id),
                roomData: Rooms.getRoom(data.id)
            });
        }
    }
    exitRoom() {
        PlayerCollection.exitRoom(this.sid);
    }
    ready() {
        const roomid2 = PlayerCollection.get(this.sid, 'roomid');
        let succ = true;
        if (roomid2) {
            const player1 = Rooms.getRoomPlayer(roomid2, this.sid);
            if (player1) {
                player1.status = UserState.Ready;
                Rooms.roomBroadcast(roomid2, {
                    callback (sid) {
                        Connection.sendTo(MyEvent.RoomUserState, sid, [
                            player1._sockid,
                            player1.status
                        ]);
                    },
                    after (datas) {
                        const roomData = Rooms.getRoom(roomid2);
                        if (!roomData) return;
                        if (roomData.count !== roomData.max) return;
                        const everybodyReady = Object.keys(datas).every((key2)=>datas[key2].status === UserState.Ready
                        );
                        everybodyReady && Rooms.roomStart(roomid2, datas);
                    }
                });
            } else {
                succ = false;
            }
        } else {
            succ = false;
        }
        this.response(MyEvent.Ready, {
            succ
        });
    }
    playcard(data) {
        const { index , color: color6  } = data;
        const roomid2 = PlayerCollection.get(this.sid, 'roomid');
        if (!roomid2) {
            return;
        }
        const pm = Rooms.getGameProcess(roomid2);
        const succ = pm?.playCard(this.sid, index, color6) ?? false;
        this.response(MyEvent.PlayCard, {
            succ
        });
        if (succ && pm) {
            this._afterPlaySucc(roomid2, pm);
        }
    }
    _afterPlaySucc(roomid, pm) {
        const cardNum = pm.players[this.sid].length;
        const winner = cardNum === 0 ? this.sid : void 0;
        Rooms.roomBroadcast(roomid, {
            before: ()=>{
                winner && pm.onGameOver(winner);
            },
            callback: (sid)=>{
                Connection.sendTo(MyEvent.GameMeta, sid, {
                    turn: pm.turnPlayerId,
                    clockwise: pm.clockwise,
                    color: pm.currentColor,
                    plus: pm.currentPlus,
                    cardNum: pm.cardNum,
                    lastCard: pm.lastCard,
                    cards: sid === this.sid ? pm.players[this.sid] : void 0,
                    playersCardsNum: {
                        [this.sid]: cardNum
                    },
                    gameStatus: winner ? GameState.End : void 0,
                    winner
                });
                winner && PlayerCollection.set(sid, {
                    status: UserState.Online
                }) && Connection.sendTo(MyEvent.RoomUserState, sid, [
                    sid,
                    UserState.Online
                ]);
            }
        });
    }
    drawcard() {
        const roomid2 = PlayerCollection.get(this.sid, 'roomid');
        if (!roomid2) return;
        const pm = Rooms.getGameProcess(roomid2);
        if (!pm) return;
        const succ = pm.drawCard(this.sid) ?? [
            false
        ];
        this.response(MyEvent.DrawCard, {
            succ
        });
        if (succ && pm) {
            const isEnd = pm.cardNum === 0;
            let winner;
            if (isEnd) {
                winner = pm.onGameOver(void 0);
            }
            Rooms.roomBroadcast(roomid2, {
                callback: (otherId)=>{
                    Connection.sendTo(MyEvent.GameMeta, otherId, {
                        cards: otherId === this.sid ? pm.players[this.sid] : void 0,
                        cardNum: pm.cardNum,
                        plus: pm.currentPlus,
                        lastCard: pm.lastCard,
                        color: pm.currentColor,
                        turn: pm.turnPlayerId,
                        playersCardsNum: {
                            [this.sid]: pm.players[this.sid].length
                        },
                        winner,
                        gameStatus: isEnd ? GameState.End : void 0
                    });
                }
            });
        }
    }
}) || _class, _dec = Event1(MyEvent.Login), _applyDecoratedDescriptor(_class.prototype, "login", [
    _dec
], Object.getOwnPropertyDescriptor(_class.prototype, "login"), _class.prototype), _dec1 = Event1(MyEvent.ChangeNick), _applyDecoratedDescriptor(_class.prototype, "changeNick", [
    _dec1
], Object.getOwnPropertyDescriptor(_class.prototype, "changeNick"), _class.prototype), _dec2 = Event1(MyEvent.GetRoomList), _applyDecoratedDescriptor(_class.prototype, "getRoomList", [
    _dec2
], Object.getOwnPropertyDescriptor(_class.prototype, "getRoomList"), _class.prototype), _dec3 = Event1(MyEvent.CreateRoom), _applyDecoratedDescriptor(_class.prototype, "createRoom", [
    _dec3
], Object.getOwnPropertyDescriptor(_class.prototype, "createRoom"), _class.prototype), _dec4 = Event1(MyEvent.JoinRoom), _applyDecoratedDescriptor(_class.prototype, "joinRoom", [
    _dec4
], Object.getOwnPropertyDescriptor(_class.prototype, "joinRoom"), _class.prototype), _dec5 = Event1(MyEvent.ExitRoom), _applyDecoratedDescriptor(_class.prototype, "exitRoom", [
    _dec5
], Object.getOwnPropertyDescriptor(_class.prototype, "exitRoom"), _class.prototype), _dec6 = Event1(MyEvent.Ready), _applyDecoratedDescriptor(_class.prototype, "ready", [
    _dec6
], Object.getOwnPropertyDescriptor(_class.prototype, "ready"), _class.prototype), _dec7 = Event1(MyEvent.PlayCard), _applyDecoratedDescriptor(_class.prototype, "playcard", [
    _dec7
], Object.getOwnPropertyDescriptor(_class.prototype, "playcard"), _class.prototype), _dec8 = Event1(MyEvent.DrawCard), _applyDecoratedDescriptor(_class.prototype, "drawcard", [
    _dec8
], Object.getOwnPropertyDescriptor(_class.prototype, "drawcard"), _class.prototype), _class);
const importMeta = {
    url: "file:///C:/D/Pro/deno-uno/server/server.ts",
    main: import.meta.main
};
async function handleWs1(sock1) {
    Logger.log("socket connected!");
    const sockid = mod1.generate();
    Connection.add(sockid, sock1);
    const router = new EventRouter(sockid, sock1);
    try {
        for await (const ev of sock1){
            if (isWebSocketCloseEvent(ev)) {
                const { code: code2 , reason  } = ev;
                Logger.log("[ws::close]", code2, reason);
                break;
            }
            if (typeof ev === "string") {
                if (ev[0] === '0') {
                    const sendTime = parseInt(ev.slice(2));
                    const ping = Date.now() - (isNaN(sendTime) ? 0 : sendTime);
                    PlayerCollection.set(sockid, {
                        ping: ping
                    });
                    sock1.send(`1`);
                } else {
                    const req = JSON.parse(ev);
                    try {
                        router.handle(req);
                    } catch (e) {
                        console.error(e);
                    }
                }
            }
        }
        Connection.del(sockid);
    } catch (err) {
        Logger.error(`failed to receive frame: ${err}`);
        if (!sock1.isClosed) {
            await sock1.close(1000).catch(Logger.error);
        }
    }
}
async function runServer1(port = Constant.serverPort) {
    Logger.log(`websocket server is running on :${port}`);
    const conn1 = serve(`:${port}`);
    for await (const req of conn1){
        const { conn: conn2 , r: bufReader1 , w: bufWriter1 , headers  } = req;
        acceptWebSocket({
            conn: conn2,
            bufReader: bufReader1,
            bufWriter: bufWriter1,
            headers
        }).then(handleWs1).catch(async (err)=>{
            Logger.error(`failed to accept websocket: ${err}`);
            await req.respond({
                status: 400
            });
        });
    }
}
if (importMeta.main) {
    runServer1(Deno.args[0]);
}
export { handleWs1 as handleWs };
export { runServer1 as runServer };
