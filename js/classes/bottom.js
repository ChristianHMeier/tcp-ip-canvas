import Position from './position.js';

export default class BottomNode {
    constructor(x) {
        this.position = new Position(x, 368);
        this.timedOut = false;
        this.received = false
    }
}
