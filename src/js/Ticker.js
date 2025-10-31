export const Ticker = (() => {

let queue = [];
let _session = null;

function tick(time, frame) {
    queue.forEach(f => f());
    _session.requestAnimationFrame(tick);
};

function start(session) {
    _session = session;
    _session.requestAnimationFrame(tick);
}

function add(f) {
    if (!queue.includes(f)) {
        queue.push(f);
    }
}

function remove(f) {
    const idx = queue.indexOf(f);
    if (idx >= 0) {
        queue.splice(idx, 1);
    }
}

return { add, remove, start };

})();
