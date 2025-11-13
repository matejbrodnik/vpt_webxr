export const Ticker = (() => {

let queue = [];
let _session = null;
let requestID = null;
let _gl = null;

function tick(time, frame) {
    if(_gl) {
        console.log("tick", _gl.getError());
    }
    queue.forEach(f => (f.length ? f(time, frame) : f()));
    if(_gl) {
        console.log("tick2", _gl.getError());
    }
    requestID = _session.requestAnimationFrame(tick);
};

function start(session, gl = null) {
    _gl = gl;
    _session = session;
    _session.requestAnimationFrame(tick);
    if(_gl) {
        console.log("start", _gl.getError());
    }
}

function add(f) {
    if (!queue.includes(f)) {
        queue.push(f);
    }
    console.log("added")
}

function remove(f) {
    const idx = queue.indexOf(f);
    if (idx >= 0) {
        queue.splice(idx, 1);
    }
}

function reset() {
    console.log("reset")
    queue = [];
    _session.cancelAnimationFrame(requestID);
}

return { add, remove, start, reset };

})();
