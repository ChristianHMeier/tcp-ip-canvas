import BottomNode from './classes/bottom.js';
import TopNode from './classes/top.js';

import algorithms from './classes/congestion-control/index.js'
import Timer from './classes/timer.js';

let algorithmList = algorithms;
let congestionControl = null;
let ctx;
let canvasWidth;
let canvasHeight;
let canvasX;
let canvasY;
let canvasPaddingX;
let canvasPaddingY;
const packetWidth = 16;
const packetHeight = 30;
let topPacketRow = [];
let lowPacketRow = [];
var isScrolling;
let scrollDecrease;
let bandX = 0;
let bandLength;
const startX = 12;
let interval = null;
let pause = null;
let allowPause = false;
let timer = null;

document.addEventListener("DOMContentLoaded", function()
{
   algorithmList.forEach(algorithm => {
       let node = document.createElement("option");
       node.setAttribute('name', algorithm.name);
       node.innerHTML = algorithm.name;
       document.querySelector('#protocol').appendChild(node);
    });
    document.querySelector('#canvas').addEventListener('click', mouseClick);
    document.querySelector('#start').addEventListener('click',init);
    document.querySelector('#protocol').addEventListener('change', hardReset);
});

function init() {
    if (interval === null) {
        const selected = document.querySelector('#protocol');
        const endToEnd = parseInt(document.querySelector('#endToEnd').value);
        const timeout = parseInt(document.querySelector('#timeout').value);
        const bandwidth = parseInt(document.querySelector('#bandwidth').value);
        const drawFunction = draw;
        if (congestionControl === null || congestionControl !== selected.value) {
            congestionControl = new algorithmList[selected.selectedIndex].class(endToEnd, timeout, bandwidth, drawFunction);
            const fields = congestionControl.customFields();
            if (fields !== null) {
                document.querySelectorAll('#customRow input').forEach(field => { congestionControl[field.id] = field.value });
            }
        }
        //lock the form values
        document.querySelectorAll('#timeout, #endToEnd').forEach(elem => { elem.setAttribute('readonly', 'readonly') });
        document.querySelectorAll('#customRow input').forEach(elem => { elem.setAttribute('readonly', 'readonly') });
        document.querySelectorAll('#protocol, #bandwidth').forEach(elem => { elem.setAttribute('disabled', 'disabled') });
        //start all the canvas variables
        ctx = document.querySelector('#canvas').getContext("2d");
        canvasWidth = document.querySelector('#canvas').offsetWidth;
        canvasHeight = document.querySelector("#canvas").offsetHeight;
        canvasX = document.querySelector('#canvas').getBoundingClientRect().left;
        canvasY = document.querySelector('#canvas').getBoundingClientRect().top;
        canvasPaddingX = parseInt(window.getComputedStyle(document.querySelector('#canvas')).getPropertyValue('padding-left'));
        canvasPaddingY = parseInt(window.getComputedStyle(document.querySelector('#canvas')).getPropertyValue('padding-top'));

        // initialize the top and bottom rows
        rowCalibration(0, 40);
        
        timer = new Timer(endToEnd, timeout);
        interval = setInterval(congestionControl.update.bind(congestionControl), 6);
        pause = false;
        isScrolling = false;
        document.querySelector('#start').innerHTML = 'Stop';
    } else {
        pause = true;
        document.querySelector('#start').innerHTML = 'Start';
        document.querySelector('#start').setAttribute('disabled', 'disabled');
    }
}

