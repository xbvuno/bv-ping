#!/usr/bin/env node

const { Command } = require('commander');
const ping = require("ping");
const { styleText } = require("node:util");

// Command-line argument parsing
const program = new Command();
program
    .argument('[url]', 'URL to ping', '8.8.8.8') // Default URL is 8.8.8.8
    .option('--every <seconds>', 'Interval between pings in seconds', 1) // Default interval is 1 second
    .option('--timestamp', 'Add a timestamp on the left', false)
    .option('--nogap', 'Remove gap horizontal gap between bars', false)
    .option('--thresholds <numbers>', 'Array of 3 increasing numbers', (value) => {
        const numbers = value.replace('[', '').replace(']', '').split(' ').map(Number);
        if (numbers.length !== 3 || !numbers.every((n, i, arr) => i === 0 || n > arr[i - 1])) {
            throw new Error('--thresholds must be an array of 3 numbers, each larger than the previous.');
        }
        return numbers;
    }, [80, 160, 320]); // Default thresholds
program.parse(process.argv);

const options = program.opts();
const PING_URL = program.args[0] || '8.8.8.8';
const EVERY_MS = parseInt(parseFloat(options.every) * 1000);
const ADD_TIMESTAMP = options.timestamp;
const NOGAP = options.nogap;
const THRESHOLDS = options.thresholds;

const COLORS = ['green', 'yellow', 'red'];
const EXIT_CHARS = ["q", "\u0003"];

let pings = [];
let times = [];
let max_bar_width = 0;
let bottom_title = '';
let thresholds_on_width = []

// Utility functions
function timeStamp() {
    const now = new Date();
    return now.toTimeString().split(' ')[0]; // Format: HH:MM:SS
}

function formatBottomText(text, width) {
    if (text.length >= width) return text.slice(0, width - 3) + '...';
    const gap = Math.floor((width - text.length) / 2);
    return ' '.repeat(gap) + text + ' '.repeat(width - text.length - gap);
}

function bgColorFromValue(value, thresholds, colors) {
    for (let i = 0; i < thresholds.length; i++) {
        if (value < thresholds[i]) return `bg${colors[i][0].toUpperCase()}${colors[i].slice(1)}`;
    }
    return `bg${colors[colors.length - 1][0].toUpperCase()}${colors[colors.length - 1].slice(1)}`;
}

function generateBar(ping_value, time) {
    let timestamp = ADD_TIMESTAMP ? `[${time}] ` : '';

    if (ping_value === -1)
        return timestamp + ' TOUT ' + '/'.repeat(max_bar_width);
    if (ping_value === -2)
        return timestamp + ' ERR  ' + '/'.repeat(max_bar_width);

    ping_value = Math.min(999, ping_value)

    

    const bar_width = Math.min(max_bar_width, Math.floor(ping_value / THRESHOLDS.at(-1) * max_bar_width));
    const space_left = Math.max(max_bar_width - bar_width - 1, 0);

    let line = 'x'.repeat(bar_width) + ' '.repeat(space_left);

    let sep_count = 0;
    
    for (const threshold of thresholds_on_width) {
        if (threshold < bar_width || bar_width == max_bar_width) {
            sep_count += 1;
            continue;
        }
        line = line.slice(0, threshold) + '|' + line.slice(threshold + 1);
    }

    const bg_color = bgColorFromValue(ping_value, THRESHOLDS, COLORS);

    let last_x = line.lastIndexOf('x') + 1;
    line = styleText(bg_color, line.slice(0, last_x).replaceAll('x', ' ')) + styleText('reset', line.slice(last_x));

    let sep_index = -10;
    while (sep_count < 3) {
        sep_index = line.indexOf('|', sep_index + 10);
        line = line.slice(0, sep_index) + styleText(COLORS[sep_count], '|') + line.slice(sep_index + 1);
        sep_count += 1;
    }
    let word = String(ping_value).padStart(3, ' ') + 'ms '
    if (ping_value === 0) {
        word = ' '.repeat(process.stdout.columns - max_bar_width)
        timestamp = ADD_TIMESTAMP ? ' '.repeat(10) : ''
    }
    return timestamp + word + line;
}

function printBar(ping, time) {
    console.log(generateBar(ping, time) + (!NOGAP ? ('\n' + generateBar(0, 0)) : ''));
}

function printConsole() {
    if (pings.length) {
        printBar(pings.at(-1), times.at(-1))
    }
    process.stdout.write(bottom_title);
}

function onResize() {
    const width = process.stdout.columns;
    max_bar_width = width - 6 - (ADD_TIMESTAMP ? 11 : 0);
    thresholds_on_width = THRESHOLDS.map(threshold => Math.floor(threshold / THRESHOLDS.at(-1) * max_bar_width));
    console.clear();
    pings.slice(0, pings.length - 1).forEach((pingValue, i) => {
        printBar(pingValue, times[i])
    });
    
    const text = `doing a ping on ${PING_URL} every ${EVERY_MS / 1000}s ('q' to quit)`;
    bottom_title = formatBottomText(text, width) + '\r';
    printConsole();
}

// Main logic
if (!process.stdout.isTTY || !process.stdin.isTTY) {
    console.error("This terminal is not supported");
    process.exit(1);
}

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding("utf8");

process.stdout.on("resize", onResize);

onResize();

async function doPing() {
    let ping_value = 0;
    try {
        const res = await ping.promise.probe(PING_URL);
        ping_value = res.alive ? res.time : -1;
    } catch (e){
        ping_value = -2;
    }
    //ping_value = Math.floor(Math.random() * 1000)
    pings.push(Math.round(ping_value));
    times.push(timeStamp());
    while (pings.length > process.stdout.rows * 2) {
        pings.shift();
        times.shift();
    }
    printConsole();
}

doPing();
const pingInterval = setInterval(doPing, EVERY_MS);

process.stdin.on("data", (key) => {
    if (EXIT_CHARS.includes(key)) {
        clearInterval(pingInterval);
        console.log();
        process.exit();
    }
});