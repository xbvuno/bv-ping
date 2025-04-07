#!/usr/bin/env node

const { Command } = require('commander');
const ping = require("ping");
const { styleText } = require("node:util");

// Command-line argument parsing
const program = new Command();
program
    .argument('[url]', 'URL to ping', '8.8.8.8') // Default URL is 8.8.8.8
    .option('--every <seconds>', 'Interval between pings in seconds', 1) // Default interval is 1 second
    .option('--timestamp', 'Add a timestamp on the right', false)
    .option('--thresholds <numbers>', 'Array of 3 increasing numbers', (value) => {
        const numbers = value.replace('[', '').replace(']', '').split(' ').map(Number);
        if (numbers.length !== 3 || !numbers.every((n, i, arr) => i === 0 || n > arr[i - 1])) {
            throw new Error('--thresholds must be an array of 3 numbers, each larger than the previous.');
        }
        return numbers;
    }, [128, 256, 500]); // Default thresholds
program.parse(process.argv);

const options = program.opts();
const PING_URL = program.args[0] || '8.8.8.8';
const EVERY_MS = parseInt(parseFloat(options.every) * 1000);
const ADD_TIMESTAMP = options.timestamp;
const THRESHOLDS = options.thresholds;

const COLORS = ['green', 'yellow', 'red'];
const EXIT_CHARS = ["q", "\u0003"];

let pings = [];
let times = [];
let max_bar_width = 0;
let bottom_title = '';

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
    const timestamp = ADD_TIMESTAMP ? `[${time}] ` : '';

    if (ping_value === -1)
        return timestamp + ' TOUT ' + '/'.repeat(max_bar_width);
    if (ping_value === -2)
        return timestamp + ' ERR  ' + '/'.repeat(max_bar_width);

    ping_value = Math.round(ping_value)
    const bg_color = bgColorFromValue(ping_value, THRESHOLDS, COLORS);

    const bar_width = Math.min(THRESHOLDS.at(-1), Math.floor(ping_value / THRESHOLDS.at(-1) * max_bar_width));
    const space_left = Math.max(max_bar_width - bar_width - 1, 0);

    let line = 'x'.repeat(bar_width) + ' '.repeat(space_left);

    let sep_count = 0;
    const thresholds_on_width = THRESHOLDS.map(threshold => Math.floor(threshold / THRESHOLDS.at(-1) * max_bar_width));
    for (const threshold of thresholds_on_width) {
        if (threshold < bar_width) {
            sep_count += 1;
            continue;
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

    return timestamp + String(ping_value).padStart(3, ' ') + 'ms ' + line;
}

function printConsole() {
    if (pings.length) {
        console.log(generateBar(pings.at(-1), times.at(-1)) + '\n');
    }
    process.stdout.write(bottom_title);
}

function onResize() {
    const width = process.stdout.columns;
    max_bar_width = width - 6 - (ADD_TIMESTAMP ? 11 : 0);

    console.clear();
    pings.slice(0, pings.length - 1).forEach((pingValue, i) => {
        console.log(generateBar(pingValue, times[i]));
    });

    const text = `doing a ping on ${PING_URL} every ${EVERY_MS / 1000}s`;
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
    try {
        const res = await ping.promise.probe(PING_URL);
        pings.push(res.alive ? res.time : -1);
    } catch {
        pings.push(-2);
    }
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