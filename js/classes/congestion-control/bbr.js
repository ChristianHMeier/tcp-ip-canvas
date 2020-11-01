import CongestionControl from './congestion-control.js';
import Packet from '../packet.js';

export default class BBR extends CongestionControl {
    constructor(endToEnd, timeout, bandwidth, draw) { //, appLimit) {
        super(endToEnd, timeout, bandwidth, draw);
        this.appLimit = null; // appLimit;
        this.roundTripPropFilter = null;
        this.delivered = 0;
        this.deliveryRate = null;
        this.btlBwFilter = 0;
        this.nextSendTime = null;
        this.congestionWindowGain = 1;
        this.pacingGainCycle = [1.25, 0.75, 1, 1, 1, 1, 1, 1];
        this.pacingGainIndex = 0;
        this.lossRepairs = 0;
        this.bdp = 0;
        this.resetX = null;
        this.repairing3ACKs = false;
    }
    onACK(packet, index) {
        super.onACK(packet, index);
        const deliveredTime = Date.now();
        const rtt = deliveredTime - packet.sentTime;
        this.roundTripPropFilter = this.updateRTT(rtt);
        this.delivered++; // packets assumed to be of size 1 for demonstration purposes
        this.deliveryRate = this.delivered / rtt; // (delivered - packet.delivered) / (delivered_time - packet.delivered_time) in the original algorithm, reduced due to fixed size 1
        if (this.deliveryRate > this.btlBwFilter) { // || !packet.appLimited) {
            this.btlBwFilter = this.deliveryRate; //update_max_filter in the original algorithm
        }
        if (this.nextSendTime === null) {
            this.nextSendTime = Date.now();
        }
        if (packet.dupIndex !== null) {
            this.duplicateACKIndex = this.duplicateACKIndex !== null ? this.duplicateACKIndex : packet.dupIndex; 
            this.duplicateACKsCount++;
        }
        if (this.repairing3ACKs && packet.position.x === this.resetX) {
            this.resetX = null;
            this.repairing3ACKs = false;
        }
        if (this.duplicateACKsCount < 3) { // (index === this.packets.length - 1 && this.duplicateACKsCount === 0) {
            this.startIndex++;
            const ceiling = Math.min(this.bandwidth, this.appLimit);
            if (this.congestionWindow >= ceiling) {
                this.updateSlowStartThreshold();
                this.congestionWindow = this.slowStartThreshold 
            } else if (this.congestionWindow < ceiling) { // increase if there is room for growth
                this.windowIncrease(this.congestionWindow + 1);
            }
            this.packets.splice(0, 1);
        } else if (this.duplicateACKsCount === 3 && !this.repairing3ACKs) {
            this.on3Acks(index);
        }

    }
    onSend() {
        super.onSend();
        this.bdp = this.btlBwFilter * this.roundTripPropFilter; 
        const inflight = this.packets.length;
        const now = Date.now();
        const ceiling = Math.min(this.bandwidth, this.appLimit);
        if (this.congestionWindow > ceiling) {
            return
        }
        if (inflight < this.congestionWindow) {
            if (inflight > this.congestionWindowGain * this.bdp) {
                // wait for ack or retransmission timeout
                return;
            }
            if (now >= this.nextSendTime || this.packets.length === 0) {
                const packetX = this.resetX === null && !this.repairing3ACKs ? (this.packets.length + this.startIndex) * (this.packetWidth + 4) : this.resetX;
                if (this.resetX !== null && !this.repairing3ACKs) {
                    this.resetX = null;
                    this.lossRepairs = 0;
                }
                const packet = new Packet(packetX, 2, this.appLimit < inflight) // nextPacketToSend() in the original algorithm
                if (packet.appLimited) {
                    return;
                }
                this.pacingGainIndex = this.pacingGainIndex < 7 ? this.pacingGainIndex + 1 : 0;
                this.packets.push(packet);
                this.nextSendTime = now + 1 / (this.pacingGainCycle[this.pacingGainIndex] * this.btlBwFilter) // packet.size = 1
                this.timerReset = true;
            }
            // timerCallbackAt(send, nextSendTime), is handled by update() in this representation
        }
    }
    onTimeout() {
        super.onTimeout();
        this.packets.splice(0);
        this.duplicateACKIndex = null;
        this.duplicateACKsCount = 0;
        if (this.congestionWindow > 1) {
            this.windowDecrease(1);
        }
        this.lossRepairs = 0;
    }
    on3Acks(index) {
        super.on3Acks(index);
        this.resetX = this.packets[index].position.x - 2 * (this.packetWidth + 4); // reset horizontal position to where the lost packet was
        this.packets.splice(0, index + 1);
        this.packets.forEach((packet) => { packet.dupIndex = null; }); // prevent subsequent false flag 3ACKs
        this.lossRepairs++;
        if (this.lossRepairs > 1) {
            this.updateSlowStartThreshold();
        }
        // get current rate of inflight packets and reduce cwnd to that value,  on second and later rounds of loss repair it ensures the sending rate never exceeds twice the current delivery rate
        const decrease = this.packets.length;
        this.windowDecrease(decrease);
        this.duplicateACKIndex = null;
        this.duplicateACKsCount = 0;
    }
    updateSlowStartThreshold() {
        super.updateSlowStartThreshold();
        this.slowStartThreshold = Math.floor(this.congestionWindow / 2);
        if (this.slowStartThreshold === 0) {
            this.slowStartThreshold++;
        }
    }
    customFields() {
        super.customFields()
        return [{'id': 'appLimit', 'type': 'number', 'min': '1', 'max': '32', 'step': '1', 'value': '8'}];
    }
    windowDecrease(decreaseValue) {
        super.windowDecrease(decreaseValue);
    }
    windowIncrease(increaseValue) {
        super.windowIncrease(increaseValue);
    }
    update() {
        super.update();
    }
    updateRTT(rtt) {
        return this.roundTripPropFilter !== null ? Math.min(this.roundTripPropFilter, rtt) : rtt;
    }
}