function draw() {
    clear();
    document.querySelector('#congestionWindow').innerHTML = congestionControl.congestionWindow;
    document.querySelector('#inflight').innerHTML = congestionControl.packets.length;
    if (congestionControl.startIndex + congestionControl.congestionWindow > 40 && isScrolling === false) {
        isScrolling = true;
        scrollDecrease = 6 * (packetWidth + 4) * congestionControl.startIndex / ((congestionControl.endToEnd )/ 2); // make the scroll happen in half the endToEnd time
        //add more nodes for scrolling
        const initLength = topPacketRow.length;
        rowCalibration(initLength, initLength + congestionControl.startIndex);
    }
    if (congestionControl.packets.length > 0) {
        const firstLastGap = congestionControl.packets[congestionControl.packets.length - 1].sentTime - congestionControl.packets[0].sentTime;
        bandX = congestionControl.packets[0].position.x; 
        bandLength = congestionControl.packets.length * (packetWidth + 4);
        timer.progressBase = timer.timeOut + firstLastGap;
    }
    if (isScrolling === true) {
        for (var i = 0; i < topPacketRow.length; i++) {
            topPacketRow[i].position.x -= scrollDecrease;
            lowPacketRow[i].position.x -= scrollDecrease;
        }
        congestionControl.packets.forEach(packet => {
            packet.position.x -= scrollDecrease;
        });
        congestionControl.startIndex -= scrollDecrease/(packetWidth + 4);
        bandX -= scrollDecrease/(packetWidth + 4);
        if (congestionControl.startIndex <= 0)
        {
            isScrolling = false;
            topPacketRow.splice(0, topPacketRow.length-40);
            lowPacketRow.splice(0, lowPacketRow.length-40);
            let cleanDups = false;
            rowCalibration(0, 40);
            if (congestionControl.duplicateACKIndex > 40 - congestionControl.congestionWindow) { // fix to prevent false 3 ACKs on scroll, spotted with bbr
                congestionControl.duplicateACKIndex = null;
                cleanDups = true;
            }
            congestionControl.packets.forEach((packet, i) => {
                packet.position.x = i * (packetWidth + 4);
                packet.dupIndex = cleanDups ? null : packet.dupIndex;
                const lowIndex = lowPacketRow.findIndex((element) => packet.position.x === element.position.x && !packet.lost && packet.received); // bugfix due to bbr
                if (lowIndex !== -1) {
                    lowPacketRow[lowIndex].received = true;
                }
            });
            congestionControl.startIndex = 0;
        }
        
    }
    //add here the gray rectangle for the moving packet's highlight
    rect(startX + ((packetWidth + 4) * congestionControl.startIndex), 0, bandLength, 35, '#c2c6c9');
    
    topPacketRow.forEach(packet => {
        let color;
        const colors = ['#ff0', '#00adef'];
        if (!packet.timedOut) {
            color = colorSelect(packet.confirmed, colors);
        } else {
            color = '#f00';
        }
        rect(startX + packet.position.x, packet.position.y, packetWidth, packetHeight, color);
    });

    lowPacketRow.forEach(packet => {
        const colors = ['#005', '#fff'];
        let color = colorSelect(packet.received, colors);
        rect(startX + packet.position.x, packet.position.y, packetWidth, packetHeight, color);
    });

    congestionControl.packets.forEach((packet, i) => {
        const colors = ['#008000', '#00adef'];
        let color = colorSelect(packet.received, colors);
        //reset timer.progress counter when the first packet is out
        if (i === 0 && packet.position.y === 0 && !packet.received) {
            timer.progress = 0;
        }
        if (parseInt(packet.position.y) >= 368 && !packet.received) {
            packet.received = true;
            //flip the color switch for the bottom row
            const lowIndex = lowPacketRow.findIndex((element) => packet.position.x === element.position.x && !packet.lost);
            if (lowIndex !== -1) {
                lowPacketRow[lowIndex].received = true;
                if (i > 0) {
                    if (!lowPacketRow[lowIndex - 1].received) {
                        lowPacketRow[lowIndex - 1].timedOut = true;
                        congestionControl.duplicateACKIndex = lowIndex - 1;
                    }
                    if (congestionControl.duplicateACKIndex !== null) {
                        packet.dupIndex = congestionControl.duplicateACKIndex;
                    }
                }
            }
        }
        if (!packet.lost  && packet.position.y >= 2) {
            rect(startX + packet.position.x,  packet.position.y, packetWidth, packetHeight, color);
        }
        if (packet.transitTime > timer.timeOut) {
            const topIndex = topPacketRow.findIndex((element) => packet.position.x === element.position.x);
            if (topIndex !== -1) {
                topPacketRow[topIndex].timedOut = true;
                packet.lost = true;
            }
        }

        if (packet.received && Math.floor(packet.position.y <= 2)) {
            packet.acknowledged = true;
            let colors = ['#ff0', '#00adef'];
            const topIndex = topPacketRow.findIndex((element) => packet.position.x === element.position.x);
            if (topIndex !== -1) {
                topPacketRow[topIndex].confirmed = true;
                topPacketRow[topIndex].timedOut = false; // added in case a previously timed out package gets sent
                const color = colorSelect(packet.acknowledged, colors);
                rect(startX + topPacketRow[topIndex].position.x, topPacketRow[topIndex].position.y, packetWidth, packetHeight, color);
            }
            if (i === congestionControl.packets.length - 1) {
                topPacketRow.forEach(node => {
                    const timedOutIndex = congestionControl.packets.findIndex((packet) => packet.position.x === node.position.x && !packet.acknowledged)
                    if (timedOutIndex !== -1) {
                        node.timedOut = true;
                    }
                });
            }
            congestionControl.onACK(packet, i);
        }
    });
    timer.progress += 6;
    if (congestionControl.timerReset && !pause) { // reset timer when the algorithm updates on a per packet basis
        timer.progress = 0;
        timer.progressBase = timer.timeOut + congestionControl.packets[congestionControl.packets.length - 1].sentTime - congestionControl.packets[0].sentTime;
        congestionControl.timerReset = false;
    }
    if (timer.progress < timer.progressBase && allowPause === false && congestionControl.packets.length > 0) {
        visualTimer(congestionControl.packets[0].position.x + packetWidth, (timer.progress/timer.progressBase));
    }
    if (timer.progress >= timer.progressBase || congestionControl.packets.length === 0) {
        timer.progress = 0;
        const timedOutNode =  topPacketRow.findIndex((element) => element.timedOut); // add check for 3Acks call
        if (timedOutNode !== -1) {
            congestionControl.startIndex = timedOutNode;
            congestionControl.onTimeout();
        }
        if (pause === true) {
            allowPause = true; //make the pause happen once the timer is complete or there are no more packets left
        }
    }
    if (allowPause === true) {
        clearInterval(interval);
        interval = null;
        allowPause = false
        document.querySelectorAll('#timeout, #bandwidth, #endToEnd').forEach(elem => elem.removeAttribute('readonly'));
        document.querySelectorAll('#customRow input').forEach(elem => elem.removeAttribute('readonly'));
        document.querySelectorAll('#start, #bandwidth, #protocol').forEach(elem => elem.removeAttribute('disabled'));
        document.querySelectorAll('#congestionWindow, #inflight').forEach(elem => elem.innerHTML = '');
    }
}

