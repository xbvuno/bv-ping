# bv-ping

A terminal-based Node.js utility to visualize ping latency using colored bars, directly in your console.

## Features

- Pings a given host (default: `8.8.8.8`)
- Configurable intervals and latency thresholds
- Graphical bar output with color coding
- Live updates on terminal resize
- Clean UI with optional timestamp display

> Make sure you have Node.js v18+ (for native `styleText` support).

## Usage

```bash
node bv-ping [url] [options]
```

### Arguments

- `url`: Host or IP to ping. Default: `8.8.8.8`

### Options

- `--every <seconds>`: Ping interval in seconds (default: 1)
- `--timestamp`: Show timestamps on each ping
- `--nogap`: Remove the horizontal gap between bars
- `--thresholds <a,b,c>`: Set custom latency thresholds (must be 3 increasing numbers)

## Examples

```bash
# Default usage
bv-ping

# Ping Cloudflare DNS every 2 seconds
bv-ping 1.1.1.1 --every 2

# Show timestamps and custom thresholds
bv-ping google.com --timestamp --thresholds 100,200,400
```

## Notes

- Press `q` or `Ctrl+C` to quit.
- ANSI-colored bars use thresholds to color code latency: green, yellow, and red.
- Ensure your terminal supports ANSI escape sequences.

## License

MIT