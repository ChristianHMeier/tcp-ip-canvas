import Position from './position.js';

export default class TopNode {
    constructor(x) {
        this.position = new Position(x, 2);
        this.confirmed = false;
        this.timedOut = false;
    }
}