function rect(x,y,w,h,c) {
    ctx.beginPath();
    ctx.strokeStyle = '#000';
    ctx.fillStyle = c;
    ctx.lineWidth = 1;
    ctx.rect(x,y,w,h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
}

function clear() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
}

function visualTimer(x, c) {
    ctx.beginPath();
    ctx.strokeStyle = '#f0f';
    ctx.lineWidth = 10;
    ctx.arc(x, 22, 10, Math.PI*3/2, (Math.PI*3/2)+(c*2*Math.PI), true);
    ctx.stroke();
}

function rowCalibration(start, end) {
    for (var i = start; i < end; i++)
    {
        topPacketRow[i] = new TopNode(i * (packetWidth + 4));
        lowPacketRow[i] = new BottomNode(i * (packetWidth + 4));
    }
}

function colorSelect(status, options) {
    return status ? options[0] : options[1];
}

function mouseClick(e) {
    const leftMargin = canvasX + canvasPaddingX + startX;
    const rightMargin = leftMargin + packetWidth;
    const topMargin = canvasY + canvasPaddingY;
    const bottomMargin = topMargin + packetHeight;

    const packetIndex = congestionControl.packets.findIndex((packet) => e.pageX >= (leftMargin + packet.position.x) && e.pageX <= (rightMargin + packet.position.x) && e.pageY >= (topMargin + packet.position.y) && e.pageY <= (bottomMargin + packet.position.y));
    if (packetIndex !== -1) {
        console.log('#clicked a packet');
        congestionControl.packets[packetIndex].lost = true;
    }
}
function hardReset() {
    if (timer !== null) {
        timer.progress = 0;
    }
    topPacketRow = [];
    lowPacketRow = [];
    bandX = 0;
    bandLength = null;
    pause = null;
    allowPause = false;
    getCustom();
}
function getCustom() {
    const selected = document.querySelector('#protocol');
    const customRow = document.querySelector('#customRow');
    const algorithm = new algorithmList[selected.selectedIndex].class(1, 1, 1);
    const fields = algorithm.customFields();
    if (fields !== null) {
        customRow.classList.add('show');
        let header = document.createElement("div");
        header.classList.add('col-md-2');
        header.innerHTML = '<h5>Custom Fields:</h5>'
        customRow.appendChild(header);

        fields.forEach(field => {
            let label = document.createElement("label");
            label.classList.add('col-md-2');
            label.innerHTML = field.id;
            customRow.appendChild(label);

            let column = document.createElement("div");
            column.classList.add('col-md-2');

            let input = document.createElement("input");
            let entries = Object.entries(field);
            entries.forEach(entry => {
                input.setAttribute(entry[0], entry[1]);
            })
            column.appendChild(input);
            customRow.appendChild(column);
        })
    } else {
        customRow.classList.remove('show');
        customRow.innerHTML = '';
    }
}