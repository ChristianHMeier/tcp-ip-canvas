import Packet from '../packet.js';

export default class CongestionControl {
    constructor(endToEnd, timeout, bandwidth, draw) {
        this.packetWidth = 16;
        this.packets = [];
        this.packets[0] = new Packet(0, 0, false);
        this.startIndex = 0;
        this.endToEnd = endToEnd;
        this.timeout = timeout;
        this.bandwidth = bandwidth;
        this.duplicateACKIndex = null;
        this.duplicateACKsCount = 0;
        this.congestionWindow = 1;
        this.slowStartThreshold = null;
        this.draw = draw;
        this.timerReset = false;
    }
    onACK(packet, index) {
        // Pure method definition, child classes must implement it to reflect their respective algorithm
    }
    onSend() {
        // Pure method definition, child classes must implement it to reflect their respective algorithm
    }
    onTimeout() {
        // Pure method definition, child classes must implement it to reflect their respective algorithm
    }
    on3Acks(index) {
        // Pure method definition, child classes must implement it to reflect their respective algorithm
    }
    updateSlowStartThreshold() {
        // Pure method definition, child classes must implement it to reflect their respective algorithm
    }
    customFields() {
        // Pure method definition, child classes with custom fields must rerurn an array of objects representing the type of input that will be built with it, those without must return null
    }
    windowDecrease(decreaseValue) {
        this.congestionWindow = decreaseValue;
    }
    windowIncrease(increaseValue) {
        this.congestionWindow = increaseValue;
    }
    update() {
        this.onSend();
        this.packets.forEach(packet => {
            let move = 6*732/this.endToEnd;
            packet.transitTime += 6;
            if (packet.lost || packet.acknowledged) {
                return
            }
            if (packet.received)
            {
                move = -1*move;
            }
            packet.position.y += move;
        });
        this.draw();
    }
}
