const ping = require("ping");
const { styleText } = require("node:util");


const PING_URL = '8.8.8.8'
const EVERY_MS = 1000;

const THRESHOLDS = [128, 256, 500];
const COLORS = ['green', 'yellow', 'red'];
const MAX_PING = THRESHOLDS.at(-1);
const EXIT_CHARS = ["q", "\u0003"];

let pings = [];
let times = [];
let thresholds_on_width = [];
let bottom_title = ''

function getTimeStamp() {
    const now = new Date();
    
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    return `${hours}:${minutes}:${seconds}`;
}


function onResize() {
    const width = process.stdout.columns;
    thresholds_on_width = [];  // Reset on resize
    for (const threshold of THRESHOLDS) {
        thresholds_on_width.push(Math.floor(threshold / MAX_PING * (width - 4)));
    }
    console.clear()
    for (const [i, ping_value] of pings.entries()) {
        if (i !== pings.length - 1)
            console.log(generateBar(ping_value, times[i]))
    }
    printConsole()

    const every_s = EVERY_MS / 1000
    let text = `pinging ${PING_URL} every ${every_s}s`
    if (text.length >= width) {
        text = text.slice(0, width - 3) + '...'
    } else {
        const gap = Math.floor((width - text.length) / 2)
        text = ' '.repeat(gap) + text + ' '.repeat(gap)
    }
    bottom_title = styleText(['bgWhite','black'], text +  ' '.repeat(width - text.length)) + '\r'
}

function bgColorFromValue(value) {
    let bgcolor = COLORS[0];
    for (const [i, threshold] of THRESHOLDS.entries()) {
        if (value < threshold) {
            bgcolor = COLORS[i];
            break;
        }
    }
    return 'bg' + bgcolor[0].toUpperCase() + bgcolor.slice(1);
}

function generateBar(ping_value, time) {
    const width = process.stdout.columns - 16

    if (ping_value === -1)
        return time + '| T OUT ' + '/'.repeat(width);
    if (ping_value === -2)
        return time + '|  ERR  ' + '/'.repeat(width);
    
    const bg_color = bgColorFromValue(ping_value);

    const bar_width = Math.min(MAX_PING, Math.floor(ping_value / MAX_PING * (width)));
    const space_left = width - bar_width - 1;

    let line = 'x'.repeat(bar_width) + ' '.repeat(space_left);

    let sep_count = 0;
    // Place thresholds markers
    for (const [i, threshold] of thresholds_on_width.entries()) {
        if (threshold < bar_width) {
            sep_count += 1
            continue
        }
        line = line.slice(0, threshold) + '|' + line.slice(threshold + 1);
    }

    let last_x = line.lastIndexOf('x') + 1;
    line = styleText(bg_color, line.slice(0, last_x).replaceAll('x', ' ')) + styleText('reset', line.slice(last_x));

    let sep_index = -10;
    while (sep_count < 3) {
        sep_index = line.indexOf('|', sep_index + 10);
        line = line.slice(0, sep_index) + styleText(COLORS[sep_count], '|') + line.slice(sep_index + 1);
        sep_count += 1;
    }

    return time + '| ' + String(ping_value).padStart(3, ' ') + 'ms ' + line;
}

function printConsole() {
    const width = process.stdout.columns;
    if (pings.length) {
        const last_ping = pings.at(-1)
        const last_time = times.at(-1)
        console.log(generateBar(last_ping, last_time));
    }

    process.stdout.write(bottom_title);
}

async function doPing() {
    try {
        const res = await ping.promise.probe(PING_URL);
        if (res.alive) {
            pings.push(res.time);
        } else {
            pings.push(-1);
        }
    } catch (err) {
        pings.push(-2);
    }
    times.push(getTimeStamp())
    while (pings.length > Math.floor(process.stdout.rows * 1.5)) {
        pings.shift()
        times.shift()
    }
    printConsole();
}

if (!process.stdout.isTTY || !process.stdin.isTTY) {
    console.log("Terminale non supportato");
    process.exit(1);
}

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");

process.stdout.on("resize", onResize);

onResize(); // Initialize on resize

// printConsole(); // Initial print
doPing(); // First ping

const pingInterval = setInterval(doPing, EVERY_MS);

process.stdin.on("data", (key) => {
    if (EXIT_CHARS.includes(key)) {
        clearInterval(pingInterval);
        process.exit();
    }
});
