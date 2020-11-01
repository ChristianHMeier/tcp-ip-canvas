import BBR from './bbr.js'
import Cubic from './cubic.js'
import Reno from './reno.js'

let algorithms = [
    {'name': 'reno', 'class': Reno },
    {'name': 'cubic', 'class': Cubic },
    {'name': 'bbr', 'class': BBR }
];

export default algorithms;