import Position from './position.js';

export default class Packet {
    constructor(x, y, appLimited) {
        this.position = new Position(x, y);
        this.acknowledged = false;
        this.received = false;
        this.lost = false;
        this.transitTime = 0;
        this.dupIndex = null;
        this.sentTime = Date.now();
        this.appLimited = appLimited;
    }
}
